'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Supplier, Branch, Product, Profile } from '@/types'
import { Plus, Trash2, AlertCircle, Camera, Upload, Loader2, CheckCircle, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const LISBOA_GREEN = '#1C2B23'

type Step = 'setup' | 'scanning' | 'review' | 'done'

interface ScannedItem {
  name: string
  quantity: number
  unit_price: number
  product_id: string
  matched: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  suppliers: Supplier[]
  branches: Branch[]
  products: Product[]
  profile: Profile
}

export function NewOrderDialog({ open, onClose, suppliers, branches, products, profile }: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('setup')
  const [loading, setLoading] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [branchId, setBranchId] = useState(profile.branch_id ?? '')
  const [notes, setNotes] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function updateItem(index: number, key: keyof ScannedItem, value: string | number | boolean) {
    setScannedItems((prev) => prev.map((item, i) => i === index ? { ...item, [key]: value } : item))
  }

  function addManualItem() {
    setScannedItems((prev) => [...prev, {
      name: '',
      quantity: 1,
      unit_price: 0,
      product_id: '',
      matched: false,
    }])
  }

  function removeItem(index: number) {
    setScannedItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleScan() {
    if (!supplierId || !branchId) {
      toast.error('Seleccioná proveedor y sucursal primero')
      return
    }
    if (!imageFile) {
      toast.error('Seleccioná una imagen del pedido')
      return
    }

    setStep('scanning')
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)

      const res = await fetch('/api/ai/scan-delivery', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Error al procesar la imagen')
      const data = await res.json()

      // Normalizar: minúsculas, sin guiones ni puntuación, espacios simples
      function normalize(s: string) {
        return s.toLowerCase()
          .replace(/[-–—_]/g, ' ')
          .replace(/[^a-z0-9áéíóúñü ]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      }

      function fuzzyMatch(a: string, b: string) {
        const na = normalize(a)
        const nb = normalize(b)
        if (na.includes(nb) || nb.includes(na)) return true
        // match por palabras clave (>3 chars)
        const words = nb.split(' ').filter((w) => w.length > 3)
        return words.length > 0 && words.every((w) => na.includes(w))
      }

      const matched: ScannedItem[] = (data.items ?? []).map((item: { name: string; quantity: number }) => {
        const product = products.find((p) => fuzzyMatch(p.name, item.name))
        return {
          name: product?.name ?? item.name,
          quantity: item.quantity,
          unit_price: product?.cost_price ?? 0,
          product_id: product?.id ?? '',
          matched: !!product,
        }
      })

      if (matched.length === 0) {
        toast.error('No se detectaron productos. Intentá con otra foto o cargalos manualmente.')
        setStep('setup')
        return
      }

      setScannedItems(matched)
      setStep('review')
    } catch (err) {
      toast.error('Error al escanear. Intentá de nuevo.')
      setStep('setup')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    const validItems = scannedItems.filter((i) => i.product_id && i.quantity > 0)
    if (validItems.length === 0) {
      toast.error('No hay productos válidos para registrar')
      return
    }
    setLoading(true)

    try {
      const total = validItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

      // 1. Subir imagen si existe
      let photoUrl: string | null = null
      if (imageFile) {
        const fileName = `orders/${Date.now()}-${imageFile.name}`
        const { data: uploadData } = await supabase.storage
          .from('deliveries')
          .upload(fileName, imageFile, { upsert: true })
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('deliveries').getPublicUrl(fileName)
          photoUrl = urlData.publicUrl
        }
      }

      // 2. Crear pedido
      const { data: order, error: orderError } = await supabase
        .from('supplier_orders')
        .insert({
          supplier_id: supplierId,
          branch_id: branchId,
          user_id: profile.id,
          status: 'received',
          total,
          delivery_photo_url: photoUrl,
          notes: notes || null,
        })
        .select()
        .single()

      if (orderError) throw orderError

      // 3. Crear ítems del pedido
      await supabase.from('supplier_order_items').insert(
        validItems.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity_ordered: item.quantity,
          quantity_received: item.quantity,
          unit_price: item.unit_price,
        }))
      )

      // 4. Actualizar stock
      for (const item of validItems) {
        const { data: stock } = await supabase
          .from('stock')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('branch_id', branchId)
          .maybeSingle()

        if (stock) {
          await supabase.from('stock').update({
            quantity: stock.quantity + item.quantity,
          }).eq('id', stock.id)
        } else {
          await supabase.from('stock').insert({
            product_id: item.product_id,
            branch_id: branchId,
            quantity: item.quantity,
            min_quantity: 5,
          })
        }
      }

      // 5. Actualizar cuenta corriente
      const { data: account } = await supabase
        .from('accounts_payable')
        .select('id, balance')
        .eq('supplier_id', supplierId)
        .eq('branch_id', branchId)
        .maybeSingle()

      if (account) {
        await supabase.from('accounts_payable')
          .update({ balance: account.balance + total })
          .eq('id', account.id)
      }

      // 6. Alerta de pago
      const supplier = suppliers.find((s) => s.id === supplierId)
      const branch = branches.find((b) => b.id === branchId)
      await supabase.from('alerts').insert({
        type: 'payment_due',
        branch_id: branchId,
        message: `⚠️ Pago pendiente a ${supplier?.name}: ${formatCurrency(total)} — Sucursal ${branch?.name}. Generar transferencia ahora.`,
      })

      // 7. Log
      await supabase.from('activity_log').insert({
        user_id: profile.id,
        action: 'create_order',
        entity_type: 'supplier_orders',
        entity_id: order.id,
        metadata: { supplier: supplier?.name, total, items_count: validItems.length },
      })

      // 8. WhatsApp a Sebastián
      const itemsList = validItems.map((i) => {
        const p = products.find((p) => p.id === i.product_id)
        return `• ${p?.name ?? 'Producto'} x${i.quantity}`
      }).join('\n')

      fetch('/api/notify/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🛒 *Nuevo pedido registrado — Lisboa Market*\n\n*Proveedor:* ${supplier?.name}\n*Sucursal:* ${branch?.name}\n*Total:* ${formatCurrency(total)}\n\n*Productos:*\n${itemsList}\n\n⚠️ Generar transferencia ahora.`,
        }),
      }).catch(() => {}) // No bloquear si falla

      setStep('done')
    } catch (err) {
      toast.error('Error al registrar el pedido')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const total = scannedItems
    .filter((i) => i.product_id)
    .reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[88vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Registrar pedido de proveedor
          </DialogTitle>
        </DialogHeader>

        {/* PASO 1 — SETUP + FOTO */}
        {step === 'setup' && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Proveedor *</Label>
                <Select value={supplierId} onValueChange={(v) => v && setSupplierId(v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <span className="truncate">
                      {supplierId ? (suppliers.find((s) => s.id === supplierId)?.name ?? 'Seleccionar') : 'Seleccionar'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Sucursal *</Label>
                <Select value={branchId} onValueChange={(v) => v && setBranchId(v)} disabled={profile.role !== 'director'}>
                  <SelectTrigger className="h-9 text-sm">
                    <span className="truncate">
                      {branchId ? (branches.find((b) => b.id === branchId)?.name ?? 'Seleccionar') : 'Seleccionar'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Upload foto */}
            <div className="space-y-1.5">
              <Label className="text-xs">Foto del pedido / remito</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-neutral-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="space-y-2">
                    <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                    <p className="text-xs text-muted-foreground">{imageFile?.name}</p>
                    <p className="text-xs font-medium" style={{ color: LISBOA_GREEN }}>Clic para cambiar imagen</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-7 h-7 text-neutral-400 mx-auto" />
                    <p className="text-sm font-medium">Subir foto del pedido</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG — la IA identificará los productos</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del pedido..."
                className="text-sm h-16 resize-none"
              />
            </div>

            {supplierId && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Se generará una <strong>alerta de pago inmediato</strong> para que Sebastián realice la transferencia.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1 h-9 text-sm text-white gap-1.5"
                style={{ backgroundColor: LISBOA_GREEN }}
                onClick={handleScan}
                disabled={!supplierId || !branchId || !imageFile}
              >
                <Camera className="w-3.5 h-3.5" />
                Analizar con IA
              </Button>
            </div>
          </div>
        )}

        {/* PASO 2 — ESCANEANDO */}
        {step === 'scanning' && (
          <div className="py-14 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: LISBOA_GREEN }} />
            <div>
              <p className="text-sm font-medium">Analizando el pedido...</p>
              <p className="text-xs text-muted-foreground mt-1">Claude está identificando productos y cantidades</p>
            </div>
            {imagePreview && (
              <img src={imagePreview} alt="Analizando" className="max-h-32 mx-auto rounded-lg object-contain opacity-40" />
            )}
          </div>
        )}

        {/* PASO 3 — REVISIÓN */}
        {step === 'review' && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Revisá los productos detectados</p>
                <p className="text-xs text-muted-foreground">
                  {scannedItems.filter((i) => i.matched).length} de {scannedItems.length} identificados en catálogo
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setStep('setup')}>
                Cambiar foto
              </Button>
            </div>

            {imagePreview && (
              <img src={imagePreview} alt="Pedido" className="w-full max-h-32 object-contain rounded-lg border border-border" />
            )}

            <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
              {scannedItems.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'p-3 rounded-lg border',
                    item.matched ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {item.matched ? (
                        <p className="text-xs font-medium">{item.name}</p>
                      ) : (
                        <Select value={item.product_id} onValueChange={(v) => {
                          if (!v) return
                          const product = products.find((p) => p.id === v)
                          setScannedItems((prev) => prev.map((it, idx) => idx === i ? {
                            ...it,
                            product_id: v,
                            name: product?.name ?? it.name,
                            unit_price: product?.cost_price ?? 0,
                            matched: true,
                          } : it))
                        }}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder={`Seleccionar: "${item.name}"`} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.matched ? '✓ Identificado' : '⚠ No encontrado — seleccioná el producto'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground text-center">Cant.</p>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-12 h-7 text-xs text-center px-1"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground text-center">$ costo</p>
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                          min="0"
                          className="w-16 h-7 text-xs px-1"
                        />
                      </div>
                      <button
                        onClick={() => removeItem(i)}
                        className="mt-4 p-1 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={addManualItem}>
              <Plus className="w-3.5 h-3.5" />
              Agregar producto manualmente
            </Button>

            {total > 0 && (
              <div className="flex justify-between items-center py-2 border-t border-border">
                <span className="text-sm font-medium">Total del pedido</span>
                <span className="text-lg font-bold">{formatCurrency(total)}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setStep('setup')}>
                Volver
              </Button>
              <Button
                className="flex-1 h-9 text-sm text-white"
                style={{ backgroundColor: LISBOA_GREEN }}
                onClick={handleConfirm}
                disabled={loading || scannedItems.filter((i) => i.matched && i.quantity > 0).length === 0}
              >
                {loading ? 'Registrando...' : 'Confirmar pedido'}
              </Button>
            </div>
          </div>
        )}

        {/* PASO 4 — LISTO */}
        {step === 'done' && (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `${LISBOA_GREEN}15` }}>
              <CheckCircle className="w-7 h-7" style={{ color: LISBOA_GREEN }} />
            </div>
            <div>
              <p className="text-sm font-semibold">Pedido registrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Stock actualizado · Alerta de pago enviada a Sebastián
              </p>
            </div>
            <Button
              className="mt-2 text-white"
              style={{ backgroundColor: LISBOA_GREEN }}
              onClick={() => { onClose(); window.location.reload() }}
            >
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Camera, Upload, CheckCircle, Loader2, Edit2 } from 'lucide-react'
import type { Product, Branch } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface ScannedItem {
  name: string
  quantity: number
  product_id?: string
  matched: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  products: Product[]
  branches: Branch[]
  profileBranchId: string | null
  isDirector: boolean
}

export function ScanDeliveryDialog({ open, onClose, products, branches, profileBranchId, isDirector }: Props) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'review' | 'done'>('upload')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [branchId, setBranchId] = useState(profileBranchId ?? '')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleScan() {
    if (!imageFile) return
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

      // Match con productos existentes
      const matched: ScannedItem[] = (data.items ?? []).map((item: { name: string; quantity: number }) => {
        const product = products.find(
          (p) => p.name.toLowerCase().includes(item.name.toLowerCase()) ||
                 item.name.toLowerCase().includes(p.name.toLowerCase())
        )
        return {
          ...item,
          product_id: product?.id,
          matched: !!product,
        }
      })

      setScannedItems(matched)
      setStep('review')
    } catch (err) {
      toast.error('Error al escanear la imagen. Intentá de nuevo.')
      setStep('upload')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!branchId) {
      toast.error('Seleccioná una sucursal')
      return
    }
    setLoading(true)

    try {
      const matchedItems = scannedItems.filter((item) => item.matched && item.product_id)

      for (const item of matchedItems) {
        const { data: stock } = await supabase
          .from('stock')
          .select('id, quantity')
          .eq('product_id', item.product_id!)
          .eq('branch_id', branchId)
          .maybeSingle()

        if (stock) {
          await supabase.from('stock').update({
            quantity: stock.quantity + item.quantity,
          }).eq('id', stock.id)
        } else {
          await supabase.from('stock').insert({
            product_id: item.product_id!,
            branch_id: branchId,
            quantity: item.quantity,
            min_quantity: 5,
          })
        }
      }

      // Log activity
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('activity_log').insert({
          user_id: user.id,
          action: 'scan_delivery',
          entity_type: 'stock',
          metadata: { items_count: matchedItems.length, branch_id: branchId },
        })
      }

      toast.success(`Stock actualizado: ${matchedItems.length} productos`)
      setStep('done')
    } catch (err) {
      toast.error('Error al actualizar el stock')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function updateQuantity(index: number, quantity: number) {
    setScannedItems((prev) => prev.map((item, i) => i === index ? { ...item, quantity } : item))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Escanear pedido con IA
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Subí una foto del pedido y la IA identificará automáticamente los productos y cantidades.
            </p>

            {isDirector && (
              <div className="space-y-1.5">
                <Label className="text-xs">Sucursal de destino</Label>
                <Select value={branchId} onValueChange={(v) => v && setBranchId(v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-neutral-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="space-y-2">
                  <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                  <p className="text-xs text-muted-foreground">{imageFile?.name}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-sm font-medium">Subir foto del pedido</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG — clic para seleccionar</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1 h-9 text-sm bg-black text-white hover:bg-neutral-800"
                onClick={handleScan}
                disabled={!imageFile}
              >
                Analizar con IA
              </Button>
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-neutral-400" />
            <p className="text-sm font-medium">Analizando imagen...</p>
            <p className="text-xs text-muted-foreground">Claude está identificando los productos</p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se identificaron <strong>{scannedItems.length}</strong> productos.
              Revisá las cantidades antes de confirmar.
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {scannedItems.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${item.matched ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {!item.matched && (
                      <p className="text-xs text-amber-600">No encontrado en catálogo</p>
                    )}
                    {item.matched && (
                      <p className="text-xs text-emerald-600">Producto identificado</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-xs text-muted-foreground">Cant:</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(i, parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-16 h-7 text-xs text-center"
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {scannedItems.filter((i) => i.matched).length} de {scannedItems.length} productos serán actualizados en stock.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setStep('upload')}>
                Volver
              </Button>
              <Button
                className="flex-1 h-9 text-sm bg-black text-white hover:bg-neutral-800"
                onClick={handleConfirm}
                disabled={loading || scannedItems.filter((i) => i.matched).length === 0}
              >
                {loading ? 'Actualizando...' : 'Confirmar y actualizar stock'}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium">Stock actualizado correctamente</p>
            <p className="text-xs text-muted-foreground">Los cambios ya están disponibles en el inventario</p>
            <Button className="mt-2 bg-black text-white hover:bg-neutral-800" onClick={() => { onClose(); window.location.reload() }}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

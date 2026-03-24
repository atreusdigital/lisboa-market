'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Camera, Upload, CheckCircle, Loader2, Search, AlertTriangle } from 'lucide-react'
import type { Product, Branch } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ScannedItem {
  descripcion_factura: string
  codigo_factura: string | null
  cantidad: number
  precio_unit: number | null
  importe: number | null
  product_id?: string
  matched_name?: string
  matched_score?: number
  matched: boolean
}

interface InvoiceData {
  proveedor?: string
  fecha?: string
  numero_factura?: string
  items: ScannedItem[]
  subtotal?: number
  iva_pct?: number | null
  iva_monto?: number | null
  iibb_pct?: number | null
  iibb_monto?: number | null
  otros_impuestos?: number | null
  total?: number
}

interface Props {
  open: boolean
  onClose: () => void
  products: Product[]
  branches: Branch[]
  profileBranchId: string | null
  isDirector: boolean
}

// ── Fuzzy matching ──────────────────────────────────────────
function normalizeStr(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,xX×\/\\()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length >= 2)
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = normalizeStr(a)
  const bTokens = normalizeStr(b)
  if (!aTokens.length || !bTokens.length) return 0

  let matches = 0
  for (const at of aTokens) {
    for (const bt of bTokens) {
      if (at === bt || at.startsWith(bt) || bt.startsWith(at)) {
        matches++
        break
      }
    }
  }
  return matches / Math.max(aTokens.length, bTokens.length)
}

function findBestMatch(invoice: string, barcode: string | null, products: Product[]): { product: Product; score: number } | null {
  let best: Product | null = null
  let bestScore = 0.35 // minimum threshold

  for (const p of products) {
    // Exact barcode match wins immediately
    if (barcode && p.barcode && p.barcode === barcode) {
      return { product: p, score: 1 }
    }
    const score = tokenSimilarity(invoice, p.name)
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  return best ? { product: best, score: bestScore } : null
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

export function ScanDeliveryDialog({ open, onClose, products, branches, profileBranchId, isDirector }: Props) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'review' | 'done'>('upload')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [branchId, setBranchId] = useState(profileBranchId ?? '')
  const [loading, setLoading] = useState(false)
  const [manualSearch, setManualSearch] = useState<Record<number, string>>({})
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

      const res = await fetch('/api/ai/scan-delivery', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)

      setInvoice(data)

      // Fuzzy match each item
      const matched: ScannedItem[] = (data.items ?? []).map((item: {
        descripcion_factura: string
        codigo_factura: string | null
        cantidad: number
        precio_unit: number | null
        importe: number | null
      }) => {
        const result = findBestMatch(item.descripcion_factura, item.codigo_factura, products)
        return {
          ...item,
          product_id: result?.product.id,
          matched_name: result?.product.name,
          matched_score: result?.score,
          matched: !!result,
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

  function updateQuantity(index: number, quantity: number) {
    setScannedItems(prev => prev.map((item, i) => i === index ? { ...item, cantidad: quantity } : item))
  }

  function assignProduct(index: number, productId: string) {
    const product = products.find(p => p.id === productId)
    setScannedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, product_id: productId, matched_name: product?.name, matched: true } : item
    ))
    setManualSearch(prev => ({ ...prev, [index]: '' }))
  }

  async function handleConfirm() {
    if (!branchId) { toast.error('Seleccioná una sucursal'); return }
    setLoading(true)

    try {
      const matchedItems = scannedItems.filter(item => item.matched && item.product_id)

      for (const item of matchedItems) {
        const { data: stock } = await supabase
          .from('stock')
          .select('id, quantity')
          .eq('product_id', item.product_id!)
          .eq('branch_id', branchId)
          .maybeSingle()

        if (stock) {
          await supabase.from('stock').update({ quantity: stock.quantity + item.cantidad }).eq('id', stock.id)
        } else {
          await supabase.from('stock').insert({
            product_id: item.product_id!,
            branch_id: branchId,
            quantity: item.cantidad,
            min_quantity: 5,
          })
        }

        // Update cost if we have the unit price from invoice
        if (item.precio_unit && item.precio_unit > 0) {
          await supabase.from('products')
            .update({ cost_price: item.precio_unit })
            .eq('id', item.product_id!)
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('activity_log').insert({
          user_id: user.id,
          action: 'scan_delivery',
          entity_type: 'stock',
          metadata: {
            items_count: matchedItems.length,
            branch_id: branchId,
            proveedor: invoice?.proveedor,
            factura: invoice?.numero_factura,
            total: invoice?.total,
          },
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

  function handleClose() {
    setStep('upload')
    setImageFile(null)
    setImagePreview(null)
    setInvoice(null)
    setScannedItems([])
    setManualSearch({})
    onClose()
  }

  const matchedCount = scannedItems.filter(i => i.matched).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Escanear pedido con IA
          </DialogTitle>
        </DialogHeader>

        {/* UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Subí una foto de la factura o remito. La IA detectará productos, cantidades, precios e impuestos.
            </p>

            {(isDirector || branches.length > 1) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Sucursal de destino</Label>
                <Select value={branchId} onValueChange={v => v && setBranchId(v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <span>{branches.find(b => b.id === branchId)?.name ?? 'Seleccionar sucursal'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
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
                  <p className="text-sm font-medium">Subir foto de la factura</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG — clic para seleccionar</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={handleClose}>Cancelar</Button>
              <Button className="flex-1 h-9 text-sm bg-black text-white hover:bg-neutral-800" onClick={handleScan} disabled={!imageFile}>
                Analizar con IA
              </Button>
            </div>
          </div>
        )}

        {/* SCANNING */}
        {step === 'scanning' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-neutral-400" />
            <p className="text-sm font-medium">Analizando factura...</p>
            <p className="text-xs text-muted-foreground">Detectando productos, precios e impuestos</p>
          </div>
        )}

        {/* REVIEW */}
        {step === 'review' && invoice && (
          <div className="space-y-4">
            {/* Invoice header */}
            <div className="rounded-lg border border-border bg-neutral-50 p-3 grid grid-cols-3 gap-3 text-xs">
              {invoice.proveedor && (
                <div><span className="text-muted-foreground">Proveedor</span><p className="font-semibold mt-0.5">{invoice.proveedor}</p></div>
              )}
              {invoice.numero_factura && (
                <div><span className="text-muted-foreground">Factura</span><p className="font-semibold mt-0.5">#{invoice.numero_factura}</p></div>
              )}
              {invoice.fecha && (
                <div><span className="text-muted-foreground">Fecha</span><p className="font-semibold mt-0.5">{invoice.fecha}</p></div>
              )}
            </div>

            <p className="text-base text-muted-foreground">
              Se identificaron <strong>{scannedItems.length}</strong> productos.{' '}
              <span className={cn(matchedCount === scannedItems.length ? 'text-green-600' : 'text-amber-600', 'font-medium')}>
                {matchedCount}/{scannedItems.length} encontrados en catálogo.
              </span>
            </p>

            {/* Products table */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {scannedItems.map((item, i) => {
                const catalogProduct = products.find(p => p.id === item.product_id)
                const searchResults = manualSearch[i]
                  ? products.filter(p => p.name.toLowerCase().includes(manualSearch[i].toLowerCase())).slice(0, 5)
                  : []

                return (
                  <div key={i} className={cn(
                    'rounded-lg border p-4 space-y-3',
                    item.matched ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
                  )}>
                    {/* Row 1: invoice description + quantity */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground">Factura: {item.descripcion_factura}</p>
                        {item.matched ? (
                          <p className="text-base font-semibold text-emerald-700 mt-0.5">{item.matched_name}</p>
                        ) : (
                          <p className="text-sm text-amber-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-4 h-4" /> No encontrado — buscá manualmente:
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <Label className="text-xs text-muted-foreground">Cant.</Label>
                        <Input
                          type="number"
                          value={item.cantidad}
                          onChange={e => updateQuantity(i, parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-20 h-9 text-sm text-center mt-1"
                        />
                      </div>
                    </div>

                    {/* Row 2: prices */}
                    {(item.precio_unit || catalogProduct) && (
                      <div className="flex gap-6 text-sm">
                        {item.precio_unit && (
                          <span className="text-muted-foreground">Costo factura: <strong className="text-foreground">{fmt(item.precio_unit)}</strong></span>
                        )}
                        {catalogProduct?.sell_price && (
                          <span className="text-muted-foreground">Mostrador: <strong className="text-foreground">{fmt(catalogProduct.sell_price)}</strong></span>
                        )}
                        {item.precio_unit && catalogProduct?.sell_price && (
                          <span className="text-muted-foreground">Rent: <strong className={cn(
                            ((catalogProduct.sell_price - item.precio_unit) / catalogProduct.sell_price * 100) >= 20 ? 'text-green-600' : 'text-red-600'
                          )}>{(((catalogProduct.sell_price - item.precio_unit) / catalogProduct.sell_price) * 100).toFixed(1)}%</strong></span>
                        )}
                      </div>
                    )}

                    {/* Manual search for unmatched */}
                    {!item.matched && (
                      <div className="relative">
                        <div className="relative">
                          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={manualSearch[i] ?? ''}
                            onChange={e => setManualSearch(prev => ({ ...prev, [i]: e.target.value }))}
                            placeholder="Buscar en catálogo..."
                            className="h-7 text-xs pl-7"
                          />
                        </div>
                        {searchResults.length > 0 && (
                          <div className="absolute z-10 w-full bg-white border border-border rounded-md shadow-lg mt-1 max-h-32 overflow-y-auto">
                            {searchResults.map(p => (
                              <button
                                key={p.id}
                                onClick={() => assignProduct(i, p.id)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 border-b border-border last:border-0"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Taxes breakdown */}
            {(invoice.iva_monto || invoice.iibb_monto || invoice.subtotal || invoice.total) && (
              <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                <p className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">Impuestos detectados</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {invoice.subtotal != null && (
                    <><span className="text-muted-foreground">Subtotal</span><span className="text-right font-medium">{fmt(invoice.subtotal)}</span></>
                  )}
                  {invoice.iva_monto != null && (
                    <><span className="text-muted-foreground">IVA {invoice.iva_pct != null ? `(${invoice.iva_pct}%)` : ''}</span><span className="text-right font-medium">{fmt(invoice.iva_monto)}</span></>
                  )}
                  {invoice.iibb_monto != null && (
                    <><span className="text-muted-foreground">IIBB {invoice.iibb_pct != null ? `(${invoice.iibb_pct}%)` : ''}</span><span className="text-right font-medium">{fmt(invoice.iibb_monto)}</span></>
                  )}
                  {invoice.otros_impuestos != null && (
                    <><span className="text-muted-foreground">Otras percepciones</span><span className="text-right font-medium">{fmt(invoice.otros_impuestos)}</span></>
                  )}
                  {invoice.total != null && (
                    <><span className="font-bold border-t border-border pt-1">TOTAL</span><span className="text-right font-bold border-t border-border pt-1">{fmt(invoice.total)}</span></>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setStep('upload')}>Volver</Button>
              <Button
                className="flex-1 h-9 text-sm bg-black text-white hover:bg-neutral-800"
                onClick={handleConfirm}
                disabled={loading || matchedCount === 0}
              >
                {loading ? 'Actualizando...' : `Confirmar (${matchedCount} productos)`}
              </Button>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium">Stock actualizado correctamente</p>
            <p className="text-xs text-muted-foreground">Los costos también fueron actualizados con los precios de la factura</p>
            <Button className="mt-2 bg-black text-white hover:bg-neutral-800" onClick={() => { handleClose(); window.location.reload() }}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

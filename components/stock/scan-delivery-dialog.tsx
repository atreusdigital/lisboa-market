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
  descripcion_normalizada?: string
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
const STOP_TOKENS = new Set([
  'de', 'la', 'el', 'un', 'en', 'con', 'sin', 'por', 'del',
  'und', 'uni', 'caja', 'pack', 'paq', 'sobre', 'bols', 'los', 'las',
])

function normalizeStr(s: string): string[] {
  return s
    .toLowerCase()
    // Normalize "82 GR" / "82G" / "82GRS" → "82gr" BEFORE splitting
    // Weight/size tokens are CRITICAL for differentiating product variants (162G ≠ 82G ≠ 29G)
    .replace(/(\d+(?:\.\d+)?)\s*(grs?|gr|g|mls?|ml|kgs?|kg|lts?|lt|cc|mgs?|mg|oz)\b/g,
      (_, num, unit) => `${num}${unit.replace(/^g$|^grs?$/, 'gr').replace(/^mls?$/, 'ml').replace(/^kgs?$/, 'kg').replace(/^lts?$/, 'lt')}`)
    .replace(/[.,+×\/\\()\[\]&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length >= 3)
    .filter(t => !STOP_TOKENS.has(t))
    .filter(t => !/^\d+$/.test(t))  // exclude pure numbers like (20), (16), (32)
    // Note: weight tokens like "162gr", "29gr", "500ml" are KEPT — they differentiate variants
}

// Levenshtein distance for typo tolerance (OCR errors, abbreviations)
function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99
  const dp: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [i]
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = i === 0 ? j
        : Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[a.length][b.length]
}

function tokensMatch(at: string, bt: string): boolean {
  if (at === bt) return true
  const minLen = Math.min(at.length, bt.length)
  // Weight tokens (e.g. "162gr"): ONLY exact match — "162gr" must NOT match "82gr"
  if (/\d/.test(at) && /\d/.test(bt)) return at === bt
  // Prefix match: "car" matches "caramelos", "desod" matches "desodorante"
  if (minLen >= 3 && (at.startsWith(bt) || bt.startsWith(at))) return true
  // Fuzzy match: 1 typo/OCR error for words ≥ 6 chars ("keterolaco" → "ketorolaco")
  if (at.length >= 6 && bt.length >= 6 && lev(at, bt) <= 1) return true
  return false
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = normalizeStr(a)
  const bTokens = normalizeStr(b)
  if (!aTokens.length || !bTokens.length) return 0

  let matches = 0
  for (const at of aTokens) {
    if (bTokens.some(bt => tokensMatch(at, bt))) matches++
  }
  // Geometric mean of token counts: rewards short catalog names that fully match
  // e.g. catalog="DICLOFENAC" (1 token) fully contained in invoice "DICLOFENAC 75G TIRA X15" (3 tokens) → 1/√3 = 0.58
  return matches / Math.sqrt(aTokens.length * bTokens.length)
}

function findBestMatch(invoice: string, barcode: string | null, products: Product[]): { product: Product; score: number } | null {
  let best: Product | null = null
  let bestScore = 0.28 // lowered threshold — geometric mean scoring is more conservative

  for (const p of products) {
    if (barcode && p.barcode && p.barcode === barcode) return { product: p, score: 1 }
    const score = tokenSimilarity(invoice, p.name)
    if (score > bestScore) { bestScore = score; best = p }
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

  async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 1600
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.90)
      }
      img.src = url
    })
  }

  async function handleScan() {
    if (!imageFile) return
    setStep('scanning')
    setLoading(true)

    try {
      const compressed = await compressImage(imageFile)
      const formData = new FormData()
      formData.append('image', compressed, 'invoice.jpg')

      const res = await fetch('/api/ai/scan-delivery', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)

      setInvoice(data)

      // Fuzzy match each item — try normalizada first, fall back to factura
      const matched: ScannedItem[] = (data.items ?? []).map((item: {
        descripcion_factura: string
        descripcion_normalizada?: string
        codigo_factura: string | null
        cantidad: number
        precio_unit: number | null
        importe: number | null
      }) => {
        const queryNorm = item.descripcion_normalizada ?? item.descripcion_factura
        const r1 = findBestMatch(queryNorm, item.codigo_factura, products)
        const r2 = !r1 ? findBestMatch(item.descripcion_factura, item.codigo_factura, products) : null
        const result = r1 ?? r2
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

        // Update cost with per-unit price (invoice price / quantity)
        if (item.precio_unit && item.precio_unit > 0) {
          const costPerUnit = item.cantidad > 1 ? item.precio_unit / item.cantidad : item.precio_unit
          await supabase.from('products')
            .update({ cost_price: costPerUnit })
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

      // Save purchase record with invoice image
      let imageBase64: string | null = null
      if (imageFile) {
        const compressed = await compressImage(imageFile)
        const buf = await compressed.arrayBuffer()
        imageBase64 = Buffer.from(buf).toString('base64')
      }

      const catalogMap = Object.fromEntries(products.map(p => [p.id, p]))
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId,
          proveedor: invoice?.proveedor ?? null,
          fecha: invoice?.fecha ?? null,
          numero_factura: invoice?.numero_factura ?? null,
          invoice_image_base64: imageBase64,
          subtotal: invoice?.subtotal ?? null,
          iva_monto: invoice?.iva_monto ?? null,
          iibb_monto: invoice?.iibb_monto ?? null,
          total: invoice?.total ?? null,
          items: matchedItems.map(item => {
            const qty = item.cantidad > 1 ? item.cantidad : 1
            const costUnit = item.precio_unit ? item.precio_unit / qty : null
            const sellPrice = catalogMap[item.product_id!]?.sell_price ?? null
            return {
              product_id: item.product_id!,
              descripcion_factura: item.descripcion_factura,
              cantidad: item.cantidad,
              costo_unit: costUnit,
              sell_price: sellPrice,
            }
          }),
        }),
      })

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
                        <p className="text-xs text-muted-foreground">Factura: {item.descripcion_factura}</p>
                        {item.descripcion_normalizada && item.descripcion_normalizada !== item.descripcion_factura && (
                          <p className="text-xs text-blue-500">IA: {item.descripcion_normalizada}</p>
                        )}
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

                    {/* Row 2: prices — cost per unit = precio_unit / cantidad */}
                    {(item.precio_unit || catalogProduct) && (() => {
                      const qty = item.cantidad > 1 ? item.cantidad : 1
                      const costUnit = item.precio_unit ? item.precio_unit / qty : null
                      const sell = catalogProduct?.sell_price ?? null
                      const rent = costUnit && sell ? ((sell - costUnit) / sell * 100) : null
                      return (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-sm">
                            {costUnit && (
                              <span className="text-muted-foreground">
                                Costo c/u: <strong className="text-foreground">{fmt(costUnit)}</strong>
                                {qty > 1 && <span className="text-xs text-muted-foreground ml-1">(total bulto: {fmt(item.precio_unit!)})</span>}
                              </span>
                            )}
                            {sell && (
                              <span className="text-muted-foreground">
                                Mostrador: <strong className="text-foreground">{fmt(sell)}</strong>
                                {qty > 1 && <span className="text-xs text-muted-foreground ml-1">(×{qty}: {fmt(sell * qty)})</span>}
                              </span>
                            )}
                            {rent !== null && (
                              <span className="text-muted-foreground">Rent: <strong className={cn(rent >= 20 ? 'text-green-600' : 'text-red-600')}>{rent.toFixed(1)}%</strong></span>
                            )}
                          </div>
                        </div>
                      )
                    })()}

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

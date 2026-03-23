'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Upload, FileText, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import type { Branch } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  branches: Branch[]
  profileBranchId: string | null
  isDirector: boolean
}

interface ParsedRow {
  name: string
  category: string
  barcode: string
  cost_price: number
  sell_price: number
  quantity: number
  min_quantity: number
  error?: string
}

const TEMPLATE_CSV = `nombre,categoria,codigo_barras,precio_costo,precio_venta,stock_actual,stock_minimo
Coca Cola 500ml,Bebidas,7790895000122,500,900,24,6
Sprite 500ml,Bebidas,7790895000139,480,850,12,6
Alfajor Oreo,Golosinas,7622210678690,250,450,30,10
`

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []

  // Detect separator (comma or semicolon)
  const sep = lines[0].includes(';') ? ';' : ','

  // Skip header
  return lines.slice(1).map((line, i) => {
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
    const [name, category, barcode, cost_price_raw, sell_price_raw, quantity_raw, min_quantity_raw] = cols

    const cost_price = parseFloat(cost_price_raw?.replace(',', '.') ?? '0')
    const sell_price = parseFloat(sell_price_raw?.replace(',', '.') ?? '0')
    const quantity = parseInt(quantity_raw ?? '0')
    const min_quantity = parseInt(min_quantity_raw ?? '0')

    const errors: string[] = []
    if (!name) errors.push('nombre requerido')
    if (isNaN(sell_price) || sell_price <= 0) errors.push('precio venta inválido')
    if (isNaN(quantity)) errors.push('stock inválido')

    return {
      name: name ?? `Fila ${i + 2}`,
      category: category ?? '',
      barcode: barcode ?? '',
      cost_price: isNaN(cost_price) ? 0 : cost_price,
      sell_price: isNaN(sell_price) ? 0 : sell_price,
      quantity: isNaN(quantity) ? 0 : quantity,
      min_quantity: isNaN(min_quantity) ? 0 : min_quantity,
      error: errors.length > 0 ? errors.join(', ') : undefined,
    }
  })
}

export function BulkImportDialog({ open, onClose, branches, profileBranchId, isDirector }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [selectedBranch, setSelectedBranch] = useState(profileBranchId ?? branches[0]?.id ?? '')
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        toast.error('No se encontraron filas válidas. Revisá el formato del archivo.')
        return
      }
      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    const validRows = rows.filter((r) => !r.error)
    if (validRows.length === 0) {
      toast.error('No hay filas válidas para importar')
      return
    }
    if (!selectedBranch) {
      toast.error('Seleccioná una sucursal')
      return
    }

    setImporting(true)
    let count = 0

    for (const row of validRows) {
      // Upsert product by name (or barcode if provided)
      let productId: string | null = null

      // Check if product with same name exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('name', row.name)
        .maybeSingle()

      if (existing?.id) {
        productId = existing.id
        await supabase.from('products').update({
          category: row.category || undefined,
          barcode: row.barcode || undefined,
          cost_price: row.cost_price || undefined,
          sell_price: row.sell_price,
        }).eq('id', productId)
      } else {
        const { data: newProduct } = await supabase
          .from('products')
          .insert({
            name: row.name,
            category: row.category || null,
            barcode: row.barcode || null,
            cost_price: row.cost_price || null,
            sell_price: row.sell_price,
          })
          .select('id')
          .single()
        productId = newProduct?.id ?? null
      }

      if (!productId) continue

      // Upsert stock for this branch
      const { data: existingStock } = await supabase
        .from('stock')
        .select('id')
        .eq('product_id', productId)
        .eq('branch_id', selectedBranch)
        .maybeSingle()

      if (existingStock?.id) {
        await supabase.from('stock').update({
          quantity: row.quantity,
          min_quantity: row.min_quantity,
        }).eq('id', existingStock.id)
      } else {
        await supabase.from('stock').insert({
          product_id: productId,
          branch_id: selectedBranch,
          quantity: row.quantity,
          min_quantity: row.min_quantity,
        })
      }

      count++
    }

    setImportedCount(count)
    setImporting(false)
    setStep('done')
  }

  function handleClose() {
    setRows([])
    setStep('upload')
    setImportedCount(0)
    onClose()
    if (step === 'done') window.location.reload()
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_productos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount = rows.filter((r) => !r.error).length
  const errorCount = rows.filter((r) => r.error).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Importar productos masivamente</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Subí un archivo CSV con tus productos. Podés exportarlo desde Excel o Google Sheets.
              Las columnas requeridas son: <span className="font-medium text-foreground">nombre, precio_venta</span>. El resto es opcional.
            </p>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-neutral-400 hover:bg-neutral-50 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Arrastrá tu archivo CSV aquí</p>
              <p className="text-xs text-muted-foreground mt-1">o hacé click para seleccionar</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>

            {/* Columnas */}
            <div className="rounded-lg border border-border p-4 bg-neutral-50 space-y-2">
              <p className="text-xs font-medium">Columnas esperadas (en este orden):</p>
              <div className="flex flex-wrap gap-1.5">
                {['nombre *', 'categoria', 'codigo_barras', 'precio_costo', 'precio_venta *', 'stock_actual', 'stock_minimo'].map((col) => (
                  <Badge key={col} variant="outline" className={cn('text-[10px]', col.includes('*') && 'border-black')}>
                    {col}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Separador: coma (,) o punto y coma (;). Primera fila = encabezado.</p>
            </div>

            <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Descargar plantilla de ejemplo
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col gap-4 pt-2 min-h-0">
            {/* Summary */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {validCount} productos válidos
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {errorCount} con errores (se omitirán)
                </div>
              )}

              {/* Branch selector */}
              {(isDirector || branches.length > 1) && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sucursal destino:</span>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="text-xs border border-border rounded-md px-2 py-1 bg-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Table preview */}
            <div className="overflow-auto flex-1 border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-neutral-50 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Nombre</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Categoría</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">P. Costo</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">P. Venta</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Mín.</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, i) => (
                    <tr key={i} className={cn(row.error && 'bg-red-50/50 opacity-60')}>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{row.category || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.cost_price > 0 ? `$${row.cost_price}` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">${row.sell_price}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.min_quantity}</td>
                      <td className="px-3 py-2 text-right">
                        {row.error ? (
                          <span className="text-red-500 text-[10px]" title={row.error}>
                            <X className="w-3.5 h-3.5 inline" /> {row.error}
                          </span>
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setStep('upload')}>
                Cambiar archivo
              </Button>
              <Button
                size="sm"
                className="text-xs bg-black text-white hover:bg-neutral-800 gap-1.5"
                disabled={validCount === 0 || importing}
                onClick={handleImport}
              >
                <Upload className="w-3.5 h-3.5" />
                {importing ? 'Importando...' : `Importar ${validCount} productos`}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-semibold">Importación completada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Se importaron <span className="font-medium text-foreground">{importedCount} productos</span> correctamente.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Si el producto ya existía, se actualizó el precio y stock.
              </p>
            </div>
            <Button size="sm" className="bg-black text-white hover:bg-neutral-800 text-xs" onClick={handleClose}>
              Ver inventario
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

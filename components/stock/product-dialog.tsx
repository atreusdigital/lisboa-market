'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Branch, Product, Stock } from '@/types'

const CATEGORIES = [
  'Bebidas', 'Snacks', 'Lácteos', 'Fiambres', 'Conservas', 'Limpieza',
  'Higiene', 'Alcohol', 'Cigarrillos', 'Congelados', 'Panadería', 'General'
]

interface Props {
  open: boolean
  onClose: () => void
  branches: Branch[]
  profileBranchId: string | null
  isDirector: boolean
  userId: string
  editProduct?: Product & { bulk_quantity?: number; bulk_cost?: number }
  editStockItem?: Stock
}

export function ProductDialog({ open, onClose, branches, profileBranchId, isDirector, userId, editProduct, editStockItem }: Props) {
  const supabase = createClient()
  const isEditing = !!editProduct
  const [loading, setLoading] = useState(false)
  const [isStar, setIsStar] = useState(editProduct?.is_star ?? false)
  const [bulkMode, setBulkMode] = useState(!!(editProduct?.bulk_quantity && editProduct.bulk_quantity > 1))
  const [form, setForm] = useState({
    name: editProduct?.name ?? '',
    category: editProduct?.category ?? 'General',
    barcode: editProduct?.barcode ?? '',
    cost_price: editProduct?.cost_price ? String(editProduct.cost_price) : '',
    sell_price: editProduct?.sell_price ? String(editProduct.sell_price) : '',
    branch_id: editStockItem?.branch_id ?? profileBranchId ?? '',
    quantity: editStockItem?.quantity !== undefined ? String(editStockItem.quantity) : '0',
    min_quantity: editStockItem?.min_quantity !== undefined ? String(editStockItem.min_quantity) : '5',
    bulk_quantity: editProduct?.bulk_quantity ? String(editProduct.bulk_quantity) : '1',
    bulk_cost: editProduct?.bulk_cost ? String(editProduct.bulk_cost) : '',
  })

  function update(key: string, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value }
      // Auto-calcular costo unitario desde bulto
      if ((key === 'bulk_cost' || key === 'bulk_quantity') && bulkMode) {
        const bc = parseFloat(key === 'bulk_cost' ? value : updated.bulk_cost)
        const bq = parseInt(key === 'bulk_quantity' ? value : updated.bulk_quantity)
        if (bc > 0 && bq > 0) updated.cost_price = String((bc / bq).toFixed(2))
      }
      return updated
    })
  }

  // Margen calculado en tiempo real
  const margin = form.cost_price && form.sell_price
    ? Math.round(((parseFloat(form.sell_price) - parseFloat(form.cost_price)) / parseFloat(form.sell_price)) * 100)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.sell_price) {
      toast.error('Nombre y precio de venta son requeridos')
      return
    }
    setLoading(true)

    try {
      const productData: Record<string, unknown> = {
        name: form.name,
        category: form.category,
        barcode: form.barcode || null,
        cost_price: parseFloat(form.cost_price) || 0,
        sell_price: parseFloat(form.sell_price),
        is_star: isStar,
        ...(bulkMode && {
          bulk_quantity: parseInt(form.bulk_quantity) || 1,
          bulk_cost: form.bulk_cost ? parseFloat(form.bulk_cost) : null,
        }),
      }

      if (isEditing && editProduct) {
        // Registrar historial de precios si cambiaron
        const costChanged = parseFloat(form.cost_price) !== editProduct.cost_price
        const sellChanged = parseFloat(form.sell_price) !== editProduct.sell_price
        if (costChanged || sellChanged) {
          await supabase.from('price_history').insert({
            product_id: editProduct.id,
            old_cost_price: editProduct.cost_price,
            new_cost_price: parseFloat(form.cost_price) || 0,
            old_sell_price: editProduct.sell_price,
            new_sell_price: parseFloat(form.sell_price),
            changed_by: userId,
          })
        }

        await supabase.from('products').update(productData).eq('id', editProduct.id)

        if (editStockItem) {
          await supabase.from('stock').update({
            quantity: parseInt(form.quantity),
            min_quantity: parseInt(form.min_quantity),
          }).eq('id', editStockItem.id)
        }

        toast.success('Producto actualizado')
      } else {
        // Crear nuevo producto
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('name', form.name)
          .maybeSingle()

        let productId: string

        if (existingProduct) {
          productId = existingProduct.id
          await supabase.from('products').update(productData).eq('id', productId)
        } else {
          const { data: newProduct, error } = await supabase.from('products').insert(productData).select().single()
          if (error) throw error
          productId = newProduct.id
        }

        const branchId = isDirector ? form.branch_id : profileBranchId
        if (!branchId) throw new Error('No hay sucursal seleccionada')

        const { data: existingStock } = await supabase
          .from('stock')
          .select('id')
          .eq('product_id', productId)
          .eq('branch_id', branchId)
          .maybeSingle()

        if (existingStock) {
          await supabase.from('stock').update({
            quantity: parseInt(form.quantity),
            min_quantity: parseInt(form.min_quantity),
          }).eq('id', existingStock.id)
        } else {
          await supabase.from('stock').insert({
            product_id: productId,
            branch_id: branchId,
            quantity: parseInt(form.quantity),
            min_quantity: parseInt(form.min_quantity),
          })
        }

        toast.success('Producto guardado correctamente')
      }

      onClose()
      window.location.reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Error desconocido'
      toast.error(`Error al guardar: ${msg}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isEditing ? `Editar: ${editProduct.name}` : 'Nuevo producto'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Ej: Coca Cola 1.5L"
              className="h-9 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => v && update('category', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Código de barras</Label>
              <Input
                value={form.barcode}
                onChange={(e) => update('barcode', e.target.value)}
                placeholder="Opcional"
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Precio por bulto toggle */}
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setBulkMode(!bulkMode)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <span>📦 Precio por bulto / caja</span>
              <span className="text-muted-foreground">{bulkMode ? 'Activado ✓' : 'Calcular automático'}</span>
            </button>
            {bulkMode && (
              <div className="p-3 grid grid-cols-2 gap-3 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs">Unidades por bulto</Label>
                  <Input
                    type="number"
                    value={form.bulk_quantity}
                    onChange={(e) => update('bulk_quantity', e.target.value)}
                    placeholder="24"
                    min="1"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Precio del bulto ($)</Label>
                  <Input
                    type="number"
                    value={form.bulk_cost}
                    onChange={(e) => update('bulk_cost', e.target.value)}
                    placeholder="0"
                    min="0"
                    className="h-9 text-sm"
                  />
                </div>
                {form.bulk_cost && form.bulk_quantity && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    → Costo unitario: <strong>${(parseFloat(form.bulk_cost) / parseInt(form.bulk_quantity)).toFixed(2)}</strong> (calculado automático)
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Precio costo ($)</Label>
              <Input
                type="number"
                value={form.cost_price}
                onChange={(e) => update('cost_price', e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Precio venta ($) *</Label>
              <Input
                type="number"
                value={form.sell_price}
                onChange={(e) => update('sell_price', e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="h-9 text-sm"
                required
              />
            </div>
          </div>

          {/* Margen en tiempo real */}
          {margin !== null && (
            <div className={cn('text-xs px-3 py-2 rounded-lg', margin >= 30 ? 'bg-green-50 text-green-700' : margin >= 15 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
              Margen: <strong>{margin}%</strong>
              {margin < 15 ? ' — bajo, revisá el precio' : margin >= 30 ? ' — buen margen ✓' : ' — margen aceptable'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Stock {isEditing ? 'actual' : 'inicial'}</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                min="0"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stock mínimo</Label>
              <Input
                type="number"
                value={form.min_quantity}
                onChange={(e) => update('min_quantity', e.target.value)}
                min="0"
                className="h-9 text-sm"
              />
            </div>
          </div>

          {isDirector && !isEditing && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sucursal</Label>
              <Select value={form.branch_id} onValueChange={(v) => v && update('branch_id', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <span>{branches.find(b => b.id === form.branch_id)?.name ?? 'Seleccionar sucursal'}</span>
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsStar(!isStar)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors w-full ${
              isStar
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-border bg-white text-muted-foreground hover:border-amber-200 hover:text-amber-600'
            }`}
          >
            <span className="text-base">{isStar ? '⭐' : '☆'}</span>
            <div className="text-left">
              <p className="font-medium">Producto estrella</p>
              <p className="text-[11px] opacity-70">No puede faltar nunca — alerta crítica si baja el mínimo</p>
            </div>
          </button>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 h-9 text-sm bg-black text-white hover:bg-neutral-800" disabled={loading}>
              {loading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

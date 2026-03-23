'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Supplier, Branch, Product, Profile } from '@/types'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

const LISBOA_GREEN = '#1C2B23'

interface OrderItem {
  product_id: string
  product_name: string
  quantity_ordered: number
  unit_price: number
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
  const [loading, setLoading] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [branchId, setBranchId] = useState(profile.branch_id ?? '')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])

  function addItem() {
    setItems((prev) => [
      ...prev,
      { product_id: '', product_name: '', quantity_ordered: 1, unit_price: 0 },
    ])
  }

  function updateItem(index: number, key: keyof OrderItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (key === 'product_id') {
          const product = products.find((p) => p.id === value)
          return {
            ...item,
            product_id: value as string,
            product_name: product?.name ?? '',
            unit_price: product?.cost_price ?? 0,
          }
        }
        return { ...item, [key]: value }
      })
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const total = items.reduce((sum, item) => sum + item.quantity_ordered * item.unit_price, 0)
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId || !branchId || items.length === 0) {
      toast.error('Completá todos los campos y agregá al menos un producto')
      return
    }
    setLoading(true)

    try {
      const { data: order, error: orderError } = await supabase
        .from('supplier_orders')
        .insert({
          supplier_id: supplierId,
          branch_id: branchId,
          user_id: profile.id,
          status: 'pending',
          total,
          notes: notes || null,
        })
        .select()
        .single()

      if (orderError) throw orderError

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_price: item.unit_price,
      }))

      await supabase.from('supplier_order_items').insert(orderItems)

      // Actualizar cuenta corriente
      const { data: account } = await supabase
        .from('accounts_payable')
        .select('id, balance')
        .eq('supplier_id', supplierId)
        .eq('branch_id', branchId)
        .maybeSingle()

      if (account) {
        await supabase
          .from('accounts_payable')
          .update({ balance: account.balance + total })
          .eq('id', account.id)
      } else {
        await supabase.from('accounts_payable').insert({
          supplier_id: supplierId,
          branch_id: branchId,
          balance: total,
        })
      }

      // Crear alerta de pago
      const supplier = suppliers.find((s) => s.id === supplierId)
      const branch = branches.find((b) => b.id === branchId)
      await supabase.from('alerts').insert({
        type: 'payment_due',
        branch_id: branchId,
        message: `Pago pendiente a ${supplier?.name}: ${formatCurrency(total)} — Sucursal ${branch?.name}. Generar transferencia.`,
      })

      // Log
      await supabase.from('activity_log').insert({
        user_id: profile.id,
        action: 'create_order',
        entity_type: 'supplier_orders',
        entity_id: order.id,
        metadata: { supplier: supplier?.name, total, items_count: items.length },
      })

      toast.success('Pedido registrado. Se generó una alerta de pago.')
      onClose()
      window.location.reload()
    } catch (err) {
      toast.error('Error al registrar el pedido')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Nuevo pedido a proveedor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Proveedor *</Label>
              <Select value={supplierId} onValueChange={(v) => v && setSupplierId(v)} required>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar" />
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
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {/* Ítems */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Productos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-6 text-xs gap-1">
                <Plus className="w-3 h-3" /> Agregar
              </Button>
            </div>

            {items.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                Agregá los productos del pedido
              </p>
            )}

            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <Select value={item.product_id ?? ''} onValueChange={(v) => updateItem(i, 'product_id', v ?? '')}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id ?? ''}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={item.quantity_ordered}
                  onChange={(e) => updateItem(i, 'quantity_ordered', parseInt(e.target.value) || 1)}
                  min="1"
                  className="h-8 text-xs w-16 text-center"
                  placeholder="Cant."
                />
                <Input
                  type="number"
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="h-8 text-xs w-24"
                  placeholder="Precio $"
                />
                <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="flex justify-between items-center py-2 border-t border-border">
              <span className="text-sm font-medium">Total del pedido</span>
              <span className="text-lg font-bold">{formatCurrency(total)}</span>
            </div>
          )}

          {supplierId && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Se generará una <strong>alerta de pago inmediato</strong> para que Sebastián realice la transferencia al momento de la entrega.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 h-9 text-sm text-white"
              style={{ backgroundColor: LISBOA_GREEN }}
              disabled={loading}
            >
              {loading ? 'Registrando...' : 'Registrar pedido'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

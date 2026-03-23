'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Stock, Profile } from '@/types'
import { TrendingUp, TrendingDown, Package, ShoppingCart } from 'lucide-react'

const LISBOA_GREEN = '#1C2B23'

interface Movement {
  id: string
  type: 'delivery' | 'manual_up' | 'manual_down' | 'sale'
  quantity: number
  notes: string | null
  created_at: string
  user?: { full_name: string }
}

const movementConfig = {
  delivery: { label: 'Entrega proveedor', color: 'bg-blue-100 text-blue-700', icon: Package },
  manual_up: { label: 'Ingreso manual', color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp },
  manual_down: { label: 'Egreso manual', color: 'bg-amber-100 text-amber-700', icon: TrendingDown },
  sale: { label: 'Venta', color: 'bg-neutral-100 text-neutral-600', icon: ShoppingCart },
}

interface Props {
  open: boolean
  onClose: () => void
  stockItem: Stock
  profile: Profile
}

export function StockMovementsDialog({ open, onClose, stockItem, profile }: Props) {
  const supabase = createClient()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) loadMovements()
  }, [open])

  async function loadMovements() {
    setLoading(true)
    const { data } = await supabase
      .from('stock_movements')
      .select('*, user:profiles(full_name)')
      .eq('product_id', stockItem.product_id)
      .eq('branch_id', stockItem.branch_id)
      .order('created_at', { ascending: false })
      .limit(30)
    setMovements(data ?? [])
    setLoading(false)
  }

  async function handleMovement(type: 'manual_up' | 'manual_down') {
    const quantity = parseInt(qty)
    if (!quantity || quantity <= 0) { toast.error('Ingresá una cantidad válida'); return }

    setSaving(true)
    const delta = type === 'manual_up' ? quantity : -quantity
    const newQty = stockItem.quantity + delta

    if (newQty < 0) { toast.error('El stock no puede quedar negativo'); setSaving(false); return }

    const { error: movErr } = await supabase.from('stock_movements').insert({
      product_id: stockItem.product_id,
      branch_id: stockItem.branch_id,
      user_id: profile.id,
      type,
      quantity: type === 'manual_up' ? quantity : -quantity,
      notes: notes || null,
    })

    if (movErr) { toast.error('Error al registrar movimiento'); setSaving(false); return }

    const { error: stockErr } = await supabase
      .from('stock')
      .update({ quantity: newQty })
      .eq('id', stockItem.id)

    if (stockErr) { toast.error('Error al actualizar stock'); setSaving(false); return }

    toast.success(type === 'manual_up' ? `+${quantity} unidades registradas` : `-${quantity} unidades descontadas`)
    setQty('')
    setNotes('')
    setSaving(false)
    await loadMovements()
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {stockItem.product?.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Stock actual: <span className="font-semibold">{stockItem.quantity}</span> unidades — {stockItem.branch?.name}
          </p>
        </DialogHeader>

        <Tabs defaultValue="history">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="history" className="text-xs h-7 flex-1">Historial</TabsTrigger>
            <TabsTrigger value="adjust" className="text-xs h-7 flex-1">Ajuste manual</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-3">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos registrados</p>
            ) : (
              <div className="space-y-1">
                {movements.map((mov) => {
                  const cfg = movementConfig[mov.type]
                  const Icon = cfg.icon
                  return (
                    <div key={mov.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                      <div className={cn('p-1.5 rounded', cfg.color)}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">{cfg.label}</p>
                          <span className={cn('text-sm font-semibold tabular-nums', mov.quantity > 0 ? 'text-emerald-600' : 'text-red-600')}>
                            {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                          </span>
                        </div>
                        {mov.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{mov.notes}</p>}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {mov.user?.full_name} · {new Date(mov.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="adjust" className="mt-3 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Ej: 10"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Conteo físico, merma..."
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-9 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => handleMovement('manual_up')}
                disabled={saving}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Sumar stock
              </Button>
              <Button
                variant="outline"
                className="h-9 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => handleMovement('manual_down')}
                disabled={saving}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Restar stock
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banknote, CreditCard, ArrowLeft, Star } from 'lucide-react'
import Link from 'next/link'

interface SaleItem {
  id: string
  quantity: number
  unit_price: number
  product?: { name: string; category: string; sell_price: number; is_star?: boolean }
}

interface Sale {
  id: string
  total: number
  payment_method: string
  created_at: string
  branch?: { name: string }
  user?: { full_name: string; role: string }
}

interface Props {
  sale: Sale
  items: SaleItem[]
}

const roleLabels: Record<string, string> = {
  director: 'Dueño',
  admin: 'Encargado',
  empleado: 'Empleado',
}

export function SaleDetail({ sale, items }: Props) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/sales">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </Button>
        </Link>
        <div>
          <h2 className="text-lg font-semibold">Venta #{sale.id.slice(0, 8).toUpperCase()}</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(sale.created_at).toLocaleDateString('es-AR', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {/* Info general */}
      <Card className="p-5 border-border">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Sucursal</p>
            <p className="text-sm font-medium mt-0.5">{sale.branch?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vendedor</p>
            <p className="text-sm font-medium mt-0.5">{sale.user?.full_name ?? '—'}</p>
            {sale.user?.role && (
              <p className="text-xs text-muted-foreground">{roleLabels[sale.user.role] ?? sale.user.role}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Método de pago</p>
            <div className="mt-1">
              {sale.payment_method === 'efectivo' ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                  <Banknote className="w-3 h-3" /> Efectivo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                  <CreditCard className="w-3 h-3" /> MercadoPago
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{formatCurrency(sale.total)}</p>
          </div>
        </div>
      </Card>

      {/* Ítems */}
      <Card className="border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-neutral-50 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Productos vendidos
          </p>
          <Badge variant="outline" className="text-xs">{items.length} ítem{items.length !== 1 ? 's' : ''}</Badge>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {item.product?.is_star && <span className="mr-1 text-amber-500">⭐</span>}
                  {item.product?.name ?? 'Producto eliminado'}
                </p>
                <p className="text-xs text-muted-foreground">{item.product?.category}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium tabular-nums">×{item.quantity}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.unit_price)} c/u</p>
              </div>
              <div className="text-right w-24 shrink-0">
                <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.quantity * item.unit_price)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border bg-neutral-50 flex items-center justify-between">
          <p className="text-sm font-semibold">Total</p>
          <p className="text-base font-bold tabular-nums">{formatCurrency(subtotal)}</p>
        </div>
      </Card>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { Alert, Profile } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Package, TrendingDown, DollarSign, CheckCircle, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const LISBOA_GREEN = '#1C2B23'

const alertConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  low_stock: { label: 'Stock bajo', icon: Package, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  high_demand_low_stock: { label: 'Alta demanda + poco stock', icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  stagnant_product: { label: 'Producto estancado', icon: AlertTriangle, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  payment_due: { label: 'Pago pendiente', icon: DollarSign, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  cash_anomaly: { label: 'Anomalía de caja', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
}

interface Props {
  alerts: Alert[]
  profile: Profile
}

export function AlertsModule({ alerts, profile }: Props) {
  const [statusFilter, setStatusFilter] = useState('active')
  const [typeFilter, setTypeFilter] = useState('all')
  const supabase = createClient()

  const filtered = alerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false
    if (typeFilter !== 'all' && alert.type !== typeFilter) return false
    return true
  })

  const activeCount = alerts.filter((a) => a.status === 'active').length

  async function resolveAlert(alertId: string) {
    const { error } = await supabase
      .from('alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', alertId)

    if (error) { toast.error('Error al resolver alerta'); return }
    toast.success('Alerta resuelta')
    window.location.reload()
  }

  async function resolveAll() {
    const activeIds = alerts.filter((a) => a.status === 'active').map((a) => a.id)
    if (activeIds.length === 0) return

    const { error } = await supabase
      .from('alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .in('id', activeIds)

    if (error) { toast.error('Error'); return }
    toast.success(`${activeIds.length} alertas resueltas`)
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Centro de alertas</h2>
          <p className="text-sm text-muted-foreground">
            {activeCount > 0
              ? <span className="text-red-600 font-medium">{activeCount} alertas activas</span>
              : 'Sin alertas activas'}
          </p>
        </div>
        {activeCount > 0 && (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={resolveAll}>
            Resolver todas
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="resolved">Resueltas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="h-8 text-xs w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="low_stock">Stock bajo</SelectItem>
            <SelectItem value="high_demand_low_stock">Alta demanda</SelectItem>
            <SelectItem value="stagnant_product">Producto estancado</SelectItem>
            <SelectItem value="payment_due">Pago pendiente</SelectItem>
            <SelectItem value="cash_anomaly">Anomalía de caja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-border bg-white">
          <Bell className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
          <p className="text-sm font-medium">Sin alertas</p>
          <p className="text-xs text-muted-foreground mt-1">No hay alertas con los filtros seleccionados</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((alert) => {
            const config = alertConfig[alert.type] ?? alertConfig.low_stock
            const Icon = config.icon
            const isResolved = alert.status === 'resolved'

            return (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-lg border',
                  isResolved ? 'bg-neutral-50 border-border opacity-60' : config.bg
                )}
              >
                <div className={cn('shrink-0 mt-0.5', isResolved ? 'text-neutral-400' : config.color)}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] border-0', isResolved ? 'bg-neutral-200 text-neutral-600' : `${config.bg} ${config.color}`)}
                    >
                      {config.label}
                    </Badge>
                    {alert.branch?.name && (
                      <span className="text-[11px] text-muted-foreground">{alert.branch.name}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(alert.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm mt-1 leading-relaxed">{alert.message}</p>
                  {alert.product?.name && (
                    <p className="text-xs text-muted-foreground mt-0.5">Producto: {alert.product.name}</p>
                  )}
                </div>
                {!isResolved && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0 gap-1"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    <CheckCircle className="w-3 h-3" />
                    Resolver
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

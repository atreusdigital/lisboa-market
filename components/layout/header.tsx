'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface AlertItem {
  id: string
  type: string
  message: string
  status: string
  created_at: string
}

interface HeaderProps {
  title: string
  alertCount?: number
  userId?: string
}

const alertTypeLabel: Record<string, string> = {
  low_stock: 'Stock bajo',
  high_demand_low_stock: 'Alta demanda',
  stagnant_product: 'Producto estancado',
  payment_due: 'Pago pendiente',
  cash_anomaly: 'Anomalía de caja',
}

export function Header({ title, alertCount = 0, userId }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function loadAlerts() {
    setLoading(true)
    const { data } = await supabase
      .from('alerts')
      .select('id, type, message, status, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)
    setAlerts(data ?? [])
    setLoading(false)
  }

  async function resolveAlert(alertId: string) {
    await supabase.from('alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', alertId)
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-white sticky top-0 z-10">
      <h1 className="text-sm font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) loadAlerts() }}>
          <PopoverTrigger className="relative p-2 rounded-md hover:bg-neutral-100 transition-colors">
            <Bell className="w-4 h-4 text-neutral-600" />
            {alertCount > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] bg-black text-white border-0 flex items-center justify-center">
                {alertCount > 9 ? '9+' : alertCount}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Notificaciones</p>
              <p className="text-xs text-muted-foreground">{alertCount} alertas activas</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
              ) : alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin notificaciones</p>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {alertTypeLabel[alert.type] ?? alert.type}
                        </p>
                        <p className="text-xs mt-0.5 leading-relaxed">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {alerts.length > 0 && (
              <div className="px-4 py-2 border-t border-border">
                <a href="/alerts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Ver todas las alertas →
                </a>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}

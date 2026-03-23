'use client'

import { StatsCard } from './stats-card'
import { ShoppingCart, DollarSign, Package, Bell } from 'lucide-react'
import type { Profile, DashboardStats } from '@/types'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Props {
  profile: Profile
  stats: DashboardStats
}

export function DashboardAdmin({ profile, stats }: Props) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Hola, {profile.full_name.split(' ')[0]}</h2>
        <p className="text-sm text-muted-foreground">
          Sucursal {profile.branch?.name ?? ''} — resumen de hoy
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Ventas hoy" value={stats.total_sales_today} icon={ShoppingCart} />
        <StatsCard
          title="Facturación"
          value={formatCurrency(stats.total_revenue_today)}
          icon={DollarSign}
        />
        <StatsCard
          title="Stock bajo"
          value={stats.low_stock_count}
          subtitle={stats.low_stock_count > 0 ? 'reponer' : 'ok'}
          icon={Package}
          trend={stats.low_stock_count > 0 ? 'down' : 'neutral'}
        />
        <StatsCard
          title="Alertas"
          value={stats.active_alerts}
          icon={Bell}
          trend={stats.active_alerts > 0 ? 'down' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 bg-black text-white border-0">
          <Package className="w-5 h-5 mb-3 opacity-60" />
          <p className="text-sm font-medium">Registrar pedido</p>
          <p className="text-xs opacity-60 mt-1">Escaneá la foto del pedido con IA</p>
          <Link href="/suppliers">
            <Button size="sm" variant="outline" className="mt-3 border-white/30 text-white bg-transparent hover:bg-white/10 text-xs h-7">
              Nuevo pedido
            </Button>
          </Link>
        </Card>

        <Card className="p-5 bg-white border-border">
          <Bell className="w-5 h-5 mb-3 text-neutral-400" />
          <p className="text-sm font-medium">{stats.active_alerts} alertas activas</p>
          <p className="text-xs text-muted-foreground mt-1">Revisá las alertas de tu sucursal</p>
          <Link href="/alerts">
            <Button variant="link" className="px-0 text-xs h-auto mt-2 text-muted-foreground hover:text-black">
              Ver alertas →
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { StatsCard } from './stats-card'
import { ShoppingCart, DollarSign, Package, Bell, Truck } from 'lucide-react'
import type { Profile, DashboardStats } from '@/types'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Props {
  profile: Profile
  stats: DashboardStats
}

export function DashboardDirector({ profile, stats }: Props) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Buen día, {profile.full_name.split(' ')[0]}</h2>
        <p className="text-sm text-muted-foreground">Resumen general de hoy — todas las sucursales</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <StatsCard
          title="Ventas hoy"
          value={stats.total_sales_today}
          subtitle="transacciones"
          icon={ShoppingCart}
        />
        <StatsCard
          title="Facturación hoy"
          value={formatCurrency(stats.total_revenue_today)}
          subtitle="todas las sucursales"
          icon={DollarSign}
          trend="neutral"
        />
        <StatsCard
          title="Stock bajo"
          value={stats.low_stock_count}
          subtitle={stats.low_stock_count > 0 ? 'requieren reposición' : 'todo en orden'}
          icon={Package}
          trend={stats.low_stock_count > 0 ? 'down' : 'neutral'}
        />
        <StatsCard
          title="Alertas activas"
          value={stats.active_alerts}
          subtitle={stats.active_alerts > 0 ? 'pendientes de revisión' : 'sin alertas'}
          icon={Bell}
          trend={stats.active_alerts > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <Card className="p-5 border-border bg-white">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pedidos pendientes</p>
          <p className="text-2xl font-semibold">{stats.pending_orders}</p>
          <Link href="/suppliers">
            <Button variant="link" className="px-0 text-xs h-auto mt-2 text-muted-foreground hover:text-black">
              Ver proveedores →
            </Button>
          </Link>
        </Card>

        <Card className="p-5 border-border bg-black text-white flex flex-col items-center text-center">
          <Truck className="w-5 h-5 mb-3 opacity-60" />
          <p className="text-sm font-medium">Registrar pedido</p>
          <p className="text-xs opacity-60 mt-1">Escanear con IA</p>
          <Link href="/suppliers">
            <Button variant="outline" size="sm" className="mt-3 bg-transparent border-white/30 text-white hover:bg-white/10 text-xs h-7">
              Nuevo pedido
            </Button>
          </Link>
        </Card>

        <Card className="p-5 border-border bg-white">
          <Bell className="w-5 h-5 mb-3 text-neutral-400" />
          <p className="text-sm font-medium">Ver alertas</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.active_alerts} activas</p>
          <Link href="/alerts">
            <Button variant="link" className="px-0 text-xs h-auto mt-2 text-muted-foreground hover:text-black">
              Ver todas →
            </Button>
          </Link>
        </Card>
      </div>

      {/* Branch comparison */}
      <Card className="p-5 border-border bg-white">
        <h3 className="text-sm font-semibold mb-4">Sucursales</h3>
        <div className="grid grid-cols-2 gap-4">
          {['Caballito', 'Villa Luro'].map((branch) => (
            <div key={branch} className="border border-border rounded-lg p-4">
              <p className="text-sm font-medium">{branch}</p>
              <p className="text-xs text-muted-foreground mt-1">Ver detalles en Reportes</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

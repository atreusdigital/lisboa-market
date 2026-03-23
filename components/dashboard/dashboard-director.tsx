'use client'

import { StatsCard } from './stats-card'
import { ShoppingCart, DollarSign, Package, Bell, Truck, ArrowRight } from 'lucide-react'
import type { Profile, DashboardStats } from '@/types'
import Link from 'next/link'

interface Props {
  profile: Profile
  stats: DashboardStats
}

export function DashboardDirector({ profile, stats }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="space-y-6">

      {/* Hero greeting */}
      <div className="rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
        style={{ background: '#1D1D1F', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <div>
          <p className="text-white/40 text-sm font-medium mb-1">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {greeting}, {profile.full_name.split(' ')[0]} 👋
          </h2>
          <p className="text-white/50 text-sm mt-1">Resumen general — todas las sucursales</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/pos" className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-black transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: '#FFE600' }}>
            Vender ahora
          </Link>
          <Link href="/ai/assistant" className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-white/80 border border-white/15 hover:bg-white/10 transition-all">
            Preguntar a IA
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatsCard
          title="Ventas hoy"
          value={stats.total_sales_today}
          subtitle="transacciones"
          icon={ShoppingCart}
          accent="#1C2B23"
        />
        <StatsCard
          title="Facturación"
          value={fmt(stats.total_revenue_today)}
          subtitle="todas las sucursales"
          icon={DollarSign}
          trend="neutral"
        />
        <StatsCard
          title="Stock bajo"
          value={stats.low_stock_count}
          subtitle={stats.low_stock_count > 0 ? 'requieren reposición' : 'todo en orden ✓'}
          icon={Package}
          trend={stats.low_stock_count > 0 ? 'down' : 'neutral'}
          accent={stats.low_stock_count > 0 ? '#FF3B30' : undefined}
        />
        <StatsCard
          title="Alertas"
          value={stats.active_alerts}
          subtitle={stats.active_alerts > 0 ? 'pendientes de revisión' : 'sin alertas ✓'}
          icon={Bell}
          trend={stats.active_alerts > 0 ? 'down' : 'neutral'}
          accent={stats.active_alerts > 0 ? '#FF9500' : undefined}
        />
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Sucursales */}
        <div className="md:col-span-2 rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#86868B' }}>Sucursales</p>
          <div className="grid grid-cols-2 gap-3">
            {['Caballito', 'Villa Luro'].map(branch => (
              <div key={branch} className="rounded-xl p-4" style={{ background: '#F5F5F7' }}>
                <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: '#1C2B23' }}>
                  {branch[0]}
                </div>
                <p className="font-semibold text-sm">{branch}</p>
                <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>Kiosco 24hs</p>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-3">
          <Link href="/suppliers" className="rounded-2xl p-5 flex items-center justify-between group hover:scale-[1.02] transition-transform active:scale-[0.98]"
            style={{ background: '#1C2B23', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1">Pedidos</p>
              <p className="text-white font-bold text-xl">{stats.pending_orders}</p>
              <p className="text-white/50 text-xs">pendientes</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <Truck className="w-4 h-4 text-white" strokeWidth={1.75} />
            </div>
          </Link>

          <Link href="/alerts" className="rounded-2xl p-5 flex items-center justify-between group hover:scale-[1.02] transition-transform active:scale-[0.98]"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#86868B' }}>Alertas</p>
              <p className="font-bold text-xl">{stats.active_alerts}</p>
              <p className="text-xs" style={{ color: '#86868B' }}>activas</p>
            </div>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" style={{ color: '#86868B' }} />
          </Link>
        </div>
      </div>
    </div>
  )
}

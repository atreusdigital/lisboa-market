'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Profile, Branch } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts'
import { TrendingUp, TrendingDown, Package, DollarSign } from 'lucide-react'

const LISBOA_GREEN = '#1C2B23'
const LISBOA_GREEN_LIGHT = '#2D4A3E'

interface SaleItem {
  product_id: string
  quantity: number
  unit_price: number
  sale: { branch_id: string; created_at: string } | null
  product: { name: string; category: string } | null
}

interface Sale {
  id: string
  total: number
  payment_method: string
  created_at: string
  branch_id: string
  branch: { name: string } | null
}

interface Props {
  sales: Sale[]
  saleItems: SaleItem[]
  branches: Branch[]
  profile: Profile
}

export function AnalyticsModule({ sales, saleItems, branches, profile }: Props) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  // Ventas por día (últimos 30 días)
  const salesByDay = useMemo(() => {
    const map: Record<string, number> = {}
    sales.forEach((sale) => {
      const day = new Date(sale.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
      map[day] = (map[day] ?? 0) + sale.total
    })
    return Object.entries(map).map(([date, total]) => ({ date, total }))
  }, [sales])

  // Productos más vendidos
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {}
    saleItems.forEach((item) => {
      if (!item.product_id) return
      const name = item.product?.name ?? 'Desconocido'
      if (!map[item.product_id]) {
        map[item.product_id] = { name, category: item.product?.category ?? '', quantity: 0, revenue: 0 }
      }
      map[item.product_id].quantity += item.quantity
      map[item.product_id].revenue += item.quantity * item.unit_price
    })
    return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 10)
  }, [saleItems])

  // Ventas por sucursal
  const salesByBranch = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {}
    sales.forEach((sale) => {
      const name = sale.branch?.name ?? sale.branch_id
      if (!map[sale.branch_id]) map[sale.branch_id] = { name, total: 0, count: 0 }
      map[sale.branch_id].total += sale.total
      map[sale.branch_id].count += 1
    })
    return Object.values(map)
  }, [sales])

  // Totales
  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0)
  const totalSales = sales.length
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0
  const mpSales = sales.filter((s) => s.payment_method === 'mercadopago').length
  const cashSales = sales.filter((s) => s.payment_method === 'efectivo').length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Reportes</h2>
        <p className="text-sm text-muted-foreground">Últimos 30 días</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Facturación total', value: formatCurrency(totalRevenue), icon: DollarSign },
          { label: 'Ventas totales', value: totalSales, icon: TrendingUp },
          { label: 'Ticket promedio', value: formatCurrency(avgTicket), icon: Package },
          { label: 'MercadoPago', value: `${Math.round((mpSales / (totalSales || 1)) * 100)}%`, icon: TrendingDown },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-5 border-border bg-white">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className="text-2xl font-semibold">{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Gráfico de ventas por día */}
      <Card className="p-5 border-border bg-white">
        <h3 className="text-sm font-semibold mb-4">Facturación diaria</h3>
        {salesByDay.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos de ventas</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={salesByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), 'Ventas']}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
              />
              <Bar dataKey="total" fill={LISBOA_GREEN} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Productos más vendidos */}
        <Card className="p-5 border-border bg-white">
          <h3 className="text-sm font-semibold mb-4">Top productos vendidos</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((product, i) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{product.name}</p>
                    <p className="text-[11px] text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold">{product.quantity} u.</p>
                    <p className="text-[11px] text-muted-foreground">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Ventas por sucursal */}
        <Card className="p-5 border-border bg-white">
          <h3 className="text-sm font-semibold mb-4">Ventas por sucursal</h3>
          {salesByBranch.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
          ) : (
            <div className="space-y-4">
              {salesByBranch.map((branch) => {
                const pct = Math.round((branch.total / (totalRevenue || 1)) * 100)
                return (
                  <div key={branch.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{branch.name}</span>
                      <span className="text-muted-foreground">{formatCurrency(branch.total)} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: LISBOA_GREEN }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{branch.count} ventas</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Métodos de pago */}
          <div className="mt-5 pt-4 border-t border-border">
            <h4 className="text-xs font-medium mb-3">Métodos de pago</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-neutral-50">
                <p className="text-lg font-bold">{cashSales}</p>
                <p className="text-xs text-muted-foreground">Efectivo</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: `${LISBOA_GREEN}15` }}>
                <p className="text-lg font-bold">{mpSales}</p>
                <p className="text-xs text-muted-foreground">MercadoPago</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Package, ShoppingCart, Sparkles, Loader2 } from 'lucide-react'

const LISBOA_GREEN = '#1C2B23'

interface ProductStat {
  name: string
  qty: number
  revenue: number
  is_star: boolean
}

interface Props {
  context: string
  topProducts: ProductStat[]
  stagnantCount: number
  todaySalesCount: number
  todayRevenue: number
}

export function RadarClient({ context, topProducts, stagnantCount, todaySalesCount, todayRevenue }: Props) {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  async function generateAnalysis() {
    setLoading(true)
    const res = await fetch('/api/ai/radar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    })
    const { analysis } = await res.json()
    setAnalysis(analysis)
    setLoading(false)
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Radar de ventas</h2>
          <p className="text-sm text-muted-foreground">Análisis de los últimos 7 días</p>
        </div>
        <Button
          onClick={generateAnalysis}
          disabled={loading}
          className="h-8 text-xs gap-1.5 text-white"
          style={{ backgroundColor: LISBOA_GREEN }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Analizando...' : 'Análisis IA'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-border">
          <ShoppingCart className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-2xl font-bold">{todaySalesCount}</p>
          <p className="text-xs text-muted-foreground">Ventas hoy</p>
        </Card>
        <Card className="p-4 border-border">
          <TrendingUp className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(todayRevenue)}</p>
          <p className="text-xs text-muted-foreground">Facturación hoy</p>
        </Card>
        <Card className="p-4 border-border">
          <Package className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-2xl font-bold">{stagnantCount}</p>
          <p className="text-xs text-muted-foreground">Productos estancados</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top productos */}
        <Card className="border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-neutral-50">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top productos — 7 días</p>
          </div>
          <div className="divide-y divide-border">
            {topProducts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin datos de ventas</p>
            ) : topProducts.map((p, i) => (
              <div key={p.name} className="px-4 py-3 flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {p.is_star && <span className="mr-1">⭐</span>}
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(p.revenue)}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{p.qty} uds</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Análisis IA */}
        <Card className="border-border">
          <div className="px-4 py-3 border-b border-border bg-neutral-50 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Análisis IA</p>
          </div>
          <div className="p-4">
            {!analysis && !loading && (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-neutral-300" />
                <p className="text-sm text-muted-foreground">Hacé clic en "Análisis IA" para obtener un resumen inteligente del negocio</p>
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analizando datos...</span>
              </div>
            )}
            {analysis && (
              <div className="text-sm leading-relaxed space-y-2">
                {analysis.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className={line.startsWith('**') ? 'font-semibold' : 'text-muted-foreground'}>
                    {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

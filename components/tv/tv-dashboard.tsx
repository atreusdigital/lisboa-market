'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TopProduct {
  name: string
  qty: number
  total: number
}

interface TVData {
  salesCount: number
  revenue: number
  efectivo: number
  mp: number
  lowStock: number
  criticalStock: number
  topProducts: TopProduct[]
  branchName: string
}

interface Props {
  initialData: TVData
  branchName: string
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)
}

function Clock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      setTime(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDate(now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="text-right">
      <div className="text-4xl font-mono font-bold text-white tracking-tight tabular-nums">{time}</div>
      <div className="text-sm text-white/50 mt-0.5 capitalize">{date}</div>
    </div>
  )
}

export function TVDashboard({ initialData, branchName }: Props) {
  const [data, setData] = useState<TVData>(initialData)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: sales } = await supabase
      .from('sales')
      .select('total, payment_method, branch_id')
      .gte('created_at', today.toISOString())

    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('quantity, unit_price, product:products(name), sale:sales!inner(created_at, branch_id)')
      .gte('sale.created_at', today.toISOString())

    const { data: stockItems } = await supabase
      .from('stock')
      .select('quantity, min_quantity')

    const salesArr = (sales as any[]) ?? []
    const itemsArr = (saleItems as any[]) ?? []
    const stockArr = (stockItems as any[]) ?? []

    // Aggregate top products
    const productMap: Record<string, { qty: number; total: number }> = {}
    itemsArr.forEach((item: any) => {
      const name = Array.isArray(item.product) ? item.product[0]?.name : item.product?.name
      if (!name) return
      if (!productMap[name]) productMap[name] = { qty: 0, total: 0 }
      productMap[name].qty += item.quantity
      productMap[name].total += item.quantity * item.unit_price
    })

    const topProducts = Object.entries(productMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6)

    setData({
      salesCount: salesArr.length,
      revenue: salesArr.reduce((s: number, x: any) => s + x.total, 0),
      efectivo: salesArr.filter((x: any) => x.payment_method === 'efectivo').reduce((s: number, x: any) => s + x.total, 0),
      mp: salesArr.filter((x: any) => x.payment_method === 'mercadopago').reduce((s: number, x: any) => s + x.total, 0),
      lowStock: stockArr.filter((s: any) => s.quantity <= s.min_quantity && s.quantity > 0).length,
      criticalStock: stockArr.filter((s: any) => s.quantity === 0).length,
      topProducts,
      branchName,
    })
    setLastUpdate(new Date())
    setRefreshing(false)
  }, [supabase, branchName])

  useEffect(() => {
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  const mpPct = data.revenue > 0 ? Math.round((data.mp / data.revenue) * 100) : 0
  const efPct = 100 - mpPct

  return (
    <div
      className="min-h-screen w-full flex flex-col p-8 gap-6 select-none"
      style={{ backgroundColor: '#0D1A12', fontFamily: 'var(--font-sans)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="58" fill="#1C2B23" stroke="white" strokeWidth="1.5"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.4"/>
            <path id="tvTopArc" d="M 60,60 m -42,0 a 42,42 0 1,1 84,0" fill="none"/>
            <text fontSize="7.5" fill="white" fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing="2.2">
              <textPath href="#tvTopArc" startOffset="2%">MARKET 24/7 • BEBIDAS • KIOSCO •</textPath>
            </text>
            <path id="tvBottomArc" d="M 18,60 a 42,42 0 0,0 84,0" fill="none"/>
            <text fontSize="7.5" fill="white" fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing="2.2">
              <textPath href="#tvBottomArc" startOffset="2%">MARKET 24/7 • BEBIDAS • KIOSCO •</textPath>
            </text>
            <text x="60" y="67" textAnchor="middle" fontSize="26" fontWeight="700" fill="white" fontFamily="Arial, sans-serif" letterSpacing="-1">L24</text>
          </svg>
          <div>
            <p className="text-white font-bold text-2xl tracking-tight">Lisboa Market</p>
            <p className="text-white/40 text-sm">{branchName}</p>
          </div>
        </div>
        <Clock />
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-3 gap-4">
        {/* Facturación */}
        <div className="rounded-2xl p-6 flex flex-col gap-1" style={{ backgroundColor: '#1C2B23' }}>
          <p className="text-white/40 text-xs uppercase tracking-widest">Facturación hoy</p>
          <p className="text-white text-5xl font-bold tabular-nums tracking-tight">{formatARS(data.revenue)}</p>
          <p className="text-white/40 text-sm mt-1">{data.salesCount} ventas realizadas</p>
        </div>

        {/* Efectivo */}
        <div className="rounded-2xl p-6 flex flex-col gap-1" style={{ backgroundColor: '#1a1a1a' }}>
          <p className="text-white/40 text-xs uppercase tracking-widest">Efectivo</p>
          <p className="text-white text-4xl font-bold tabular-nums tracking-tight">{formatARS(data.efectivo)}</p>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-white/60 transition-all duration-700" style={{ width: `${efPct}%` }} />
          </div>
          <p className="text-white/30 text-xs mt-1">{efPct}% del total</p>
        </div>

        {/* MercadoPago */}
        <div className="rounded-2xl p-6 flex flex-col gap-1" style={{ backgroundColor: '#1a1a1a' }}>
          <p className="text-white/40 text-xs uppercase tracking-widest">MercadoPago</p>
          <p className="text-4xl font-bold tabular-nums tracking-tight" style={{ color: '#FFE600' }}>{formatARS(data.mp)}</p>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,230,0,0.15)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${mpPct}%`, backgroundColor: '#FFE600' }} />
          </div>
          <p className="text-white/30 text-xs mt-1">{mpPct}% del total</p>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-3 gap-4 flex-1">
        {/* Top productos */}
        <div className="col-span-2 rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#1a1a1a' }}>
          <p className="text-white/40 text-xs uppercase tracking-widest">Más vendidos hoy</p>
          {data.topProducts.length === 0 ? (
            <p className="text-white/20 text-sm">Sin ventas registradas aún</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.topProducts.map((p, i) => {
                const maxQty = data.topProducts[0]?.qty ?? 1
                const pct = Math.round((p.qty / maxQty) * 100)
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-white/20 text-sm w-5 text-right tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm font-medium truncate">{p.name}</span>
                        <span className="text-white/40 text-xs tabular-nums shrink-0 ml-2">{p.qty} uds · {formatARS(p.total)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: i === 0 ? '#4ade80' : 'rgba(255,255,255,0.3)' }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Alertas de stock */}
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#1a1a1a' }}>
          <p className="text-white/40 text-xs uppercase tracking-widest">Estado del stock</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: data.criticalStock > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' }}>
              <div>
                <p className={`text-3xl font-bold tabular-nums ${data.criticalStock > 0 ? 'text-red-400' : 'text-white/30'}`}>
                  {data.criticalStock}
                </p>
                <p className="text-white/40 text-xs mt-0.5">Sin stock</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${data.criticalStock > 0 ? 'bg-red-400 animate-pulse' : 'bg-white/10'}`} />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: data.lowStock > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.05)' }}>
              <div>
                <p className={`text-3xl font-bold tabular-nums ${data.lowStock > 0 ? 'text-amber-400' : 'text-white/30'}`}>
                  {data.lowStock}
                </p>
                <p className="text-white/40 text-xs mt-0.5">Stock bajo</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${data.lowStock > 0 ? 'bg-amber-400' : 'bg-white/10'}`} />
            </div>
          </div>

          {/* Refresh indicator */}
          <div className="mt-auto flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-white/60 animate-pulse' : 'bg-white/20'}`} />
            <p className="text-white/20 text-[10px]">
              Actualizado {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

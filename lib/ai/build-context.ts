/* eslint-disable @typescript-eslint/no-explicit-any */
import { SupabaseClient } from '@supabase/supabase-js'

async function fetchAll(query: any): Promise<any[]> {
  const PAGE = 1000
  const results: any[] = []
  let from = 0
  while (true) {
    const { data } = await query.range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    results.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return results
}

export async function buildBusinessContext(supabase: SupabaseClient): Promise<string> {
  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
  const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30)

  const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })

  // Parallel fetches
  const [
    todaySales,
    weekSales,
    monthSales,
    todayItems,
    weekItems,
    monthItems,
    stockItems,
    alerts,
    orders,
    branches,
    suppliers,
  ] = await Promise.all([
    fetchAll(supabase.from('sales').select('id, total, payment_method, branch_id, created_at').gte('created_at', today.toISOString())),
    fetchAll(supabase.from('sales').select('id, total, payment_method, branch_id, created_at').gte('created_at', weekAgo.toISOString())),
    fetchAll(supabase.from('sales').select('id, total, payment_method, branch_id, created_at').gte('created_at', monthAgo.toISOString())),
    fetchAll(supabase.from('sale_items').select('quantity, unit_price, sale_id, created_at, product:products(name, category)').gte('created_at', today.toISOString())),
    fetchAll(supabase.from('sale_items').select('quantity, unit_price, sale_id, created_at, product:products(name, category)').gte('created_at', weekAgo.toISOString())),
    fetchAll(supabase.from('sale_items').select('quantity, unit_price, sale_id, created_at, product:products(name, category)').gte('created_at', monthAgo.toISOString())),
    fetchAll(supabase.from('stock').select('quantity, min_quantity, branch_id, product:products(name, category, sell_price, cost_price, is_star), branch:branches(name)')),
    supabase.from('alerts').select('type, message, created_at').eq('status', 'active').limit(20).then(r => r.data ?? []),
    supabase.from('supplier_orders').select('total, status, notes, created_at, supplier:suppliers(name), branch:branches(name)').order('created_at', { ascending: false }).limit(10).then(r => r.data ?? []),
    supabase.from('branches').select('id, name').then(r => r.data ?? []),
    supabase.from('suppliers').select('name, contact_name, phone').then(r => r.data ?? []),
  ])

  // --- Totals ---
  const sum = (arr: any[]) => arr.reduce((s, v) => s + (v.total ?? 0), 0)
  const todayTotal = sum(todaySales); const todayCount = todaySales.length
  const weekTotal = sum(weekSales);  const weekCount = weekSales.length
  const monthTotal = sum(monthSales); const monthCount = monthSales.length
  const todayEfectivo = todaySales.filter(s => s.payment_method === 'efectivo').reduce((s, v) => s + v.total, 0)
  const todayMP = todaySales.filter(s => s.payment_method === 'mercadopago').reduce((s, v) => s + v.total, 0)
  const weekEfectivo = weekSales.filter(s => s.payment_method === 'efectivo').reduce((s, v) => s + v.total, 0)
  const weekMP = weekSales.filter(s => s.payment_method === 'mercadopago').reduce((s, v) => s + v.total, 0)

  // --- By branch ---
  const branchName = (id: string) => (branches as any[]).find(b => b.id === id)?.name ?? id
  const byBranchToday: Record<string, { total: number; count: number }> = {}
  const byBranchWeek: Record<string, { total: number; count: number }> = {}
  const byBranchMonth: Record<string, { total: number; count: number }> = {}
  for (const s of todaySales) {
    const b = branchName(s.branch_id)
    if (!byBranchToday[b]) byBranchToday[b] = { total: 0, count: 0 }
    byBranchToday[b].total += s.total; byBranchToday[b].count++
  }
  for (const s of weekSales) {
    const b = branchName(s.branch_id)
    if (!byBranchWeek[b]) byBranchWeek[b] = { total: 0, count: 0 }
    byBranchWeek[b].total += s.total; byBranchWeek[b].count++
  }
  for (const s of monthSales) {
    const b = branchName(s.branch_id)
    if (!byBranchMonth[b]) byBranchMonth[b] = { total: 0, count: 0 }
    byBranchMonth[b].total += s.total; byBranchMonth[b].count++
  }

  // --- Hourly breakdown today ---
  const byHour: Record<number, number> = {}
  for (const s of todaySales) {
    const h = new Date(s.created_at).getHours()
    byHour[h] = (byHour[h] ?? 0) + s.total
  }
  const hourlyLines = Object.entries(byHour).sort((a, b) => +a[0] - +b[0])
    .map(([h, t]) => `  ${String(h).padStart(2, '0')}:00hs — ${fmt(t)}`).join('\n') || '  Sin ventas aún'

  // --- Daily breakdown week (last 7 days) ---
  const byDay: Record<string, { total: number; count: number }> = {}
  for (const s of weekSales) {
    const d = new Date(s.created_at).toLocaleDateString('es-AR')
    if (!byDay[d]) byDay[d] = { total: 0, count: 0 }
    byDay[d].total += s.total; byDay[d].count++
  }
  const dailyWeekLines = Object.entries(byDay).sort((a, b) => new Date(a[0].split('/').reverse().join('-')) > new Date(b[0].split('/').reverse().join('-')) ? 1 : -1)
    .map(([d, v]) => `  ${d}: ${v.count} ventas — ${fmt(v.total)}`).join('\n') || '  Sin datos'

  // --- Daily breakdown month (last 30 days) ---
  const byDayMonth: Record<string, { total: number; count: number }> = {}
  for (const s of monthSales) {
    const d = new Date(s.created_at).toLocaleDateString('es-AR')
    if (!byDayMonth[d]) byDayMonth[d] = { total: 0, count: 0 }
    byDayMonth[d].total += s.total; byDayMonth[d].count++
  }
  const dailyMonthLines = Object.entries(byDayMonth).sort((a, b) => new Date(a[0].split('/').reverse().join('-')) > new Date(b[0].split('/').reverse().join('-')) ? 1 : -1)
    .map(([d, v]) => `  ${d}: ${v.count} ventas — ${fmt(v.total)}`).join('\n') || '  Sin datos'

  // --- Top products helper ---
  function topFrom(items: any[], n = 15) {
    const map: Record<string, { name: string; category: string; qty: number; revenue: number }> = {}
    for (const item of items) {
      const name = item.product?.name ?? 'Desconocido'
      const cat = item.product?.category ?? ''
      if (!map[name]) map[name] = { name, category: cat, qty: 0, revenue: 0 }
      map[name].qty += item.quantity
      map[name].revenue += item.quantity * item.unit_price
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, n)
  }
  const topToday = topFrom(todayItems, 15)
  const topWeek = topFrom(weekItems, 20)
  const topMonth = topFrom(monthItems, 20)

  // --- Stock ---
  const lowStock = stockItems.filter((s: any) => s.quantity <= s.min_quantity && s.quantity > 0)
  const zeroStock = stockItems.filter((s: any) => s.quantity === 0)
  const starLow = stockItems.filter((s: any) => s.product?.is_star && s.quantity <= s.min_quantity)
  const getP = (s: any) => s.product as any
  const getB = (s: any) => s.branch as any

  return `=== CONTEXTO REAL DEL NEGOCIO — ${now.toLocaleString('es-AR')} ===

NEGOCIO: Lisboa Market — cadena de 2 kioscos 24hs en Buenos Aires, Argentina
SUCURSALES: Caballito y Villa Luro
DUEÑO: Sebastián. ENCARGADOS: Nicolás (Caballito), Lucila (Villa Luro).
MEDIOS DE PAGO: Efectivo y MercadoPago.

════════════════════════════════════════
VENTAS HOY (${today.toLocaleDateString('es-AR')}):
  Total: ${fmt(todayTotal)} | Transacciones: ${todayCount} | Ticket promedio: ${todayCount > 0 ? fmt(todayTotal / todayCount) : 'sin ventas'}
  Efectivo: ${fmt(todayEfectivo)} | MercadoPago: ${fmt(todayMP)}
${Object.entries(byBranchToday).map(([b, v]) => `  ${b}: ${v.count} ventas — ${fmt(v.total)}`).join('\n') || '  Sin ventas por sucursal'}

VENTAS POR HORA HOY:
${hourlyLines}

TOP PRODUCTOS HOY (${todayItems.length} ítems registrados):
${topToday.length > 0 ? topToday.map((p, i) => `  ${i + 1}. ${p.name} (${p.category}): ${p.qty} uds — ${fmt(p.revenue)}`).join('\n') : '  Sin ventas hoy aún'}

════════════════════════════════════════
VENTAS ESTA SEMANA (últimos 7 días):
  Total: ${fmt(weekTotal)} | Transacciones: ${weekCount} | Ticket promedio: ${weekCount > 0 ? fmt(weekTotal / weekCount) : '—'}
  Efectivo: ${fmt(weekEfectivo)} | MercadoPago: ${fmt(weekMP)}
${Object.entries(byBranchWeek).map(([b, v]) => `  ${b}: ${v.count} ventas — ${fmt(v.total)}`).join('\n') || '  Sin datos'}

VENTAS DÍA A DÍA (última semana):
${dailyWeekLines}

TOP PRODUCTOS SEMANA (${weekItems.length} ítems):
${topWeek.length > 0 ? topWeek.map((p, i) => `  ${i + 1}. ${p.name} (${p.category}): ${p.qty} uds — ${fmt(p.revenue)}`).join('\n') : '  Sin ventas esta semana'}

════════════════════════════════════════
VENTAS ESTE MES (últimos 30 días):
  Total: ${fmt(monthTotal)} | Transacciones: ${monthCount} | Ticket promedio: ${monthCount > 0 ? fmt(monthTotal / monthCount) : '—'}
${Object.entries(byBranchMonth).map(([b, v]) => `  ${b}: ${v.count} ventas — ${fmt(v.total)}`).join('\n') || '  Sin datos'}

VENTAS DÍA A DÍA (último mes):
${dailyMonthLines}

TOP PRODUCTOS MES (${monthItems.length} ítems):
${topMonth.length > 0 ? topMonth.map((p, i) => `  ${i + 1}. ${p.name} (${p.category}): ${p.qty} uds — ${fmt(p.revenue)}`).join('\n') : '  Sin ventas este mes'}

════════════════════════════════════════
STOCK (${stockItems.length} ítems en inventario):
  Bajo mínimo: ${lowStock.length} | Sin stock: ${zeroStock.length} | Estrellas con alerta: ${starLow.length}

PRODUCTOS SIN STOCK (${zeroStock.length}):
${zeroStock.slice(0, 20).map((s: any) => `  · ${getP(s)?.is_star ? '⭐ ' : ''}${getP(s)?.name} — ${getB(s)?.name}`).join('\n') || '  · Ninguno ✓'}

PRODUCTOS BAJO MÍNIMO (${lowStock.length}):
${lowStock.slice(0, 30).map((s: any) => `  · ${getP(s)?.is_star ? '⭐ ' : ''}${getP(s)?.name}: ${s.quantity} uds (mín ${s.min_quantity}) — ${getB(s)?.name}`).join('\n') || '  · Ninguno ✓'}

ESTRELLAS CON STOCK BAJO: ${starLow.length > 0 ? starLow.map((s: any) => `⭐ ${getP(s)?.name} (${s.quantity} uds)`).join(', ') : 'Ninguno ✓'}

INVENTARIO COMPLETO:
${stockItems.map((s: any) => {
  const p = getP(s); const b = getB(s)
  const alert = s.quantity === 0 ? ' 🔴SIN STOCK' : s.quantity <= s.min_quantity ? ' ⚠️BAJO' : ''
  return `  · ${p?.is_star ? '⭐ ' : ''}${p?.name} [${p?.category}]: ${s.quantity} uds (mín ${s.min_quantity}) — ${b?.name}${alert} — PVP: ${fmt(p?.sell_price ?? 0)} | Costo: ${fmt(p?.cost_price ?? 0)}`
}).join('\n')}

════════════════════════════════════════
ALERTAS ACTIVAS (${alerts.length}):
${alerts.length ? (alerts as any[]).map((a: any) => `  · [${a.type}] ${a.message}`).join('\n') : '  · Sin alertas ✓'}

PEDIDOS A PROVEEDORES (últimos 10):
${orders.length ? (orders as any[]).map((o: any) => `  · ${o.supplier?.name} — ${o.branch?.name} — ${fmt(o.total)} (${o.status})`).join('\n') : '  · Sin pedidos'}

PROVEEDORES:
${(suppliers as any[]).map((s: any) => `  · ${s.name}${s.contact_name ? ` — ${s.contact_name}` : ''}${s.phone ? ` — ${s.phone}` : ''}`).join('\n') || '  Sin proveedores'}

=== FIN DEL CONTEXTO ===`
}

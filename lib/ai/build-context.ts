import { SupabaseClient } from '@supabase/supabase-js'

export async function buildBusinessContext(supabase: SupabaseClient): Promise<string> {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)

  const [
    { data: todaySales },
    { data: weekSales },
    { data: monthSales },
    { data: stockItems },
    { data: alerts },
    { data: orders },
    { data: saleItems },
    { data: branches },
    { data: suppliers },
  ] = await Promise.all([
    supabase.from('sales').select('total, payment_method, branch_id, created_at').gte('created_at', today.toISOString()),
    supabase.from('sales').select('total, payment_method, branch_id, created_at').gte('created_at', weekAgo.toISOString()),
    supabase.from('sales').select('total, payment_method, branch_id, created_at').gte('created_at', monthAgo.toISOString()),
    supabase.from('stock').select('quantity, min_quantity, branch_id, product:products(name, category, sell_price, cost_price, is_star), branch:branches(name)'),
    supabase.from('alerts').select('type, message, created_at').eq('status', 'active').limit(15),
    supabase.from('supplier_orders').select('total, status, notes, created_at, supplier:suppliers(name), branch:branches(name)').order('created_at', { ascending: false }).limit(10),
    supabase.from('sale_items').select('quantity, unit_price, created_at, product:products(name, category)').gte('created_at', weekAgo.toISOString()).limit(200),
    supabase.from('branches').select('id, name'),
    supabase.from('suppliers').select('name, contact_name, phone'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getP = (s: any) => s.product as { name: string; category?: string; is_star?: boolean; sell_price?: number; cost_price?: number } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getB = (s: any) => s.branch as { name: string } | null
  const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`

  const todayTotal = todaySales?.reduce((s: number, v: { total: number }) => s + v.total, 0) ?? 0
  const todayCount = todaySales?.length ?? 0
  const weekTotal = weekSales?.reduce((s: number, v: { total: number }) => s + v.total, 0) ?? 0
  const weekCount = weekSales?.length ?? 0
  const monthTotal = monthSales?.reduce((s: number, v: { total: number }) => s + v.total, 0) ?? 0
  const monthCount = monthSales?.length ?? 0
  const todayEfectivo = todaySales?.filter((s: { payment_method: string }) => s.payment_method === 'efectivo').reduce((s: number, v: { total: number }) => s + v.total, 0) ?? 0
  const todayMP = todaySales?.filter((s: { payment_method: string }) => s.payment_method === 'mercadopago').reduce((s: number, v: { total: number }) => s + v.total, 0) ?? 0

  const lowStock = stockItems?.filter((s: { quantity: number; min_quantity: number }) => s.quantity <= s.min_quantity) ?? []
  const starLow = lowStock.filter((s: { quantity: number; min_quantity: number }) => getP(s)?.is_star)
  const zeroStock = stockItems?.filter((s: { quantity: number }) => s.quantity === 0) ?? []

  const productSales: Record<string, { name: string; category?: string; qty: number; revenue: number }> = {}
  saleItems?.forEach((item: { quantity: number; unit_price: number; product?: { name?: string; category?: string } }) => {
    const name = item.product?.name ?? 'Desconocido'
    const category = item.product?.category ?? ''
    if (!productSales[name]) productSales[name] = { name, category, qty: 0, revenue: 0 }
    productSales[name].qty += item.quantity
    productSales[name].revenue += item.quantity * item.unit_price
  })
  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 10)

  const byBranch: Record<string, { total: number; count: number }> = {}
  todaySales?.forEach((s: { branch_id: string; total: number }) => {
    const branch = branches?.find((b: { id: string; name: string }) => b.id === s.branch_id)?.name ?? s.branch_id
    if (!byBranch[branch]) byBranch[branch] = { total: 0, count: 0 }
    byBranch[branch].total += s.total
    byBranch[branch].count++
  })

  return `=== CONTEXTO REAL DEL NEGOCIO — ACTUALIZADO EN TIEMPO REAL ===

NEGOCIO: Lisboa Market — cadena de 2 kioscos 24hs en Buenos Aires, Argentina
SUCURSALES: Caballito y Villa Luro
DUEÑO: Sebastián. ENCARGADOS: Nicolás (Caballito), Lucila (Villa Luro).
EMPLEADOS: Caballito: Martín, Lucas, Gabriel. Villa Luro: Lourdes, Martina, Sofía.
MEDIOS DE PAGO: Efectivo y MercadoPago.

--- VENTAS ---
HOY (${new Date().toLocaleDateString('es-AR')}): ${todayCount} ventas — Total: ${fmt(todayTotal)}
  · Efectivo: ${fmt(todayEfectivo)} | MercadoPago: ${fmt(todayMP)}
${Object.entries(byBranch).map(([b, v]) => `  · ${b}: ${v.count} ventas, ${fmt(v.total)}`).join('\n')}
ESTA SEMANA: ${weekCount} ventas — Total: ${fmt(weekTotal)}
ESTE MES: ${monthCount} ventas — Total: ${fmt(monthTotal)}
TICKET PROMEDIO HOY: ${todayCount > 0 ? fmt(Math.round(todayTotal / todayCount)) : 'sin ventas'}

--- TOP PRODUCTOS VENDIDOS (última semana) ---
${topProducts.length > 0 ? topProducts.map((p, i) => `${i + 1}. ${p.name} (${p.category}): ${p.qty} uds — ${fmt(p.revenue)}`).join('\n') : 'Sin ventas esta semana'}

--- STOCK ---
Total ítems: ${stockItems?.length ?? 0} | Bajo mínimo: ${lowStock.length} | Sin stock: ${zeroStock.length}
PRODUCTOS BAJO MÍNIMO:
${lowStock.slice(0, 15).map((s: { quantity: number; min_quantity: number }) => {
    const p = getP(s); const b = getB(s)
    return `  · ${p?.is_star ? '⭐ ' : ''}${p?.name}: ${s.quantity} uds (mín ${s.min_quantity}) — ${b?.name}`
  }).join('\n') || '  · Ninguno ✓'}
ESTRELLA CON STOCK BAJO: ${starLow.length > 0 ? starLow.map((s: { quantity: number; min_quantity: number }) => `⭐ ${getP(s)?.name} (${s.quantity} uds)`).join(', ') : 'Ninguno ✓'}

INVENTARIO COMPLETO:
${stockItems?.map((s: { quantity: number; min_quantity: number }) => {
    const p = getP(s); const b = getB(s)
    const low = s.quantity <= s.min_quantity ? ' ⚠️' : ''
    return `  · ${p?.is_star ? '⭐ ' : ''}${p?.name} [${p?.category}]: ${s.quantity} uds (mín ${s.min_quantity}) — ${b?.name}${low} — PVP: ${fmt(p?.sell_price ?? 0)} | Costo: ${fmt(p?.cost_price ?? 0)}`
  }).join('\n') ?? ''}

--- ALERTAS ACTIVAS (${alerts?.length ?? 0}) ---
${alerts?.length ? alerts.map((a: { type: string; message: string }) => `  · [${a.type}] ${a.message}`).join('\n') : '  · Sin alertas'}

--- PEDIDOS A PROVEEDORES (últimos 10) ---
${orders?.length ? orders.map((o: { total: number; status: string; supplier?: unknown; branch?: unknown }) => {
    const sup = (o as { supplier?: { name?: string } }).supplier?.name
    const b = (o as { branch?: { name?: string } }).branch?.name
    return `  · ${sup} — ${b} — ${fmt(o.total)} (${o.status})`
  }).join('\n') : '  · Sin pedidos'}

--- PROVEEDORES ---
${suppliers?.map((s: { name: string; contact_name?: string; phone?: string }) => `  · ${s.name}${s.contact_name ? ` — ${s.contact_name}` : ''}${s.phone ? ` — ${s.phone}` : ''}`).join('\n') ?? ''}

=== FIN DEL CONTEXTO ===`
}

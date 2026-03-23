import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { AIAssistant } from '@/components/ai/ai-assistant'

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) redirect('/')

  // Contexto del negocio
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)

  const [
    { data: todaySales },
    { data: stockItems },
    { data: alerts },
    { data: orders },
    { data: recentSaleItems },
    { count: alertCount },
  ] = await Promise.all([
    supabase.from('sales').select('total, payment_method, created_at, branch_id').gte('created_at', today.toISOString()),
    supabase.from('stock').select('quantity, min_quantity, product:products(name, category, sell_price, cost_price, is_star), branch:branches(name)'),
    supabase.from('alerts').select('type, message, created_at').eq('status', 'active').limit(10),
    supabase.from('supplier_orders').select('total, status, supplier:suppliers(name), created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('sale_items').select('quantity, unit_price, product:products(name), sale:sales(created_at, branch_id)').gte('sale.created_at', weekAgo.toISOString()).limit(100),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const totalToday = todaySales?.reduce((s, v) => s + v.total, 0) ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getP = (s: any) => s.product as { name: string; is_star?: boolean } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getB = (s: any) => s.branch as { name: string } | null

  const lowStock = stockItems?.filter((s) => s.quantity <= s.min_quantity) ?? []
  const starLow = lowStock.filter((s) => getP(s)?.is_star)

  const context = `
VENTAS HOY: ${todaySales?.length ?? 0} ventas — Total: $${totalToday.toLocaleString('es-AR')}
STOCK BAJO: ${lowStock.length} productos bajo mínimo
PRODUCTOS ESTRELLA CON STOCK BAJO: ${starLow.length} — ${starLow.map((s) => getP(s)?.name).join(', ') || 'ninguno'}
ALERTAS ACTIVAS: ${alerts?.length ?? 0}
${alerts?.map((a) => `- ${a.message}`).join('\n') ?? ''}
ÚLTIMOS PEDIDOS: ${orders?.map((o) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sup = (o as any).supplier as { name: string } | null
  return `${sup?.name} $${o.total} (${o.status})`
}).join(', ') ?? 'ninguno'}
STOCK ACTUAL (primeros 20):
${stockItems?.slice(0, 20).map((s) => {
  const p = getP(s)
  const b = getB(s)
  return `- ${p?.name}${p?.is_star ? ' ⭐' : ''}: ${s.quantity} uds (mín ${s.min_quantity}) — ${b?.name}`
}).join('\n') ?? ''}
`

  return (
    <>
      <Header title="Asistente IA" alertCount={alertCount ?? 0} />
      <div className="p-6">
        <AIAssistant context={context} profile={profile} />
      </div>
    </>
  )
}

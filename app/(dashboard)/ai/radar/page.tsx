import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { RadarClient } from '@/components/ai/radar-client'
import { buildBusinessContext } from '@/lib/ai/build-context'

export default async function RadarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) redirect('/')

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)

  const [
    { data: todaySales },
    { data: weekSaleItems },
    { data: stockItems },
    { count: alertCount },
    context,
  ] = await Promise.all([
    supabase.from('sales').select('total, payment_method, created_at, branch_id').gte('created_at', today.toISOString()),
    supabase.from('sale_items').select('quantity, unit_price, product:products(name, category, is_star), sale:sales!inner(created_at, branch_id)').gte('sale.created_at', weekAgo.toISOString()),
    supabase.from('stock').select('quantity, min_quantity, updated_at, product:products(name, is_star), branch:branches(name)'),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    buildBusinessContext(supabase),
  ])

  // Agrupar ventas por producto (semana)
  const productSales: Record<string, { name: string; qty: number; revenue: number; is_star: boolean }> = {}
  weekSaleItems?.forEach((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (item as any).product as { name: string; is_star?: boolean } | null
    if (!p?.name) return
    if (!productSales[p.name]) productSales[p.name] = { name: p.name, qty: 0, revenue: 0, is_star: p.is_star ?? false }
    productSales[p.name].qty += item.quantity
    productSales[p.name].revenue += item.quantity * item.unit_price
  })

  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stagnantStock = stockItems?.filter((s) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sold = productSales[((s as any).product as { name: string } | null)?.name ?? '']
    return !sold && s.quantity > 0
  }) ?? []

  return (
    <>
      <Header title="Radar de ventas" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <RadarClient
          context={context}
          topProducts={topProducts}
          stagnantCount={stagnantStock.length}
          todaySalesCount={todaySales?.length ?? 0}
          todayRevenue={todaySales?.reduce((s, v) => s + v.total, 0) ?? 0}
        />
      </div>
    </>
  )
}

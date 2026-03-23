import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { ReorderClient } from '@/components/ai/reorder-client'

export default async function ReorderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) redirect('/')

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)

  const [
    { data: stockItems },
    { data: weekSaleItems },
    { data: suppliers },
    { data: recentOrders },
    { count: alertCount },
  ] = await Promise.all([
    supabase.from('stock').select('quantity, min_quantity, product:products(id, name, category, cost_price, is_star), branch:branches(name)'),
    supabase.from('sale_items').select('quantity, product:products(name), sale:sales!inner(created_at)').gte('sale.created_at', weekAgo.toISOString()),
    supabase.from('suppliers').select('id, name'),
    supabase.from('supplier_order_items').select('product:products(name), order:supplier_orders(supplier:suppliers(name), created_at)').order('created_at', { ascending: false }).limit(50),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  // Calcular velocidad de venta por producto
  const salesVelocity: Record<string, number> = {}
  weekSaleItems?.forEach((item) => {
    const name = (item.product as { name: string })?.name
    if (name) salesVelocity[name] = (salesVelocity[name] ?? 0) + item.quantity
  })

  // Mapear proveedor por producto (basado en historial de pedidos)
  const productSupplier: Record<string, string> = {}
  recentOrders?.forEach((item) => {
    const name = (item.product as { name: string })?.name
    const supplier = ((item.order as { supplier: { name: string } })?.supplier)?.name
    if (name && supplier && !productSupplier[name]) productSupplier[name] = supplier
  })

  const context = `
STOCK ACTUAL Y NECESIDADES:
${stockItems?.map((s) => {
  const p = s.product as { id: string; name: string; cost_price: number; is_star?: boolean }
  const b = s.branch as { name: string }
  const velocity = salesVelocity[p?.name] ?? 0
  const supplier = productSupplier[p?.name] ?? 'Sin proveedor asignado'
  const needsReorder = s.quantity <= s.min_quantity
  return `- ${p?.name}${p?.is_star ? ' ⭐' : ''}: stock ${s.quantity} (mín ${s.min_quantity}) | vendido/semana: ${velocity} | ${b?.name} | Proveedor: ${supplier}${needsReorder ? ' ⚠️ REPONER' : ''} | costo: $${p?.cost_price ?? 0}`
}).join('\n') ?? ''}

PROVEEDORES DISPONIBLES: ${suppliers?.map((s) => s.name).join(', ')}
`

  return (
    <>
      <Header title="Plan de reposición" alertCount={alertCount ?? 0} />
      <div className="p-6">
        <ReorderClient context={context} stockItems={stockItems ?? []} salesVelocity={salesVelocity} />
      </div>
    </>
  )
}

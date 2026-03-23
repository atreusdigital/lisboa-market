import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { ReorderClient } from '@/components/ai/reorder-client'
import { buildBusinessContext } from '@/lib/ai/build-context'

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
    { data: recentOrders },
    { count: alertCount },
    context,
  ] = await Promise.all([
    supabase.from('stock').select('quantity, min_quantity, product:products(id, name, category, cost_price, is_star), branch:branches(name)'),
    supabase.from('sale_items').select('quantity, product:products(name), sale:sales!inner(created_at)').gte('sale.created_at', weekAgo.toISOString()),
    supabase.from('supplier_order_items').select('product:products(name), order:supplier_orders(supplier:suppliers(name), created_at)').order('created_at', { ascending: false }).limit(50),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    buildBusinessContext(supabase),
  ])

  // Calcular velocidad de venta por producto
  const salesVelocity: Record<string, number> = {}
  weekSaleItems?.forEach((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = ((item as any).product as { name: string } | null)?.name
    if (name) salesVelocity[name] = (salesVelocity[name] ?? 0) + item.quantity
  })

  // Mapear proveedor por producto (basado en historial de pedidos)
  const productSupplier: Record<string, string> = {}
  recentOrders?.forEach((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = ((item as any).product as { name: string } | null)?.name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supplier = ((item as any).order as { supplier: { name: string } } | null)?.supplier?.name
    if (name && supplier && !productSupplier[name]) productSupplier[name] = supplier
  })

  return (
    <>
      <Header title="Plan de reposición" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ReorderClient context={context} stockItems={(stockItems ?? []) as any[]} salesVelocity={salesVelocity} />
      </div>
    </>
  )
}

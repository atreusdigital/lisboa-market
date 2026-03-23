import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TVDashboard } from '@/components/tv/tv-dashboard'

export const revalidate = 0

export default async function TVPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Sales today
  let salesQuery = supabase
    .from('sales')
    .select('total, payment_method')
    .gte('created_at', today.toISOString())

  if (profile.role !== 'director' && profile.branch_id) {
    salesQuery = salesQuery.eq('branch_id', profile.branch_id)
  }

  const { data: sales } = await salesQuery

  // Top products today
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('quantity, unit_price, product:products(name), sale:sales!inner(created_at)')
    .gte('sale.created_at', today.toISOString())

  // Stock
  let stockQuery = supabase.from('stock').select('quantity, min_quantity')
  if (profile.role !== 'director' && profile.branch_id) {
    stockQuery = stockQuery.eq('branch_id', profile.branch_id)
  }
  const { data: stockItems } = await stockQuery

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

  const branchName =
    profile.role === 'director'
      ? 'Todas las sucursales'
      : (profile.branch as any)?.name ?? 'Sucursal'

  const initialData = {
    salesCount: salesArr.length,
    revenue: salesArr.reduce((s: number, x: any) => s + x.total, 0),
    efectivo: salesArr.filter((x: any) => x.payment_method === 'efectivo').reduce((s: number, x: any) => s + x.total, 0),
    mp: salesArr.filter((x: any) => x.payment_method === 'mercadopago').reduce((s: number, x: any) => s + x.total, 0),
    lowStock: stockArr.filter((s: any) => s.quantity <= s.min_quantity && s.quantity > 0).length,
    criticalStock: stockArr.filter((s: any) => s.quantity === 0).length,
    topProducts,
    branchName,
  }

  return <TVDashboard initialData={initialData} branchName={branchName} />
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { DashboardDirector } from '@/components/dashboard/dashboard-director'
import { DashboardAdmin } from '@/components/dashboard/dashboard-admin'
import { DashboardEmpleado } from '@/components/dashboard/dashboard-empleado'
import type { Profile } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Alertas activas para el badge
  let alertQuery = supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  if (profile.role !== 'director' && profile.branch_id) {
    alertQuery = alertQuery.eq('branch_id', profile.branch_id)
  }

  const { count: alertCount } = await alertQuery

  // Ventas del día
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let salesQuery = supabase
    .from('sales')
    .select('total, payment_method, created_at')
    .gte('created_at', today.toISOString())

  if (profile.role !== 'director' && profile.branch_id) {
    salesQuery = salesQuery.eq('branch_id', profile.branch_id)
  }

  const { data: todaySales } = await salesQuery

  const totalRevenue = todaySales?.reduce((sum, s) => sum + s.total, 0) ?? 0
  const totalSalesCount = todaySales?.length ?? 0

  // Stock bajo
  let stockQuery = supabase
    .from('stock')
    .select('id, quantity, min_quantity')
    .filter('quantity', 'lte', 'min_quantity')

  if (profile.role !== 'director' && profile.branch_id) {
    stockQuery = stockQuery.eq('branch_id', profile.branch_id)
  }

  const { data: lowStockItems } = await stockQuery

  // Pedidos pendientes
  let ordersQuery = supabase
    .from('supplier_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (profile.role !== 'director' && profile.branch_id) {
    ordersQuery = ordersQuery.eq('branch_id', profile.branch_id)
  }

  const { count: pendingOrders } = await ordersQuery

  const stats = {
    total_sales_today: totalSalesCount,
    total_revenue_today: totalRevenue,
    low_stock_count: lowStockItems?.length ?? 0,
    active_alerts: alertCount ?? 0,
    pending_orders: pendingOrders ?? 0,
  }

  const titles: Record<string, string> = {
    director: 'Dashboard — Vista General',
    admin: 'Dashboard',
    empleado: 'Dashboard',
  }

  return (
    <>
      <Header title={titles[profile.role]} alertCount={alertCount ?? 0} />
      <div className="p-6">
        {profile.role === 'director' && (
          <DashboardDirector profile={profile as Profile} stats={stats} />
        )}
        {profile.role === 'admin' && (
          <DashboardAdmin profile={profile as Profile} stats={stats} />
        )}
        {profile.role === 'empleado' && (
          <DashboardEmpleado profile={profile as Profile} stats={stats} />
        )}
      </div>
    </>
  )
}

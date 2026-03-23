import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { AnalyticsModule } from '@/components/analytics/analytics-module'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  if (!['director', 'admin'].includes(profile.role)) redirect('/')

  // Últimos 30 días
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let salesQuery = supabase
    .from('sales')
    .select('id, total, payment_method, created_at, branch_id, branch:branches(name)')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true })

  if (profile.role === 'admin' && profile.branch_id) {
    salesQuery = salesQuery.eq('branch_id', profile.branch_id)
  }

  const { data: sales } = await salesQuery

  let itemsQuery = supabase
    .from('sale_items')
    .select('product_id, quantity, unit_price, sale:sales(branch_id, created_at), product:products(name, category)')

  const { data: saleItems } = await itemsQuery

  const { data: branches } = await supabase.from('branches').select('*')

  const { count: alertCount } = await supabase
    .from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active')

  return (
    <>
      <Header title="Reportes y Analytics" alertCount={alertCount ?? 0} />
      <div className="p-6">
        <AnalyticsModule
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sales={(sales ?? []) as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          saleItems={(saleItems ?? []) as any}
          branches={branches ?? []}
          profile={profile}
        />
      </div>
    </>
  )
}

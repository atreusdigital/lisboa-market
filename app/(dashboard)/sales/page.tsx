import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { SalesModule } from '@/components/sales/sales-module'

export default async function SalesPage() {
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

  let salesQuery = supabase
    .from('sales')
    .select('*, branch:branches(name), user:profiles(full_name), items:sale_items(id)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (profile.role === 'admin' && profile.branch_id) {
    salesQuery = salesQuery.eq('branch_id', profile.branch_id)
  }

  const { data: sales } = await salesQuery
  const { data: branches } = await supabase.from('branches').select('*')
  const { count: alertCount } = await supabase
    .from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active')

  return (
    <>
      <Header title="Ventas" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <SalesModule sales={sales ?? []} branches={branches ?? []} profile={profile} />
      </div>
    </>
  )
}

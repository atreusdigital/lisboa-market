import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { SuppliersModule } from '@/components/suppliers/suppliers-module'

export default async function SuppliersPage() {
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

  const { data: suppliers } = await supabase.from('suppliers').select('*').order('name')

  let ordersQuery = supabase
    .from('supplier_orders')
    .select('*, supplier:suppliers(*), branch:branches(*), user:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (profile.role === 'admin' && profile.branch_id) {
    ordersQuery = ordersQuery.eq('branch_id', profile.branch_id)
  }

  const { data: orders } = await ordersQuery

  let accountsQuery = supabase
    .from('accounts_payable')
    .select('*, supplier:suppliers(*), branch:branches(*)')

  if (profile.role === 'admin' && profile.branch_id) {
    accountsQuery = accountsQuery.eq('branch_id', profile.branch_id)
  }

  const { data: accounts } = await accountsQuery
  const { data: branches } = await supabase.from('branches').select('*')
  const { data: products } = await supabase.from('products').select('*').order('name')

  const { count: alertCount } = await supabase
    .from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active')

  return (
    <>
      <Header title="Proveedores" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <SuppliersModule
          suppliers={suppliers ?? []}
          orders={orders ?? []}
          accounts={accounts ?? []}
          branches={branches ?? []}
          products={products ?? []}
          profile={profile}
        />
      </div>
    </>
  )
}

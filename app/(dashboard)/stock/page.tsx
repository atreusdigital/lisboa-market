import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { StockModule } from '@/components/stock/stock-module'

export default async function StockPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  // Stock con productos y sucursales
  let stockQuery = supabase
    .from('stock')
    .select('*, product:products(*), branch:branches(*)')
    .order('updated_at', { ascending: false })

  if (profile.role !== 'director' && profile.branch_id) {
    stockQuery = stockQuery.eq('branch_id', profile.branch_id)
  }

  const { data: stockItems } = await stockQuery

  const { data: branches } = await supabase.from('branches').select('*')
  const { data: products } = await supabase.from('products').select('*').order('name')

  const { count: alertCount } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  return (
    <>
      <Header title="Stock" alertCount={alertCount ?? 0} />
      <div className="p-6">
        <StockModule
          stockItems={stockItems ?? []}
          branches={branches ?? []}
          products={products ?? []}
          profile={profile}
        />
      </div>
    </>
  )
}

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

  // Paginar stock (límite PostgREST = 1000 por request)
  const stockItems: any[] = []
  let stockFrom = 0
  while (true) {
    let q = supabase.from('stock').select('*, product:products(*), branch:branches(*)').order('updated_at', { ascending: false })
    if (profile.role !== 'director' && profile.branch_id) q = q.eq('branch_id', profile.branch_id)
    const { data } = await q.range(stockFrom, stockFrom + 999)
    if (!data || data.length === 0) break
    stockItems.push(...data)
    if (data.length < 1000) break
    stockFrom += 1000
  }

  // Paginar productos
  const allProducts: any[] = []
  let prodFrom = 0
  while (true) {
    const { data } = await supabase.from('products').select('*').order('name').range(prodFrom, prodFrom + 999)
    if (!data || data.length === 0) break
    allProducts.push(...data)
    if (data.length < 1000) break
    prodFrom += 1000
  }

  const { data: branches } = await supabase.from('branches').select('*')

  const { count: alertCount } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  return (
    <>
      <Header title="Stock" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <StockModule
          stockItems={stockItems}
          branches={branches ?? []}
          products={allProducts}
          profile={profile}
        />
      </div>
    </>
  )
}

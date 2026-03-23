import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { SaleDetail } from '@/components/sales/sale-detail'

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
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

  const { data: sale } = await supabase
    .from('sales')
    .select('*, branch:branches(name), user:profiles(full_name, role)')
    .eq('id', params.id)
    .single()

  if (!sale) notFound()

  const { data: items } = await supabase
    .from('sale_items')
    .select('*, product:products(name, category, sell_price, is_star)')
    .eq('sale_id', params.id)

  const { count: alertCount } = await supabase
    .from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active')

  return (
    <>
      <Header title="Detalle de venta" alertCount={alertCount ?? 0} />
      <div className="p-6">
        <SaleDetail sale={sale} items={items ?? []} />
      </div>
    </>
  )
}

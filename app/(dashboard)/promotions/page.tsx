import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { PromotionsModule } from '@/components/promotions/promotions-module'

export default async function PromotionsPage() {
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

  const { data: promotions } = await supabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, barcode')
    .order('name')

  const { count: alertCount } = await supabase
    .from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active')

  return (
    <>
      <Header title="Promociones" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <PromotionsModule
          promotions={promotions ?? []}
          products={products ?? []}
          profile={profile}
        />
      </div>
    </>
  )
}

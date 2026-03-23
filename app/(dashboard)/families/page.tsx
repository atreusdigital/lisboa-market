import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { FamiliesModule } from '@/components/families/families-module'

export default async function FamiliesPage() {
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

  const { data: families } = await supabase
    .from('product_families')
    .select('*')
    .order('name')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, family_id')
    .order('name')

  const { count: alertCount } = await supabase
    .from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active')

  return (
    <>
      <Header title="Familias de productos" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <FamiliesModule
          families={families ?? []}
          products={products ?? []}
          profile={profile}
        />
      </div>
    </>
  )
}

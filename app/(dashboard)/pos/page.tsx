import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { POSInterface } from '@/components/pos/pos-interface'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  // Productos con stock de la sucursal del usuario
  let stockQuery = supabase
    .from('stock')
    .select('*, product:products(*)')
    .gt('quantity', 0)
    .order('quantity', { ascending: false })

  if (profile.branch_id) {
    stockQuery = stockQuery.eq('branch_id', profile.branch_id)
  }

  const { data: stockItems } = await stockQuery

  const { count: alertCount } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  return (
    <>
      <Header title="Punto de Venta" alertCount={alertCount ?? 0} />
      <div className="p-6">
        <POSInterface
          stockItems={stockItems ?? []}
          profile={profile}
        />
      </div>
    </>
  )
}

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

  const { data: branches } = await supabase.from('branches').select('*').order('name')

  // Traer todo el stock — el POS filtra por sucursal seleccionada en el cliente
  const { data: stockItems } = await supabase
    .from('stock')
    .select('*, product:products(*)')
    .gt('quantity', 0)
    .order('quantity', { ascending: false })

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
          branches={branches ?? []}
          profile={profile}
        />
      </div>
    </>
  )
}

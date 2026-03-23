import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { AlertsModule } from '@/components/alerts/alerts-module'

export default async function AlertsPage() {
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

  let alertsQuery = supabase
    .from('alerts')
    .select('*, product:products(name, category), branch:branches(name)')
    .order('created_at', { ascending: false })

  if (profile.role === 'admin' && profile.branch_id) {
    alertsQuery = alertsQuery.eq('branch_id', profile.branch_id)
  }

  const { data: alerts } = await alertsQuery
  const { count: alertCount } = await supabase
    .from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active')

  return (
    <>
      <Header title="Alertas" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <AlertsModule alerts={alerts ?? []} profile={profile} />
      </div>
    </>
  )
}

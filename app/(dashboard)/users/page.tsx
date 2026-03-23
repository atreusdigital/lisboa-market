import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { UsersModule } from '@/components/users/users-module'

export default async function UsersPage() {
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

  const { data: users } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .order('full_name')

  const { data: branches } = await supabase.from('branches').select('*')

  const { data: activityLog } = await supabase
    .from('activity_log')
    .select('*, user:profiles(full_name, role)')
    .order('created_at', { ascending: false })
    .limit(50)

  const { count: alertCount } = await supabase
    .from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active')

  return (
    <>
      <Header title="Usuarios y actividad" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <UsersModule
          users={users ?? []}
          branches={branches ?? []}
          activityLog={activityLog ?? []}
          currentProfile={profile}
        />
      </div>
    </>
  )
}

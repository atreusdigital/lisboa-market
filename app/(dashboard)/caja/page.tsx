import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { CajaModule } from '@/components/caja/caja-module'

export default async function CajaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const branchFilter = profile.role === 'director' ? {} : { branch_id: profile.branch_id }

  const [
    { data: branches },
    { data: branchUsers },
    { data: openShift },
    { data: todaySales },
    { data: todayExpenses },
    { data: recentClosings },
    { data: recentShifts },
    { count: alertCount },
  ] = await Promise.all([
    supabase.from('branches').select('id, name, address, created_at'),
    profile.branch_id
      ? supabase.from('profiles').select('id, full_name, role').eq('branch_id', profile.branch_id)
      : supabase.from('profiles').select('id, full_name, role'),
    profile.branch_id
      ? supabase.from('shifts').select('*, user:profiles(full_name)').eq('status', 'open').eq('branch_id', profile.branch_id).maybeSingle()
      : supabase.from('shifts').select('*, user:profiles(full_name)').eq('status', 'open').maybeSingle(),
    supabase.from('sales')
      .select('total, payment_method, created_at, branch_id')
      .gte('created_at', today.toISOString()),
    supabase.from('expenses')
      .select('*, user:profiles(full_name)')
      .eq('date', today.toISOString().split('T')[0])
      .order('created_at', { ascending: false }),
    supabase.from('cash_closings')
      .select('*, user:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('shifts')
      .select('*, user:profiles(full_name)')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(5),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const branchSales = profile.role === 'director'
    ? todaySales ?? []
    : (todaySales ?? []).filter((s: { branch_id: string }) => s.branch_id === profile.branch_id)

  const efectivoHoy = branchSales
    .filter((s: { payment_method: string }) => s.payment_method === 'efectivo')
    .reduce((sum: number, s: { total: number }) => sum + s.total, 0)

  const mpHoy = branchSales
    .filter((s: { payment_method: string }) => s.payment_method === 'mercadopago')
    .reduce((sum: number, s: { total: number }) => sum + s.total, 0)

  const totalHoy = branchSales.reduce((sum: number, s: { total: number }) => sum + s.total, 0)

  return (
    <>
      <Header title="Caja" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <CajaModule
          profile={profile}
          branches={branches ?? []}
          branchUsers={branchUsers ?? []}
          openShift={openShift}
          efectivoHoy={efectivoHoy}
          mpHoy={mpHoy}
          totalHoy={totalHoy}
          salesCount={branchSales.length}
          todayExpenses={todayExpenses ?? []}
          recentClosings={recentClosings ?? []}
          recentShifts={recentShifts ?? []}
        />
      </div>
    </>
  )
}

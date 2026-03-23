import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { buildBusinessContext } from '@/lib/ai/build-context'

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) redirect('/')

  const [context, { count: alertCount }] = await Promise.all([
    buildBusinessContext(supabase),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  return (
    <>
      <Header title="Asistente IA" alertCount={alertCount ?? 0} />
      <div className="p-4 md:p-6">
        <AIAssistant context={context} profile={profile} />
      </div>
    </>
  )
}

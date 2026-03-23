import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { AIBubble } from '@/components/ai/ai-bubble'
import type { Profile } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F5F5F7' }}>
      {/* Sidebar solo en desktop */}
      <div className="hidden md:flex">
        <Sidebar profile={profile as Profile} />
      </div>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Bottom nav en mobile */}
      <MobileNav profile={profile as Profile} />

      {/* AI Bubble */}
      <AIBubble />
    </div>
  )
}

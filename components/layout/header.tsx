'use client'

import { useState, useEffect } from 'react'
import { Users, LogOut, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface UserProfile {
  full_name: string
  role: string
}

interface HeaderProps {
  title: string
  alertCount?: number
}

const roleLabels: Record<string, string> = {
  director: 'Dueño',
  admin: 'Encargado',
  empleado: 'Empleado',
}

export function Header({ title }: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
      if (data) setProfile(data)
    }
    loadProfile()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 bg-white sticky top-0 z-10">
      <h1 className="text-sm font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        {/* Perfil con dropdown */}
        {profile && (
          <Popover open={profileOpen} onOpenChange={setProfileOpen}>
            <PopoverTrigger className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 transition-colors">
              <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-semibold text-white">
                  {profile.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <p className="text-xs font-medium text-neutral-900 leading-none">{profile.full_name.split(' ')[0]}</p>
                <p className="text-[10px] text-muted-foreground">{roleLabels[profile.role] ?? profile.role}</p>
              </div>
              <ChevronDown className="w-3 h-3 text-neutral-400 hidden sm:block" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5">
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-xs font-semibold">{profile.full_name}</p>
                <p className="text-[11px] text-muted-foreground">{roleLabels[profile.role] ?? profile.role}</p>
              </div>
              {profile.role === 'director' && (
                <Link
                  href="/users"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-md hover:bg-neutral-100 transition-colors w-full text-left"
                >
                  <Users className="w-3.5 h-3.5 text-neutral-500" />
                  Gestionar usuarios
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-md hover:bg-red-50 hover:text-red-600 transition-colors w-full text-left mt-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  )
}

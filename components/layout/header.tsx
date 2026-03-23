'use client'

import { useState, useEffect } from 'react'
import { Bell, Users, LogOut, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface AlertItem { id: string; type: string; message: string; status: string; created_at: string }
interface UserProfile { full_name: string; role: string }
interface HeaderProps { title: string; alertCount?: number }

const alertTypeLabel: Record<string, string> = {
  low_stock: 'Stock bajo',
  high_demand_low_stock: 'Alta demanda',
  stagnant_product: 'Producto estancado',
  payment_due: 'Pago pendiente',
  cash_anomaly: 'Anomalía de caja',
}

const roleLabels: Record<string, string> = {
  director: 'Dueño',
  admin: 'Encargado',
  empleado: 'Empleado',
}

export function Header({ title, alertCount = 0 }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      if (data) setProfile(data)
    }
    loadProfile()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function loadAlerts() {
    setLoading(true)
    const { data } = await supabase.from('alerts').select('id, type, message, status, created_at').eq('status', 'active').order('created_at', { ascending: false }).limit(10)
    setAlerts(data ?? [])
    setLoading(false)
  }

  async function resolveAlert(alertId: string) {
    await supabase.from('alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', alertId)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
  }

  return (
    <header className="h-14 flex items-center justify-between px-5 md:px-7 sticky top-0 z-10"
      style={{
        background: 'rgba(245,245,247,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>

      <h1 className="text-[15px] font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>{title}</h1>

      <div className="flex items-center gap-1.5">
        {/* Alertas */}
        <Popover open={open} onOpenChange={v => { setOpen(v); if (v) loadAlerts() }}>
          <PopoverTrigger className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/5 transition-colors">
            <Bell className="w-4.5 h-4.5" style={{ color: '#1D1D1F' }} />
            {alertCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-[#F5F5F7]" />
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden border-0" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.08)' }}>
            <div className="px-4 py-3.5 border-b border-black/5">
              <p className="text-sm font-semibold">Notificaciones</p>
              <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>{alertCount} alertas activas</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-center py-8" style={{ color: '#86868B' }}>Cargando...</p>
              ) : alerts.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-2xl mb-2">🔔</p>
                  <p className="text-sm" style={{ color: '#86868B' }}>Sin notificaciones</p>
                </div>
              ) : alerts.map(alert => (
                <div key={alert.id} className="px-4 py-3 border-b border-black/5 last:border-0 hover:bg-black/2 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#86868B' }}>
                        {alertTypeLabel[alert.type] ?? alert.type}
                      </p>
                      <p className="text-xs leading-relaxed">{alert.message}</p>
                    </div>
                    <button onClick={() => resolveAlert(alert.id)} className="text-xs shrink-0 mt-0.5 w-5 h-5 rounded-full bg-black/5 hover:bg-green-100 hover:text-green-600 flex items-center justify-center transition-colors">
                      ✓
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {alerts.length > 0 && (
              <div className="px-4 py-2.5 border-t border-black/5">
                <a href="/alerts" className="text-xs font-medium" style={{ color: '#1C2B23' }}>Ver todas →</a>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Perfil */}
        {profile && (
          <Popover open={profileOpen} onOpenChange={setProfileOpen}>
            <PopoverTrigger className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 transition-colors">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: '#1C2B23' }}>
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block text-[13px] font-medium" style={{ color: '#1D1D1F' }}>
                {profile.full_name.split(' ')[0]}
              </span>
              <ChevronDown className="w-3 h-3 hidden sm:block" style={{ color: '#86868B' }} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5 rounded-2xl border-0" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.08)' }}>
              <div className="px-3 py-2.5 mb-1">
                <p className="text-[13px] font-semibold">{profile.full_name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>{roleLabels[profile.role] ?? profile.role}</p>
              </div>
              {profile.role === 'director' && (
                <Link href="/users" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-xl hover:bg-black/5 transition-colors w-full">
                  <Users className="w-4 h-4" style={{ color: '#86868B' }} />
                  Gestionar usuarios
                </Link>
              )}
              <button onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors w-full text-left mt-0.5">
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  )
}

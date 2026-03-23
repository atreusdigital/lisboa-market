'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Bell,
  BarChart3, LogOut, TrendingUp, ClipboardList, Receipt, Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['director', 'admin', 'empleado'], exact: true },
  { href: '/sales', label: 'Ventas', icon: Receipt, roles: ['director', 'admin'] },
  { href: '/pos', label: 'Punto de Venta', icon: ShoppingCart, roles: ['director', 'admin', 'empleado'] },
  { href: '/caja', label: 'Caja', icon: Wallet, roles: ['director', 'admin', 'empleado'] },
  { href: '/stock', label: 'Stock', icon: Package, roles: ['director', 'admin', 'empleado'] },
  { href: '/suppliers', label: 'Proveedores', icon: Truck, roles: ['director', 'admin'] },
  { href: '/alerts', label: 'Alertas', icon: Bell, roles: ['director', 'admin'] },
  { href: '/analytics', label: 'Reportes', icon: BarChart3, roles: ['director', 'admin'] },
]

const aiItems = [
  { href: '/ai/radar', label: 'Radar', icon: TrendingUp, roles: ['director', 'admin'] },
  { href: '/ai/reorder', label: 'Reposición', icon: ClipboardList, roles: ['director', 'admin'] },
]

const roleLabels: Record<string, string> = {
  director: 'Dueño',
  admin: 'Encargado',
  empleado: 'Empleado',
}

interface SidebarProps { profile: Profile }

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const visibleItems = navItems.filter(i => i.roles.includes(profile.role))
  const visibleAiItems = aiItems.filter(i => i.roles.includes(profile.role))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(item: { href: string; exact?: boolean }) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  return (
    <aside className="w-[220px] flex flex-col h-screen sticky top-0 shrink-0" style={{ backgroundColor: '#1D1D1F' }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          {/* L24 mark */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#1C2B23' }}>
            <span className="text-white font-black text-sm tracking-tight">L</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight tracking-tight">Lisboa Market</p>
            <p className="text-[11px] leading-tight" style={{ color: '#86868B' }}>
              {profile.role === 'director' ? 'Todas las sucursales' : profile.branch?.name ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto flex flex-col gap-5 pb-4">

        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = isActive(item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all',
                    active
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/75 hover:bg-white/5'
                  )}
                  style={active ? { backgroundColor: '#1C2B23' } : {}}
                >
                  <item.icon className={cn('w-4 h-4 shrink-0', active ? 'text-white' : 'text-white/35')} strokeWidth={active ? 2.5 : 1.75} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="flex-1" />

        {/* IA tools */}
        {visibleAiItems.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2" style={{ color: '#48484A' }}>
              Herramientas IA
            </p>
            <ul className="space-y-0.5">
              {visibleAiItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all',
                        active ? 'text-white bg-white/10' : 'text-white/35 hover:text-white/70 hover:bg-white/5'
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* User */}
        <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold text-white" style={{ backgroundColor: '#1C2B23' }}>
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white truncate leading-tight">{profile.full_name.split(' ')[0]}</p>
              <p className="text-[11px]" style={{ color: '#48484A' }}>{roleLabels[profile.role]}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5 text-white/30" />
            </button>
          </div>
        </div>
      </nav>
    </aside>
  )
}

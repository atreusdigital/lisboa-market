'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Bell,
  BarChart3,
  Users,
  LogOut,
  Bot,
  TrendingUp,
  ClipboardList,
  Receipt,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['director', 'admin', 'empleado'] },
  { href: '/pos', label: 'Punto de Venta', icon: ShoppingCart, roles: ['director', 'admin', 'empleado'] },
  { href: '/stock', label: 'Stock', icon: Package, roles: ['director', 'admin', 'empleado'] },
  { href: '/sales', label: 'Ventas', icon: Receipt, roles: ['director', 'admin'] },
  { href: '/suppliers', label: 'Proveedores', icon: Truck, roles: ['director', 'admin'] },
  { href: '/alerts', label: 'Alertas', icon: Bell, roles: ['director', 'admin'] },
  { href: '/analytics', label: 'Reportes', icon: BarChart3, roles: ['director', 'admin'] },
  { href: '/users', label: 'Usuarios', icon: Users, roles: ['director'] },
]

const aiItems = [
  { href: '/ai/assistant', label: 'Asistente IA', icon: Bot, roles: ['director', 'admin'] },
  { href: '/ai/radar', label: 'Radar de ventas', icon: TrendingUp, roles: ['director', 'admin'] },
  { href: '/ai/reorder', label: 'Plan de reposición', icon: ClipboardList, roles: ['director', 'admin'] },
]

const roleLabels: Record<string, string> = {
  director: 'Dueño',
  admin: 'Encargado',
  empleado: 'Empleado',
}

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const visibleItems = navItems.filter((item) => item.roles.includes(profile.role))
  const visibleAiItems = aiItems.filter((item) => item.roles.includes(profile.role))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 flex flex-col h-screen sticky top-0 shrink-0" style={{ backgroundColor: '#1C2B23' }}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-center px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <svg viewBox="0 0 120 120" className="w-12 h-12 shrink-0" xmlns="http://www.w3.org/2000/svg">
          <circle cx="60" cy="60" r="58" fill="#1C2B23" stroke="white" strokeWidth="1.5"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.4"/>
          {/* Texto circular superior: MARKET 24/7 • BEBIDAS • KIOSCO */}
          <path id="topArc" d="M 60,60 m -42,0 a 42,42 0 1,1 84,0" fill="none"/>
          <text fontSize="7.5" fill="white" fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing="2.2">
            <textPath href="#topArc" startOffset="2%">MARKET 24/7 • BEBIDAS • KIOSCO •</textPath>
          </text>
          {/* Texto circular inferior: MARKET 24/7 • BEBIDAS • KIOSCO */}
          <path id="bottomArc" d="M 18,60 a 42,42 0 0,0 84,0" fill="none"/>
          <text fontSize="7.5" fill="white" fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing="2.2">
            <textPath href="#bottomArc" startOffset="2%">MARKET 24/7 • BEBIDAS • KIOSCO •</textPath>
          </text>
          {/* L24 central */}
          <text x="60" y="67" textAnchor="middle" fontSize="26" fontWeight="700" fill="white" fontFamily="Arial, sans-serif" letterSpacing="-1">L24</text>
        </svg>
      </div>

      {/* Branch badge */}
      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          {profile.role === 'director' ? 'Acceso' : 'Sucursal'}
        </span>
        <p className="text-xs font-medium mt-0.5 text-white/80">
          {profile.role === 'director'
            ? (profile.branch_ids && profile.branch_ids.length > 0 ? `${profile.branch_ids.length} sucursales` : 'Todas las sucursales')
            : (profile.branch?.name ?? '—')}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-white/15 text-white font-medium'
                      : 'text-white/55 hover:bg-white/08 hover:text-white/90'
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {visibleAiItems.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider px-3 mb-1.5">Herramientas IA</p>
            <ul className="space-y-0.5">
              {visibleAiItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                        isActive
                          ? 'bg-white/15 text-white font-medium'
                          : 'text-white/55 hover:bg-white/08 hover:text-white/90'
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-white">
              {profile.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-white">{profile.full_name}</p>
            <p className="text-[11px] text-white/40">{roleLabels[profile.role]}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

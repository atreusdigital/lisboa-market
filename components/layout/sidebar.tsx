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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['director', 'admin', 'empleado'] },
  { href: '/pos', label: 'Punto de Venta', icon: ShoppingCart, roles: ['director', 'admin', 'empleado'] },
  { href: '/stock', label: 'Stock', icon: Package, roles: ['director', 'admin', 'empleado'] },
  { href: '/suppliers', label: 'Proveedores', icon: Truck, roles: ['director', 'admin'] },
  { href: '/alerts', label: 'Alertas', icon: Bell, roles: ['director', 'admin'] },
  { href: '/analytics', label: 'Reportes', icon: BarChart3, roles: ['director', 'admin'] },
  { href: '/users', label: 'Usuarios', icon: Users, roles: ['director'] },
]

const roleLabels: Record<string, string> = {
  director: 'Director',
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

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(profile.role)
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 flex flex-col h-screen sticky top-0 shrink-0" style={{ backgroundColor: '#1C2B23' }}>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-white/10">
          <span className="text-white font-bold text-sm">L</span>
        </div>
        <div>
          <span className="font-semibold text-sm tracking-tight text-white">Lisboa</span>
          <span className="font-light text-sm text-white/60 ml-1">Market</span>
        </div>
      </div>

      {/* Branch badge */}
      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          {profile.role === 'director' ? 'Acceso' : 'Sucursal'}
        </span>
        <p className="text-xs font-medium mt-0.5 text-white/80">
          {profile.role === 'director' ? 'Todas las sucursales' : (profile.branch?.name ?? '—')}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
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
                  style={isActive ? {} : {}}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
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

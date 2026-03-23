'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import { LayoutDashboard, ShoppingCart, Package, Wallet, Truck, Bell } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard, roles: ['director', 'admin', 'empleado'], exact: true },
  { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['director', 'admin', 'empleado'] },
  { href: '/caja', label: 'Caja', icon: Wallet, roles: ['director', 'admin', 'empleado'] },
  { href: '/stock', label: 'Stock', icon: Package, roles: ['director', 'admin', 'empleado'] },
  { href: '/suppliers', label: 'Pedidos', icon: Truck, roles: ['director', 'admin'] },
  { href: '/alerts', label: 'Alertas', icon: Bell, roles: ['director', 'admin'] },
]

interface Props { profile: Profile }

export function MobileNav({ profile }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems
    .filter(item => item.roles.includes(profile.role))
    .slice(0, 5)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
      }}>
      <div className="flex">
        {visibleItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-1 min-h-[52px] transition-colors"
            >
              <item.icon
                className={cn('w-5 h-5')}
                style={{ color: active ? '#1C2B23' : '#86868B' }}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span className="text-[10px] font-medium" style={{ color: active ? '#1C2B23' : '#86868B' }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

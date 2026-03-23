'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Truck,
  Bell,
  BarChart3,
  Users,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard, roles: ['director', 'admin', 'empleado'], exact: true },
  { href: '/sales', label: 'Ventas', icon: Receipt, roles: ['director', 'admin'] },
  { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['director', 'admin', 'empleado'] },
  { href: '/stock', label: 'Stock', icon: Package, roles: ['director', 'admin', 'empleado'] },
  { href: '/suppliers', label: 'Pedidos', icon: Truck, roles: ['director', 'admin'] },
  { href: '/alerts', label: 'Alertas', icon: Bell, roles: ['director', 'admin'] },
  { href: '/analytics', label: 'Reportes', icon: BarChart3, roles: ['director', 'admin'] },
]

interface Props {
  profile: Profile
}

export function MobileNav({ profile }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems
    .filter((item) => item.roles.includes(profile.role))
    .slice(0, 5) // max 5 items in bottom nav

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {visibleItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors min-h-[52px]',
                isActive ? 'text-neutral-900' : 'text-neutral-400'
              )}
            >
              <item.icon
                className={cn('w-5 h-5', isActive ? 'text-neutral-900' : 'text-neutral-400')}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

'use client'

import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface HeaderProps {
  title: string
  alertCount?: number
}

export function Header({ title, alertCount = 0 }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-white sticky top-0 z-10">
      <h1 className="text-sm font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        <Link href="/alerts" className="relative p-2 rounded-md hover:bg-neutral-100 transition-colors">
          <Bell className="w-4 h-4 text-neutral-600" />
          {alertCount > 0 && (
            <Badge
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] bg-black text-white border-0 flex items-center justify-center"
            >
              {alertCount > 9 ? '9+' : alertCount}
            </Badge>
          )}
        </Link>
      </div>
    </header>
  )
}

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  accent?: string
  className?: string
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, accent, className }: StatsCardProps) {
  return (
    <div className={cn('rounded-2xl p-5 flex flex-col gap-3', className)}
      style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#86868B' }}>{title}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent ?? '#F5F5F7' }}>
          <Icon className="w-4 h-4" style={{ color: accent ? '#fff' : '#86868B' }} strokeWidth={1.75} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight" style={{ color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </p>
        {subtitle && (
          <p className={cn('text-[12px] mt-1 font-medium',
            trend === 'up' && 'text-green-500',
            trend === 'down' && 'text-red-500',
            (!trend || trend === 'neutral') && ''
          )} style={(!trend || trend === 'neutral') ? { color: '#86868B' } : {}}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

import { Card } from '@/components/ui/card'
import { GlowingEffect } from '@/components/ui/glowing-effect'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <div className="relative rounded-xl">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
      />
      <Card className={cn('relative p-5 border-border bg-white rounded-xl', className)}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            {subtitle && (
              <p className={cn(
                'text-xs mt-1',
                trend === 'up' && 'text-emerald-600',
                trend === 'down' && 'text-red-500',
                trend === 'neutral' && 'text-muted-foreground',
                !trend && 'text-muted-foreground'
              )}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="w-9 h-9 bg-neutral-100 rounded-lg flex items-center justify-center shrink-0 ml-3">
            <Icon className="w-4.5 h-4.5 text-neutral-600" />
          </div>
        </div>
      </Card>
    </div>
  )
}

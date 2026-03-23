import { cn } from '@/lib/utils'

interface Props {
  className?: string
  size?: 'xs' | 'sm' | 'md'
}

export function MPLogo({ className, size = 'sm' }: Props) {
  const sizes = {
    xs: 'text-[10px] gap-0.5',
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
  }
  return (
    <span className={cn('inline-flex items-center font-extrabold tracking-tight leading-none', sizes[size], className)}>
      <svg
        viewBox="0 0 20 14"
        className={size === 'xs' ? 'w-3.5 h-2.5' : size === 'sm' ? 'w-4 h-3' : 'w-5 h-3.5'}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Oval background */}
        <ellipse cx="10" cy="7" rx="9.5" ry="6.5" fill="#009EE3" />
        {/* White stripe (Argentina flag middle) */}
        <rect x="0.5" y="4.5" width="19" height="5" fill="white" />
        {/* Handshake simplified */}
        <path d="M6 7 Q8 5.5 10 7 Q12 8.5 14 7" stroke="#009EE3" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <circle cx="8.5" cy="6.5" r="0.8" fill="#009EE3"/>
        <circle cx="11.5" cy="7.5" r="0.8" fill="#009EE3"/>
      </svg>
      <span style={{ color: '#009EE3' }}>mercado</span>
      <span style={{ color: '#009EE3' }}>pago</span>
    </span>
  )
}

// Badge version para usar en listas/tablas
export function MPBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', className)}
      style={{ backgroundColor: '#FFE600', color: '#009EE3' }}>
      <svg viewBox="0 0 16 11" className="w-3.5 h-2.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="8" cy="5.5" rx="7.5" ry="5" fill="#009EE3"/>
        <rect x="0.5" y="3.5" width="15" height="4" fill="white"/>
        <path d="M4.5 5.5 Q6.5 4 8 5.5 Q9.5 7 11.5 5.5" stroke="#009EE3" strokeWidth="1" strokeLinecap="round" fill="none"/>
      </svg>
      <span className="font-bold tracking-tight">mercadopago</span>
    </span>
  )
}

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
  size?: 'xs' | 'sm' | 'md'
}

const imgSizes = {
  xs: 24,
  sm: 40,
  md: 56,
}

export function MPLogo({ className, size = 'sm' }: Props) {
  const px = imgSizes[size]
  return (
    <Image
      src="/mp-logo.png"
      alt="MercadoPago"
      width={px}
      height={px}
      className={cn('object-contain rounded-md', className)}
    />
  )
}

// Badge version para usar en listas/tablas
export function MPBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full', className)}
      style={{ backgroundColor: '#FFE600' }}>
      <Image
        src="/mp-logo.png"
        alt="MercadoPago"
        width={14}
        height={14}
        className="object-contain rounded-sm"
      />
      <span className="text-[11px] font-bold tracking-tight" style={{ color: '#2D3277' }}>mercadopago</span>
    </span>
  )
}

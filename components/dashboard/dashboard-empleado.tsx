'use client'

import type { Profile, DashboardStats } from '@/types'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Package, DollarSign } from 'lucide-react'

interface Props {
  profile: Profile
  stats: DashboardStats
}

export function DashboardEmpleado({ profile, stats }: Props) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Hola, {profile.full_name.split(' ')[0]}</h2>
        <p className="text-sm text-muted-foreground">
          Sucursal {profile.branch?.name ?? ''} — turno activo
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 bg-white border-border">
          <ShoppingCart className="w-5 h-5 text-neutral-400 mb-2" />
          <p className="text-xs text-muted-foreground">Ventas hoy</p>
          <p className="text-2xl font-semibold">{stats.total_sales_today}</p>
        </Card>
        <Card className="p-5 bg-white border-border">
          <DollarSign className="w-5 h-5 text-neutral-400 mb-2" />
          <p className="text-xs text-muted-foreground">Facturación</p>
          <p className="text-2xl font-semibold">{formatCurrency(stats.total_revenue_today)}</p>
        </Card>
      </div>

      {/* Main action: POS */}
      <Card className="p-6 bg-black text-white border-0">
        <ShoppingCart className="w-6 h-6 mb-3 opacity-60" />
        <p className="text-base font-semibold">Punto de Venta</p>
        <p className="text-sm opacity-60 mt-1">Registrá ventas con MercadoPago o efectivo</p>
        <Link href="/pos">
          <Button size="sm" variant="outline" className="mt-4 border-white/30 text-white bg-transparent hover:bg-white/10">
            Abrir caja
          </Button>
        </Link>
      </Card>

      <Card className="p-5 bg-white border-border">
        <Package className="w-5 h-5 text-neutral-400 mb-2" />
        <p className="text-sm font-medium">Consultar stock</p>
        <p className="text-xs text-muted-foreground mt-1">Verificá disponibilidad de productos</p>
        <Link href="/stock">
          <Button variant="link" className="px-0 text-xs h-auto mt-2 text-muted-foreground hover:text-black">
            Ver stock →
          </Button>
        </Link>
      </Card>
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import type { Branch, Profile } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Search, ShoppingCart, Banknote } from 'lucide-react'
import { MPBadge } from '@/components/ui/mp-logo'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface SaleRow {
  id: string
  total: number
  payment_method: string
  created_at: string
  branch_id: string
  branch?: { name: string }
  user?: { full_name: string }
  items?: { id: string }[]
}

interface Props {
  sales: SaleRow[]
  branches: Branch[]
  profile: Profile
}

export function SalesModule({ sales, branches, profile }: Props) {
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (branchFilter !== 'all' && s.branch_id !== branchFilter) return false
      if (methodFilter !== 'all' && s.payment_method !== methodFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!s.user?.full_name?.toLowerCase().includes(q) && !s.branch?.name?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [sales, branchFilter, methodFilter, search])

  const totalRevenue = filtered.reduce((s, v) => s + v.total, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ventas</h2>
          <p className="text-sm text-muted-foreground">{sales.length} ventas registradas</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total filtrado</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por vendedor o sucursal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {profile.role === 'director' && (
          <Select value={branchFilter} onValueChange={(v) => v && setBranchFilter(v)}>
            <SelectTrigger className="h-8 text-xs w-40">
              <span>{branchFilter === 'all' ? 'Todas las sucursales' : (branches.find(b => b.id === branchFilter)?.name ?? 'Sucursal')}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={methodFilter} onValueChange={(v) => v && setMethodFilter(v)}>
          <SelectTrigger className="h-8 text-xs w-40">
            <span>{methodFilter === 'all' ? 'Todos los pagos' : methodFilter === 'efectivo' ? 'Efectivo' : 'Mercado Pago'}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los pagos</SelectItem>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="mercadopago">Mercado Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-neutral-50">
                <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">#</th>
                <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
                <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sucursal</th>
                <th className="hidden sm:table-cell text-left px-3 md:px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendedor</th>
                <th className="hidden md:table-cell text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Productos</th>
                <th className="text-center px-3 md:px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pago</th>
                <th className="text-right px-3 md:px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No hay ventas registradas
                  </td>
                </tr>
              ) : (
                filtered.map((sale) => (
                  <tr key={sale.id} className="hover:bg-neutral-50 transition-colors cursor-pointer group">
                    <td className="px-3 md:px-4 py-3">
                      <Link href={`/sales/${sale.id}`} className="block">
                        <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                          #{sale.id.slice(0, 6).toUpperCase()}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      <Link href={`/sales/${sale.id}`} className="block">
                        <p className="text-xs font-medium">
                          {new Date(sale.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </Link>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <Link href={`/sales/${sale.id}`} className="block text-sm text-muted-foreground">
                        {sale.branch?.name ?? '—'}
                      </Link>
                    </td>
                    <td className="hidden sm:table-cell px-3 md:px-4 py-3">
                      <Link href={`/sales/${sale.id}`} className="block text-sm">
                        {sale.user?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-center">
                      <Link href={`/sales/${sale.id}`} className="block">
                        <Badge variant="outline" className="text-xs tabular-nums">
                          {sale.items?.length ?? 0} ítem{(sale.items?.length ?? 0) !== 1 ? 's' : ''}
                        </Badge>
                      </Link>
                    </td>
                    <td className="px-3 md:px-4 py-3 text-center">
                      <Link href={`/sales/${sale.id}`} className="block">
                        {sale.payment_method === 'efectivo' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <Banknote className="w-3 h-3" /><span className="hidden sm:inline">Efectivo</span>
                          </span>
                        ) : (
                          <MPBadge />
                        )}
                      </Link>
                    </td>
                    <td className="px-3 md:px-4 py-3 text-right">
                      <Link href={`/sales/${sale.id}`} className="block font-semibold tabular-nums text-sm">
                        {formatCurrency(sale.total)}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

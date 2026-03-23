'use client'

import { useState, useMemo } from 'react'
import type { Stock, Branch, Product, Profile } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, AlertTriangle, Camera, History } from 'lucide-react'
import { ProductDialog } from './product-dialog'
import { ScanDeliveryDialog } from './scan-delivery-dialog'
import { StockMovementsDialog } from './stock-movements-dialog'
import { cn } from '@/lib/utils'

interface Props {
  stockItems: Stock[]
  branches: Branch[]
  products: Product[]
  profile: Profile
}

export function StockModule({ stockItems, branches, products, profile }: Props) {
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showProductDialog, setShowProductDialog] = useState(false)
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [movementsItem, setMovementsItem] = useState<Stock | null>(null)

  const isAdmin = profile.role !== 'empleado'

  const filtered = useMemo(() => {
    return stockItems.filter((item) => {
      const name = item.product?.name?.toLowerCase() ?? ''
      const category = item.product?.category?.toLowerCase() ?? ''
      const q = search.toLowerCase()
      if (search && !name.includes(q) && !category.includes(q)) return false
      if (branchFilter !== 'all' && item.branch_id !== branchFilter) return false
      if (statusFilter === 'low' && item.quantity > item.min_quantity) return false
      if (statusFilter === 'ok' && item.quantity <= item.min_quantity) return false
      return true
    })
  }, [stockItems, search, branchFilter, statusFilter])

  const lowStockCount = stockItems.filter((i) => i.quantity <= i.min_quantity).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inventario</h2>
          <p className="text-sm text-muted-foreground">
            {stockItems.length} ítems
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-500 font-medium">{lowStockCount} bajo stock mínimo</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScanDialog(true)}
              className="h-8 text-xs gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              Escanear pedido IA
            </Button>
            <Button
              size="sm"
              onClick={() => setShowProductDialog(true)}
              className="h-8 text-xs gap-1.5 bg-black text-white hover:bg-neutral-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo producto
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {profile.role === 'director' && (
          <Select value={branchFilter} onValueChange={(v) => v && setBranchFilter(v)}>
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="low">Stock bajo</SelectItem>
            <SelectItem value="ok">Stock ok</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-neutral-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoría</th>
                {profile.role === 'director' && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sucursal</th>
                )}
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mínimo</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Precio venta</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No hay productos que coincidan con la búsqueda
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isLow = item.quantity <= item.min_quantity
                  const isCritical = item.quantity === 0
                  return (
                    <tr key={item.id} className={cn('hover:bg-neutral-50 transition-colors', isLow && 'bg-red-50/30')}>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          {item.product?.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.product?.category}</td>
                      {profile.role === 'director' && (
                        <td className="px-4 py-3 text-muted-foreground">{item.branch?.name}</td>
                      )}
                      <td className={cn('px-4 py-3 text-right font-medium tabular-nums', isCritical && 'text-red-600', isLow && !isCritical && 'text-amber-600')}>
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{item.min_quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(item.product?.sell_price ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] border-0',
                            isCritical ? 'bg-red-100 text-red-700' :
                            isLow ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {isCritical ? 'Sin stock' : isLow ? 'Stock bajo' : 'OK'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setMovementsItem(item)}
                          className="p-1.5 rounded hover:bg-neutral-100 transition-colors text-muted-foreground hover:text-foreground"
                          title="Ver movimientos"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showProductDialog && (
        <ProductDialog
          branches={branches}
          open={showProductDialog}
          onClose={() => setShowProductDialog(false)}
          profileBranchId={profile.branch_id}
          isDirector={profile.role === 'director'}
        />
      )}

      {showScanDialog && (
        <ScanDeliveryDialog
          open={showScanDialog}
          onClose={() => setShowScanDialog(false)}
          products={products}
          branches={branches}
          profileBranchId={profile.branch_id}
          isDirector={profile.role === 'director'}
        />
      )}

      {movementsItem && (
        <StockMovementsDialog
          open={!!movementsItem}
          onClose={() => setMovementsItem(null)}
          stockItem={movementsItem}
          profile={profile}
        />
      )}
    </div>
  )
}

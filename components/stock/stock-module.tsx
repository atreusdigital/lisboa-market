'use client'

import { useState, useMemo } from 'react'
import type { Stock, Branch, Product, Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, AlertTriangle, Camera, History, Pencil, Upload, Trash2, AlertOctagon } from 'lucide-react'
import { ProductDialog } from './product-dialog'
import { ScanDeliveryDialog } from './scan-delivery-dialog'
import { StockMovementsDialog } from './stock-movements-dialog'
import { BulkImportDialog } from './bulk-import-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  stockItems: Stock[]
  branches: Branch[]
  products: Product[]
  profile: Profile
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function rentabilidad(sell: number, cost: number) {
  if (!sell || sell === 0) return '—'
  return ((sell - cost) / sell * 100).toFixed(2) + '%'
}

export function StockModule({ stockItems, branches, products, profile }: Props) {
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showProductDialog, setShowProductDialog] = useState(false)
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [movementsItem, setMovementsItem] = useState<Stock | null>(null)
  const [editItem, setEditItem] = useState<Stock | null>(null)
  const [starFilter, setStarFilter] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const supabase = createClient()

  async function handleClearCatalog() {
    setClearing(true)
    try {
      const { error } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) throw error
      toast.success('Catálogo eliminado. Podés importar el nuevo CSV.')
      setShowClearConfirm(false)
      window.location.reload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error al limpiar: ${msg}`)
    } finally {
      setClearing(false)
    }
  }

  const isAdmin = profile.role !== 'empleado'

  // Combine stockItems with virtual entries for products that have no stock entry
  const allItems = useMemo(() => {
    const stockedProductIds = new Set(stockItems.map(s => s.product_id))
    const fallbackBranch = branches[0]?.id ?? ''
    const virtual = products
      .filter(p => !stockedProductIds.has(p.id))
      .map(p => ({
        id: `virtual-${p.id}`,
        product_id: p.id,
        product: p,
        branch_id: fallbackBranch,
        quantity: 0,
        min_quantity: 0,
        created_at: '',
        updated_at: '',
      } as unknown as Stock))
    return [...stockItems, ...virtual]
  }, [stockItems, products, branches])

  async function toggleStar(productId: string, current: boolean) {
    await supabase.from('products').update({ is_star: !current }).eq('id', productId)
    window.location.reload()
  }

  async function handleDelete(item: Stock) {
    if (!confirm(`¿Borrar "${item.product?.name}"? Esta acción no se puede deshacer.`)) return
    if (!String(item.id).startsWith('virtual-')) {
      await supabase.from('stock').delete().eq('id', item.id)
    }
    await supabase.from('products').delete().eq('id', item.product_id)
    toast.success('Producto eliminado')
    window.location.reload()
  }

  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      const name = item.product?.name?.toLowerCase() ?? ''
      const category = item.product?.category?.toLowerCase() ?? ''
      const barcode = item.product?.barcode ?? ''
      const q = search.toLowerCase()
      if (search && !name.includes(q) && !category.includes(q) && !barcode.includes(q)) return false
      if (branchFilter !== 'all' && item.branch_id !== branchFilter) return false
      if (statusFilter === 'low' && item.quantity > item.min_quantity) return false
      if (statusFilter === 'ok' && item.quantity <= item.min_quantity) return false
      if (starFilter && !item.product?.is_star) return false
      return true
    })
  }, [allItems, search, branchFilter, statusFilter, starFilter])

  const lowStockCount = allItems.filter((i) => i.quantity <= i.min_quantity).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Inventario</h2>
          <p className="text-sm text-muted-foreground">
            {stockItems.length} productos
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-500 font-medium">{lowStockCount} bajo stock mínimo</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)} className="h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400">
              <Trash2 className="w-3.5 h-3.5" /> Limpiar catálogo
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)} className="h-8 text-xs gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Importar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowScanDialog(true)} className="h-8 text-xs gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Escanear pedido IA
            </Button>
            <Button size="sm" onClick={() => setShowProductDialog(true)} className="h-8 text-xs gap-1.5 bg-black text-white hover:bg-neutral-800">
              <Plus className="w-3.5 h-3.5" /> Nuevo producto
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, categoría o código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
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
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="h-8 text-xs w-32">
            <span>{statusFilter === 'all' ? 'Todos' : statusFilter === 'low' ? 'Stock bajo' : 'Stock ok'}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="low">Stock bajo</SelectItem>
            <SelectItem value="ok">Stock ok</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => setStarFilter(!starFilter)}
          className={`h-8 px-3 rounded-md border text-xs flex items-center gap-1.5 transition-colors ${starFilter ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-border bg-white text-muted-foreground hover:border-amber-200'}`}
        >
          ⭐ Estrella
        </button>
      </div>

      {/* Tabla */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-border bg-neutral-50">
                <th className="px-2 py-2.5 w-6"></th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Codigo</th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider min-w-[180px]">Descripcion</th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">categoria</th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">subcategoria</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Lista<br/>Mostrador</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Lista<br/>PedidosYa</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Lista<br/>Rappi</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Costo</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Rentabilidad</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Stock<br/>Minimo</th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider min-w-[130px]">Ult. Modificacion<br/>Precio</th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider min-w-[130px]">Ult. Modificacion<br/>Costo</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider min-w-[120px]">Mov Stock</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                {isAdmin && <th className="text-center px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Editar</th>}
                {isAdmin && <th className="text-center px-2 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Borrar</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={18} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No hay productos que coincidan con la búsqueda
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const p = item.product
                  const isLow = item.quantity <= item.min_quantity
                  const isCritical = item.quantity === 0
                  return (
                    <tr key={item.id} className={cn('hover:bg-neutral-50/80 transition-colors', isLow && 'bg-red-50/30')}>
                      {/* Star */}
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => toggleStar(item.product_id, p?.is_star ?? false)} className="opacity-50 hover:opacity-100 transition-opacity text-sm leading-none">
                          {p?.is_star ? '⭐' : '☆'}
                        </button>
                      </td>
                      {/* Codigo */}
                      <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">{p?.barcode ?? '—'}</td>
                      {/* Descripcion */}
                      <td className="px-2 py-2 font-medium max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          {isLow && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                          <span className="truncate">{p?.name}</span>
                        </div>
                      </td>
                      {/* Categoria */}
                      <td className="px-2 py-2 text-muted-foreground">{p?.category ?? '—'}</td>
                      {/* Subcategoria */}
                      <td className="px-2 py-2 text-muted-foreground">{p?.subcategory ?? '—'}</td>
                      {/* Lista Mostrador */}
                      <td className="px-2 py-2 text-right tabular-nums font-medium">{fmt(p?.sell_price ?? 0)}</td>
                      {/* Lista PedidosYa */}
                      <td className="px-2 py-2 text-right tabular-nums text-blue-700">{p?.pedidos_ya_price ? fmt(p.pedidos_ya_price) : '—'}</td>
                      {/* Lista Rappi */}
                      <td className="px-2 py-2 text-right tabular-nums text-orange-600">{p?.rappi_price ? fmt(p.rappi_price) : '—'}</td>
                      {/* Costo */}
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{p?.cost_price ? fmt(p.cost_price) : '—'}</td>
                      {/* Rentabilidad */}
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-700 font-medium">
                        {rentabilidad(p?.sell_price ?? 0, p?.cost_price ?? 0)}
                      </td>
                      {/* Stock Minimo */}
                      <td className="px-2 py-2 text-right tabular-nums">{item.min_quantity}</td>
                      {/* Ult. Modificacion Precio */}
                      <td className="px-2 py-2 text-muted-foreground text-[10px]">
                        {p?.sell_price_updated_at
                          ? `${p.sell_price_updated_at}${p.sell_price_updated_by ? ` (${p.sell_price_updated_by})` : ''}`
                          : '—'}
                      </td>
                      {/* Ult. Modificacion Costo */}
                      <td className="px-2 py-2 text-muted-foreground text-[10px]">
                        {p?.cost_updated_at
                          ? `${p.cost_updated_at}${p.cost_updated_by ? ` (${p.cost_updated_by})` : ''}`
                          : '—'}
                      </td>
                      {/* Stock */}
                      <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : '')}>
                        {item.quantity}
                      </td>
                      {/* Mov Stock */}
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isAdmin && (
                            <button
                              onClick={() => setEditItem(item)}
                              className="text-[10px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                            >
                              Carga Manual
                            </button>
                          )}
                          <button
                            onClick={() => setMovementsItem(item)}
                            className="text-[10px] px-2 py-1 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300 transition-colors font-medium"
                          >
                            Detalle
                          </button>
                        </div>
                      </td>
                      {/* Estado */}
                      <td className="px-2 py-2 text-center">
                        <Badge variant="outline" className={cn('text-[10px] border-0', isCritical ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                          {isCritical ? 'Sin stock' : isLow ? 'Bajo' : 'OK'}
                        </Badge>
                      </td>
                      {/* Editar */}
                      {isAdmin && (
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => setEditItem(item)} className="text-[10px] px-2 py-1 rounded bg-neutral-800 text-white hover:bg-black transition-colors font-medium">
                            Editar
                          </button>
                        </td>
                      )}
                      {/* Borrar */}
                      {isAdmin && (
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => handleDelete(item)} className="text-[10px] px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors font-medium">
                            Borrar
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      {showProductDialog && (
        <ProductDialog branches={branches} open={showProductDialog} onClose={() => setShowProductDialog(false)} profileBranchId={profile.branch_id} isDirector={profile.role === 'director'} userId={profile.id} />
      )}
      {editItem && (
        <ProductDialog branches={branches} open={!!editItem} onClose={() => setEditItem(null)} profileBranchId={profile.branch_id} isDirector={profile.role === 'director'} userId={profile.id} editProduct={editItem.product as any} editStockItem={editItem} />
      )}
      {showScanDialog && (
        <ScanDeliveryDialog open={showScanDialog} onClose={() => setShowScanDialog(false)} products={products} branches={branches} profileBranchId={profile.branch_id} isDirector={profile.role === 'director'} />
      )}
      {movementsItem && (
        <StockMovementsDialog open={!!movementsItem} onClose={() => setMovementsItem(null)} stockItem={movementsItem} profile={profile} />
      )}
      {showBulkImport && (
        <BulkImportDialog open={showBulkImport} onClose={() => setShowBulkImport(false)} branches={branches} profileBranchId={profile.branch_id} isDirector={profile.role === 'director'} />
      )}

      {/* Confirm clear catalog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">¿Eliminar todo el catálogo?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Esta acción borra todos los productos y su stock. No se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setShowClearConfirm(false)} disabled={clearing}>
                Cancelar
              </Button>
              <Button className="flex-1 h-9 text-sm bg-red-600 hover:bg-red-700 text-white" onClick={handleClearCatalog} disabled={clearing}>
                {clearing ? 'Eliminando...' : 'Sí, eliminar todo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

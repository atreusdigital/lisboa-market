'use client'

import { useState } from 'react'
import type { Supplier, SupplierOrder, SupplierOrderItem, AccountPayable, Branch, Product, Profile } from '@/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, AlertCircle, CheckCircle, Clock, Package, Image as ImageIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { NewOrderDialog } from './new-order-dialog'
import { AddSupplierDialog } from './add-supplier-dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const LISBOA_GREEN = '#1C2B23'

interface Props {
  suppliers: Supplier[]
  orders: SupplierOrder[]
  accounts: AccountPayable[]
  branches: Branch[]
  products: Product[]
  profile: Profile
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente pago', color: 'bg-amber-100 text-amber-700', icon: Clock },
  received: { label: 'Recibido', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  confirmed: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: AlertCircle },
}

export function SuppliersModule({ suppliers, orders, accounts, branches, products, profile }: Props) {
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [activeTab, setActiveTab] = useState('orders')
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null)
  const [orderItems, setOrderItems] = useState<SupplierOrderItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [purchases, setPurchases] = useState<any[]>([])
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null)
  const [purchaseItemsMap, setPurchaseItemsMap] = useState<Record<string, any[]>>({})
  const supabase = createClient()

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  async function openOrderDetail(order: SupplierOrder) {
    setSelectedOrder(order)
    setLoadingItems(true)
    const { data } = await supabase
      .from('supplier_order_items')
      .select('*, product:products(name, category)')
      .eq('order_id', order.id)
    setOrderItems(data ?? [])
    setLoadingItems(false)
  }

  async function loadPurchases() {
    if (purchases.length > 0) return
    setLoadingPurchases(true)
    const branchParam = profile.role === 'admin' && profile.branch_id ? `?branch_id=${profile.branch_id}` : ''
    const res = await fetch(`/api/purchases${branchParam}`)
    const data = await res.json()
    setPurchases(data)
    setLoadingPurchases(false)
  }

  async function togglePurchase(purchase: any) {
    if (expandedPurchaseId === purchase.id) { setExpandedPurchaseId(null); return }
    setExpandedPurchaseId(purchase.id)
    if (!purchaseItemsMap[purchase.id]) {
      const res = await fetch(`/api/purchases?id=${purchase.id}`)
      const data = await res.json()
      setPurchaseItemsMap(prev => ({ ...prev, [purchase.id]: data }))
    }
  }

  async function confirmOrder(orderId: string) {
    const { error } = await supabase
      .from('supplier_orders')
      .update({ status: 'confirmed' })
      .eq('id', orderId)

    if (error) { toast.error('Error al confirmar pedido'); return }
    toast.success('Pedido confirmado')
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Compras</h2>
          <p className="text-sm text-muted-foreground">{orders.length} pedidos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowAddSupplier(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar proveedor
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 text-white"
            style={{ backgroundColor: LISBOA_GREEN }}
            onClick={() => setShowNewOrder(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo pedido
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v === 'purchases') loadPurchases() }}>
        <TabsList className="h-8">
          <TabsTrigger value="purchases" className="text-xs h-7">Historial de compras</TabsTrigger>
          <TabsTrigger value="orders" className="text-xs h-7">Pedidos</TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs h-7">Cuentas corrientes</TabsTrigger>
          <TabsTrigger value="suppliers" className="text-xs h-7">Proveedores</TabsTrigger>
        </TabsList>

        {/* HISTORIAL DE COMPRAS (scan-delivery) */}
        <TabsContent value="purchases" className="mt-4">
          {loadingPurchases ? (
            <p className="text-sm text-muted-foreground text-center py-10">Cargando...</p>
          ) : purchases.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No hay compras registradas</p>
              <p className="text-xs mt-1">Escaneá una factura desde Productos → Escanear remito</p>
            </div>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => {
                const isOpen = expandedPurchaseId === p.id
                const items = purchaseItemsMap[p.id]
                return (
                  <Card key={p.id} className={cn('border-border overflow-hidden transition-all', isOpen && 'border-neutral-400')}>
                    {/* Header row — clickable */}
                    <button
                      className="w-full flex items-stretch text-left hover:bg-neutral-50 transition-colors"
                      onClick={() => togglePurchase(p)}
                    >
                      {/* Thumbnail */}
                      <div className="w-16 shrink-0 border-r border-border bg-neutral-50 flex items-center justify-center min-h-[64px]">
                        {p.invoice_image_url
                          ? <img src={p.invoice_image_url} alt="Factura" className="w-full h-full object-cover" />
                          : <ImageIcon className="w-4 h-4 text-neutral-300" />}
                      </div>
                      <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{p.proveedor ?? 'Proveedor desconocido'}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>{p.fecha ?? new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                            {p.numero_factura && <span>Fact. #{p.numero_factura}</span>}
                            <span>{p.items_count} productos</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            {p.total && <p className="text-sm font-bold tabular-nums">{formatCurrency(p.total)}</p>}
                            {p.iva_monto && <p className="text-xs text-muted-foreground">IVA {formatCurrency(p.iva_monto)}</p>}
                          </div>
                          <svg className={cn('w-4 h-4 text-neutral-400 transition-transform shrink-0', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="border-t border-border">
                        {/* Totals bar */}
                        <div className="px-4 py-3 bg-neutral-50 flex flex-wrap gap-x-6 gap-y-1 text-xs border-b border-border">
                          {p.subtotal && <span className="text-muted-foreground">Subtotal: <strong className="text-foreground tabular-nums">{formatCurrency(p.subtotal)}</strong></span>}
                          {p.iva_monto && <span className="text-muted-foreground">IVA: <strong className="text-foreground tabular-nums">{formatCurrency(p.iva_monto)}</strong></span>}
                          {p.iibb_monto && <span className="text-muted-foreground">IIBB: <strong className="text-foreground tabular-nums">{formatCurrency(p.iibb_monto)}</strong></span>}
                          {p.total && <span className="text-muted-foreground font-semibold">Total: <strong className="text-foreground tabular-nums">{formatCurrency(p.total)}</strong></span>}
                          {p.invoice_image_url && (
                            <a href={p.invoice_image_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-600 hover:underline flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> Ver factura
                            </a>
                          )}
                        </div>

                        {/* Items table */}
                        {!items ? (
                          <p className="text-xs text-muted-foreground text-center py-4">Cargando...</p>
                        ) : items.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">Sin ítems</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Producto</th>
                                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Cant.</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Costo c/u</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total costo</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Mostrador</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Rent.</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {items.map((item: any) => (
                                  <tr key={item.id} className="hover:bg-neutral-50">
                                    <td className="px-4 py-2.5">
                                      <p className="font-medium text-foreground">{item.product?.name ?? '—'}</p>
                                      {item.descripcion_factura !== item.product?.name && (
                                        <p className="text-muted-foreground text-[10px] mt-0.5">{item.descripcion_factura}</p>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center tabular-nums">{item.cantidad}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{item.costo_unit ? formatCurrency(item.costo_unit) : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{item.costo_total ? formatCurrency(item.costo_total) : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{item.sell_price ? formatCurrency(item.sell_price) : '—'}</td>
                                    <td className={cn('px-3 py-2.5 text-right tabular-nums font-semibold', item.rent_pct >= 20 ? 'text-emerald-600' : item.rent_pct !== null ? 'text-red-500' : '')}>
                                      {item.rent_pct !== null ? `${item.rent_pct}%` : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* PEDIDOS */}
        <TabsContent value="orders" className="mt-4">
          <Card className="border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-neutral-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proveedor</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sucursal</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No hay pedidos registrados
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const status = statusConfig[order.status] ?? statusConfig.pending
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-neutral-50 transition-colors cursor-pointer"
                          onClick={() => openOrderDetail(order)}
                        >
                          <td className="px-4 py-3 font-medium">{order.supplier?.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{order.branch?.name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(order.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(order.total)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={cn('text-[10px] border-0', status.color)}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {order.status === 'received' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => confirmOrder(order.id)}
                              >
                                Confirmar
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* CUENTAS CORRIENTES */}
        <TabsContent value="accounts" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <Card key={account.id} className="p-5 border-border bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{account.supplier?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{account.branch?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-lg font-bold tabular-nums', account.balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.balance > 0 ? 'Deuda' : 'Sin deuda'}
                    </p>
                  </div>
                </div>
                {account.balance > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Saldo pendiente de pago
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* PROVEEDORES */}
        <TabsContent value="suppliers" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {suppliers.map((supplier) => (
              <Card key={supplier.id} className="p-5 border-border bg-white">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: LISBOA_GREEN }}>
                  <span className="text-white text-xs font-bold">{supplier.name.charAt(0)}</span>
                </div>
                <p className="font-semibold text-sm">{supplier.name}</p>
                {supplier.contact_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">{supplier.contact_name}</p>
                )}
                {supplier.phone && (
                  <p className="text-xs text-muted-foreground">{supplier.phone}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {orders.filter((o) => o.supplier_id === supplier.id).length} pedidos
                </p>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGO DETALLE DE PEDIDO */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Pedido — {selectedOrder.supplier?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Sucursal</p>
                  <p className="font-medium">{selectedOrder.branch?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {new Date(selectedOrder.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Badge className={cn('text-[10px] border-0 mt-0.5', (statusConfig[selectedOrder.status] ?? statusConfig.pending).color)}>
                    {(statusConfig[selectedOrder.status] ?? statusConfig.pending).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold text-base">{formatCurrency(selectedOrder.total)}</p>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="text-xs text-muted-foreground bg-neutral-50 rounded p-3">
                  {selectedOrder.notes}
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Productos del pedido</p>
                {loadingItems ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
                ) : orderItems.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Sin ítems registrados</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.product?.name}</p>
                          <p className="text-xs text-muted-foreground">{item.product?.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums">×{item.quantity_ordered}</p>
                          {item.unit_price > 0 && (
                            <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.unit_price)} c/u</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showNewOrder && (
        <NewOrderDialog
          open={showNewOrder}
          onClose={() => setShowNewOrder(false)}
          suppliers={suppliers}
          branches={branches}
          products={products}
          profile={profile}
        />
      )}

      {showAddSupplier && (
        <AddSupplierDialog
          open={showAddSupplier}
          onClose={() => setShowAddSupplier(false)}
        />
      )}
    </div>
  )
}

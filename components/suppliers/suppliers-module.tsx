'use client'

import { useState } from 'react'
import type { Supplier, SupplierOrder, SupplierOrderItem, AccountPayable, Branch, Product, Profile } from '@/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, AlertCircle, CheckCircle, Clock, Package } from 'lucide-react'
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
          <h2 className="text-lg font-semibold">Proveedores</h2>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="orders" className="text-xs h-7">Pedidos</TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs h-7">Cuentas corrientes</TabsTrigger>
          <TabsTrigger value="suppliers" className="text-xs h-7">Proveedores</TabsTrigger>
        </TabsList>

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

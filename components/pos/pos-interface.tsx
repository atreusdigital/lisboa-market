'use client'

import { useState, useMemo } from 'react'
import type { Stock, Profile, CartItem, Branch } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Search, Plus, Minus, Trash2, ShoppingCart, Banknote, Package } from 'lucide-react'
import { MPLogo } from '@/components/ui/mp-logo'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MPPaymentModal } from './mp-payment-modal'

const LISBOA_GREEN = '#1C2B23'

interface Props {
  stockItems: Stock[]
  branches: Branch[]
  profile: Profile
}

export function POSInterface({ stockItems, branches, profile }: Props) {
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'mercadopago'>('efectivo')
  const [loading, setLoading] = useState(false)
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')
  const [mpModal, setMpModal] = useState<{ externalReference: string } | null>(null)
  // Directors choose branch; others use their assigned branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>(profile.branch_id ?? '')
  const supabase = createClient()

  const branchStock = useMemo(() =>
    selectedBranchId ? stockItems.filter((s) => s.branch_id === selectedBranchId) : [],
    [stockItems, selectedBranchId]
  )

  const filteredStock = useMemo(() => {
    if (!search) return branchStock.slice(0, 30)
    const q = search.toLowerCase()
    return branchStock.filter(
      (item) =>
        item.product?.name?.toLowerCase().includes(q) ||
        item.product?.category?.toLowerCase().includes(q) ||
        item.product?.barcode?.includes(q)
    )
  }, [branchStock, search])

  function addToCart(item: Stock) {
    const existing = cart.find((c) => c.product.id === item.product?.id)
    if (existing) {
      if (existing.quantity >= item.quantity) {
        toast.error('No hay más stock disponible')
        return
      }
      setCart((prev) =>
        prev.map((c) =>
          c.product.id === item.product?.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      )
    } else {
      setCart((prev) => [
        ...prev,
        { product: item.product!, quantity: 1, stock_available: item.quantity },
      ])
    }
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== productId) return c
          const newQty = c.quantity + delta
          if (newQty <= 0) return null
          if (newQty > c.stock_available) {
            toast.error('Stock insuficiente')
            return c
          }
          return { ...c, quantity: newQty }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId))
  }

  const total = cart.reduce((sum, c) => sum + c.product.sell_price * c.quantity, 0)
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  async function recordSale(mpPaymentId?: string) {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        branch_id: selectedBranchId,
        user_id: profile.id,
        total,
        payment_method: paymentMethod,
        mp_payment_id: mpPaymentId ?? null,
      })
      .select()
      .single()

    if (saleError) throw saleError

    const items = cart.map((c) => ({
      sale_id: sale.id,
      product_id: c.product.id,
      quantity: c.quantity,
      unit_price: c.product.sell_price,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(items)
    if (itemsError) throw itemsError

    for (const cartItem of cart) {
      const stockItem = stockItems.find(
        (s) => s.product?.id === cartItem.product.id && s.branch_id === selectedBranchId
      )
      if (stockItem) {
        await supabase
          .from('stock')
          .update({ quantity: stockItem.quantity - cartItem.quantity })
          .eq('id', stockItem.id)

        // Registrar movimiento de stock por venta
        await supabase.from('stock_movements').insert({
          product_id: cartItem.product.id,
          branch_id: selectedBranchId,
          user_id: profile.id,
          type: 'sale',
          quantity: -cartItem.quantity,
          notes: `Venta #${sale.id.slice(0, 8).toUpperCase()}`,
        })
      }
    }

    await supabase.from('activity_log').insert({
      user_id: profile.id,
      action: 'sale',
      entity_type: 'sales',
      entity_id: sale.id,
      metadata: { total, payment_method: paymentMethod, items_count: cart.length },
    })

    return sale
  }

  async function handleCheckout() {
    if (cart.length === 0) return
    if (!selectedBranchId) {
      toast.error('Seleccioná una sucursal para continuar')
      return
    }

    // MercadoPago: abrir modal con QR
    if (paymentMethod === 'mercadopago') {
      const ref = `pos-${Date.now()}-${profile.id.slice(0, 8)}`
      setMpModal({ externalReference: ref })
      return
    }

    // Efectivo: registrar directo
    setLoading(true)
    try {
      await recordSale()
      toast.success(`Venta registrada: ${formatCurrency(total)}`)
      setCart([])
      setSearch('')
      setMobileTab('products')
    } catch (err) {
      toast.error('Error al registrar la venta')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleMPSuccess(paymentId: string) {
    setMpModal(null)
    setLoading(true)
    try {
      await recordSale(paymentId)
      toast.success(`Pago aprobado — Venta registrada: ${formatCurrency(total)}`)
      setCart([])
      setSearch('')
      setMobileTab('products')
    } catch (err) {
      toast.error('Error al registrar la venta')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const selectedBranchName = branches.find((b) => b.id === selectedBranchId)?.name
  const mpItems = cart.map((c) => ({
    title: c.product.name,
    quantity: c.quantity,
    unit_price: c.product.sell_price,
  }))

  // Componente carrito reutilizable
  const CartPanel = () => (
    <Card className="flex flex-col border-border bg-white h-full">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <ShoppingCart className="w-4 h-4" />
        <span className="font-semibold text-sm">Carrito</span>
        {cart.length > 0 && (
          <Badge variant="outline" className="ml-auto text-xs">{cart.length}</Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground gap-2 py-8">
            <ShoppingCart className="w-8 h-8 text-neutral-200" />
            <p>El carrito está vacío</p>
            <p className="text-xs">Seleccioná productos</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.product.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-neutral-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(item.product.sell_price)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-neutral-200 transition-colors">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-medium w-5 text-center tabular-nums">{item.quantity}</span>
                <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-neutral-200 transition-colors">
                  <Plus className="w-3 h-3" />
                </button>
                <button onClick={() => removeFromCart(item.product.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-100 text-red-500 transition-colors ml-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="text-xl font-bold tabular-nums">{formatCurrency(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPaymentMethod('efectivo')}
            className={cn('flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all', paymentMethod === 'efectivo' ? 'text-white border-0' : 'border-border bg-white text-muted-foreground hover:border-neutral-300')}
            style={paymentMethod === 'efectivo' ? { backgroundColor: LISBOA_GREEN } : {}}
          >
            <Banknote className="w-4 h-4" />
            Efectivo
          </button>
          <button
            onClick={() => setPaymentMethod('mercadopago')}
            className={cn('flex items-center justify-center py-2.5 rounded-lg border transition-all overflow-hidden', paymentMethod === 'mercadopago' ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-border bg-white hover:border-yellow-300')}
          >
            <MPLogo size="md" />
          </button>
        </div>

        <Button
          className="w-full text-white font-medium h-11"
          style={{ backgroundColor: LISBOA_GREEN }}
          disabled={cart.length === 0 || loading || !selectedBranchId}
          onClick={handleCheckout}
        >
          {loading ? 'Procesando...' : `Cobrar ${formatCurrency(total)}`}
        </Button>
      </div>
    </Card>
  )

  // Grid de productos reutilizable
  const ProductsGrid = () => (
    <div className="flex-1 flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedBranchId ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Seleccioná una sucursal para ver el stock disponible
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredStock.map((item) => {
              const inCart = cart.find((c) => c.product.id === item.product?.id)
              return (
                <button
                  key={item.id}
                  onClick={() => { addToCart(item); setMobileTab('products') }}
                  className={cn(
                    'bg-white border rounded-lg p-3 text-left hover:border-neutral-300 transition-all active:scale-95',
                    inCart ? 'border-2' : 'border-border'
                  )}
                  style={inCart ? { borderColor: LISBOA_GREEN } : {}}
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <p className="text-xs font-medium leading-tight line-clamp-2">
                      {item.product?.is_star && <span className="mr-1">⭐</span>}
                      {item.product?.name}
                    </p>
                    {inCart && (
                      <Badge className="text-[10px] shrink-0 px-1.5 text-white" style={{ backgroundColor: LISBOA_GREEN }}>
                        {inCart.quantity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1">{item.product?.category}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{formatCurrency(item.product?.sell_price ?? 0)}</p>
                    <span className="text-[10px] text-muted-foreground">stock: {item.quantity}</span>
                  </div>
                </button>
              )
            })}
            {filteredStock.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                No se encontraron productos
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)]">
      {/* Selector de sucursal para directores */}
      {profile.role === 'director' && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-neutral-50">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Sucursal:</span>
          <Select value={selectedBranchId} onValueChange={(v) => { if (v) { setSelectedBranchId(v); setCart([]) } }}>
            <SelectTrigger className="h-8 text-sm flex-1 md:w-48 md:flex-none">
              <span>{selectedBranchName ?? 'Seleccionar sucursal'}</span>
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Mobile: tabs */}
      <div className="md:hidden flex border border-border rounded-lg overflow-hidden shrink-0">
        <button
          onClick={() => setMobileTab('products')}
          className={cn('flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2', mobileTab === 'products' ? 'text-white' : 'bg-white text-muted-foreground')}
          style={mobileTab === 'products' ? { backgroundColor: LISBOA_GREEN } : {}}
        >
          <Package className="w-4 h-4" />
          Productos
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={cn('flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative', mobileTab === 'cart' ? 'text-white' : 'bg-white text-muted-foreground')}
          style={mobileTab === 'cart' ? { backgroundColor: LISBOA_GREEN } : {}}
        >
          <ShoppingCart className="w-4 h-4" />
          Carrito
          {cart.length > 0 && (
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', mobileTab === 'cart' ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white')}>
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile: panel activo */}
      <div className="md:hidden flex-1 min-h-0 flex flex-col">
        {mobileTab === 'products' ? (
          <>
            <ProductsGrid />
            {/* Botón flotante ir al carrito */}
            {cart.length > 0 && (
              <button
                onClick={() => setMobileTab('cart')}
                className="fixed bottom-[72px] right-4 z-30 text-white text-sm font-semibold px-4 py-3 rounded-full shadow-lg flex items-center gap-2"
                style={{ backgroundColor: LISBOA_GREEN }}
              >
                <ShoppingCart className="w-4 h-4" />
                Ver carrito ({cart.length}) · {formatCurrency(total)}
              </button>
            )}
          </>
        ) : (
          <CartPanel />
        )}
      </div>

      {/* Desktop: dos columnas */}
      <div className="hidden md:flex gap-5 flex-1 min-h-0">
        <ProductsGrid />
        <div className="w-72 xl:w-80 shrink-0">
          <CartPanel />
        </div>
      </div>

      {/* Modal de pago MercadoPago */}
      {mpModal && (
        <MPPaymentModal
          externalReference={mpModal.externalReference}
          items={mpItems}
          total={total}
          onSuccess={handleMPSuccess}
          onCancel={() => setMpModal(null)}
        />
      )}
    </div>
  )
}

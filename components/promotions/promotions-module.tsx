'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Tag, ToggleLeft, ToggleRight, X, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Promotion, PromotionType, TieredDiscountRule, NxForYRule, Profile } from '@/types'
import { cn } from '@/lib/utils'

interface SimpleProduct { id: string; name: string; category: string; barcode: string | null }

interface Props {
  promotions: Promotion[]
  products: SimpleProduct[]
  profile: Profile
}

const TYPE_LABELS: Record<PromotionType, string> = {
  tiered_discount: 'Descuento por cantidad',
  nx_for_y: 'NxM (2x1, 3x2…)',
}

const TYPE_DESCRIPTIONS: Record<PromotionType, string> = {
  tiered_discount: 'Distintos % de descuento según cantidad comprada',
  nx_for_y: 'El cliente lleva N y paga M (2x1, 3x2, 4x3…)',
}

type ApplyTo = 'all' | 'category' | 'products'

export function PromotionsModule({ promotions: initial, products, profile }: Props) {
  const [promotions, setPromotions] = useState<Promotion[]>(initial)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const isAdmin = profile.role !== 'empleado'

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<PromotionType>('tiered_discount')
  const [tieredRules, setTieredRules] = useState<TieredDiscountRule[]>([
    { quantity: 1, discount_pct: 0 },
    { quantity: 2, discount_pct: 20 },
  ])
  const [nxRules, setNxRules] = useState<NxForYRule[]>([{ buy: 2, pay: 1 }])

  // Aplicar a
  const [applyTo, setApplyTo] = useState<ApplyTo>('all')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [productSearch, setProductSearch] = useState('')

  const categories = useMemo(() => [...new Set(products.map(p => p.category))].sort(), [products])

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.barcode ?? '').includes(q)
    )
  }, [products, productSearch])

  function openNew() {
    setEditing(null)
    setName('')
    setType('tiered_discount')
    setTieredRules([{ quantity: 1, discount_pct: 0 }, { quantity: 2, discount_pct: 20 }])
    setNxRules([{ buy: 2, pay: 1 }])
    setApplyTo('all')
    setSelectedCategory('')
    setSelectedProductIds([])
    setProductSearch('')
    setShowDialog(true)
  }

  function openEdit(p: Promotion) {
    setEditing(p)
    setName(p.name)
    setType(p.type)
    if (p.type === 'tiered_discount') setTieredRules(p.rules as TieredDiscountRule[])
    else setNxRules(p.rules as NxForYRule[])
    setApplyTo('all')
    setSelectedCategory('')
    setSelectedProductIds([])
    setProductSearch('')
    setShowDialog(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('El nombre es requerido'); return }
    if (applyTo === 'category' && !selectedCategory) { toast.error('Seleccioná una categoría'); return }
    if (applyTo === 'products' && selectedProductIds.length === 0) { toast.error('Seleccioná al menos un producto'); return }

    const rules = type === 'tiered_discount' ? tieredRules : nxRules
    setSaving(true)

    let promotionId: string | null = editing?.id ?? null

    if (editing) {
      const { error } = await supabase
        .from('promotions')
        .update({ name: name.trim(), type, rules })
        .eq('id', editing.id)
      if (error) { toast.error(`Error: ${error.message}`); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('promotions')
        .insert({ name: name.trim(), type, rules, is_active: true })
        .select()
        .single()
      if (error) { toast.error(`Error: ${error.message}`); setSaving(false); return }
      promotionId = data.id
    }

    if (!promotionId) { setSaving(false); return }

    // Guardar productos asociados
    if (applyTo !== 'all') {
      // Borrar asociaciones anteriores
      await supabase.from('promotion_products').delete().eq('promotion_id', promotionId)

      let productIds: string[] = []
      if (applyTo === 'category') {
        productIds = products.filter(p => p.category === selectedCategory).map(p => p.id)
      } else {
        productIds = selectedProductIds
      }

      if (productIds.length > 0) {
        const { error } = await supabase.from('promotion_products').insert(
          productIds.map(pid => ({ promotion_id: promotionId, product_id: pid }))
        )
        if (error) toast.error(`Error al asignar productos: ${error.message}`)
      }
    }

    toast.success(editing ? 'Promoción actualizada' : 'Promoción creada')
    setSaving(false)
    setShowDialog(false)
    window.location.reload()
  }

  async function toggleActive(p: Promotion) {
    const { data, error } = await supabase
      .from('promotions')
      .update({ is_active: !p.is_active })
      .eq('id', p.id)
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    if (data) setPromotions(promotions.map(x => x.id === p.id ? data : x))
  }

  async function handleDelete(p: Promotion) {
    if (!confirm(`¿Borrar la promoción "${p.name}"?`)) return
    const { error } = await supabase.from('promotions').delete().eq('id', p.id)
    if (error) { toast.error(error.message); return }
    setPromotions(promotions.filter(x => x.id !== p.id))
    toast.success('Promoción eliminada')
  }

  // Tiered helpers
  function addTieredRule() {
    const last = tieredRules[tieredRules.length - 1]?.quantity ?? 0
    setTieredRules([...tieredRules, { quantity: last + 1, discount_pct: 0 }])
  }
  function updateTieredRule(i: number, field: keyof TieredDiscountRule, val: number) {
    setTieredRules(tieredRules.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }
  function removeTieredRule(i: number) {
    if (tieredRules.length <= 1) return
    setTieredRules(tieredRules.filter((_, idx) => idx !== i))
  }

  // NxY helpers
  function addNxRule() {
    const last = nxRules[nxRules.length - 1]?.buy ?? 1
    setNxRules([...nxRules, { buy: last + 1, pay: last }])
  }
  function updateNxRule(i: number, field: keyof NxForYRule, val: number) {
    setNxRules(nxRules.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }
  function removeNxRule(i: number) {
    if (nxRules.length <= 1) return
    setNxRules(nxRules.filter((_, idx) => idx !== i))
  }

  function toggleProduct(id: string) {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function renderRuleSummary(p: Promotion) {
    if (p.type === 'tiered_discount') {
      return (p.rules as TieredDiscountRule[]).map(r => (
        <span key={r.quantity} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
          {r.quantity}u → {r.discount_pct}% off
        </span>
      ))
    } else {
      return (p.rules as NxForYRule[]).map(r => (
        <span key={r.buy} className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
          {r.buy}x{r.pay}
        </span>
      ))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Promociones</h2>
          <p className="text-sm text-muted-foreground">
            {promotions.length} promociones · {promotions.filter(p => p.is_active).length} activas
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openNew} className="h-8 text-xs gap-1.5 bg-black text-white hover:bg-neutral-800">
            <Plus className="w-3.5 h-3.5" /> Nueva promoción
          </Button>
        )}
      </div>

      {promotions.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-16 text-center text-muted-foreground">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Todavía no hay promociones</p>
          <p className="text-xs mt-1">Creá descuentos por cantidad, 2x1, 3x2 y más</p>
          {isAdmin && (
            <Button size="sm" onClick={openNew} className="mt-4 text-xs bg-black text-white hover:bg-neutral-800 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Crear primera promoción
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {promotions.map((p) => (
            <div key={p.id} className={cn('border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow', !p.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <Badge variant="outline" className={cn('text-[10px] border-0', p.type === 'tiered_discount' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700')}>
                      {TYPE_LABELS[p.type]}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px] border-0', p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500')}>
                      {p.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  <div className="flex gap-1 flex-wrap mt-2">{renderRuleSummary(p)}</div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => toggleActive(p)} className="p-1 rounded hover:bg-neutral-100 text-muted-foreground transition-colors" title={p.is_active ? 'Desactivar' : 'Activar'}>
                      {p.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-neutral-100 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{editing ? 'Editar promoción' : 'Nueva promoción'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">

            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nombre *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: 2x1 en gaseosas" className="h-8 text-sm" />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Tipo de promoción</label>
              <div className="grid grid-cols-2 gap-2">
                {(['tiered_discount', 'nx_for_y'] as PromotionType[]).map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className={cn('p-3 rounded-lg border text-left transition-colors', type === t ? 'border-black bg-neutral-50' : 'border-border hover:border-neutral-300')}>
                    <p className="text-xs font-semibold">{TYPE_LABELS[t]}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{TYPE_DESCRIPTIONS[t]}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Reglas tiered */}
            {type === 'tiered_discount' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Reglas de descuento</label>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={addTieredRule}>
                    <Plus className="w-3 h-3" /> Agregar fila
                  </Button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cant. mínima</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Descuento %</th>
                        <th className="w-8 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tieredRules.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">
                            <Input type="number" min={1} value={r.quantity}
                              onChange={e => updateTieredRule(i, 'quantity', parseInt(e.target.value) || 1)}
                              className="h-7 w-20 text-xs" />
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <Input type="number" min={0} max={100} value={r.discount_pct}
                                onChange={e => updateTieredRule(i, 'discount_pct', parseFloat(e.target.value) || 0)}
                                className="h-7 w-20 text-xs" />
                              <span className="text-muted-foreground text-xs">%</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            {tieredRules.length > 1 && (
                              <button onClick={() => removeTieredRule(i)} className="p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground">Ej: 1u → 0%, 2u → 20%, 3u → 30%</p>
              </div>
            )}

            {/* Reglas NxY */}
            {type === 'nx_for_y' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Reglas NxM</label>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={addNxRule}>
                    <Plus className="w-3 h-3" /> Agregar fila
                  </Button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Lleva (N)</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Paga (M)</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Preview</th>
                        <th className="w-8 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {nxRules.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">
                            <Input type="number" min={2} value={r.buy}
                              onChange={e => updateNxRule(i, 'buy', parseInt(e.target.value) || 2)}
                              className="h-7 w-20 text-xs" />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input type="number" min={1} value={r.pay}
                              onChange={e => updateNxRule(i, 'pay', parseInt(e.target.value) || 1)}
                              className="h-7 w-20 text-xs" />
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="font-bold text-purple-700">{r.buy}x{r.pay}</span>
                            <span className="text-muted-foreground ml-1">({Math.round((1 - r.pay / r.buy) * 100)}% off)</span>
                          </td>
                          <td className="px-2 py-1.5">
                            {nxRules.length > 1 && (
                              <button onClick={() => removeNxRule(i)} className="p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Aplicar a ── */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Aplicar a</label>
              <div className="flex gap-2">
                {(['all', 'category', 'products'] as ApplyTo[]).map(opt => (
                  <button key={opt} onClick={() => setApplyTo(opt)}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-colors',
                      applyTo === opt ? 'border-black bg-neutral-50' : 'border-border hover:border-neutral-300 text-muted-foreground')}>
                    {opt === 'all' ? 'Todos' : opt === 'category' ? 'Categoría' : 'Productos'}
                  </button>
                ))}
              </div>

              {/* Por categoría */}
              {applyTo === 'category' && (
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full h-8 text-xs border border-border rounded-md px-2 bg-white"
                >
                  <option value="">Seleccioná una categoría...</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c} ({products.filter(p => p.category === c).length} productos)</option>
                  ))}
                </select>
              )}

              {/* Productos específicos */}
              {applyTo === 'products' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      placeholder="Buscar producto..."
                      className="h-8 text-xs pl-8"
                    />
                  </div>
                  {selectedProductIds.length > 0 && (
                    <p className="text-[10px] text-emerald-700 font-medium">{selectedProductIds.length} producto{selectedProductIds.length !== 1 ? 's' : ''} seleccionado{selectedProductIds.length !== 1 ? 's' : ''}</p>
                  )}
                  <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                    {filteredProducts.slice(0, 100).map(p => (
                      <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() => toggleProduct(p.id)}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.category}</p>
                        </div>
                      </label>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">Sin resultados</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-border">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button size="sm" className="text-xs bg-black text-white hover:bg-neutral-800" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear promoción'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

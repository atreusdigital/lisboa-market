'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Package, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import type { ProductFamily, Profile } from '@/types'

interface SimpleProduct { id: string; name: string; category: string; family_id: string | null }

interface Props {
  families: ProductFamily[]
  products: SimpleProduct[]
  profile: Profile
}

interface FamilyForm {
  name: string
  description: string
  color: string
}

const COLORS = ['#1C2B23', '#2563eb', '#dc2626', '#d97706', '#16a34a', '#7c3aed', '#db2777', '#0891b2']

export function FamiliesModule({ families: initial, products: initialProducts, profile }: Props) {
  const [families, setFamilies] = useState<ProductFamily[]>(initial)
  const [products, setProducts] = useState<SimpleProduct[]>(initialProducts)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<ProductFamily | null>(null)
  const [form, setForm] = useState<FamilyForm>({ name: '', description: '', color: '#1C2B23' })
  const [saving, setSaving] = useState(false)

  // Producto assignment
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState<Record<string, string>>({})

  const supabase = createClient()
  const isAdmin = profile.role !== 'empleado'

  function openNew() {
    setEditing(null)
    setForm({ name: '', description: '', color: '#1C2B23' })
    setShowDialog(true)
  }

  function openEdit(f: ProductFamily) {
    setEditing(f)
    setForm({ name: f.name, description: f.description ?? '', color: f.color })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    if (editing) {
      const { data, error } = await supabase
        .from('product_families')
        .update({ name: form.name.trim(), description: form.description || null, color: form.color })
        .eq('id', editing.id)
        .select()
        .single()
      if (error) { toast.error(error.message); setSaving(false); return }
      setFamilies(families.map(f => f.id === editing.id ? data : f))
      toast.success('Familia actualizada')
    } else {
      const { data, error } = await supabase
        .from('product_families')
        .insert({ name: form.name.trim(), description: form.description || null, color: form.color })
        .select()
        .single()
      if (error) { toast.error(error.message); setSaving(false); return }
      setFamilies([...families, data])
      toast.success('Familia creada')
    }
    setSaving(false)
    setShowDialog(false)
  }

  async function handleDelete(f: ProductFamily) {
    const count = products.filter(p => p.family_id === f.id).length
    if (!confirm(`¿Borrar la familia "${f.name}"?${count > 0 ? ` ${count} productos quedarán sin familia.` : ''}`)) return
    const { error } = await supabase.from('product_families').delete().eq('id', f.id)
    if (error) { toast.error(error.message); return }
    setFamilies(families.filter(x => x.id !== f.id))
    setProducts(products.map(p => p.family_id === f.id ? { ...p, family_id: null } : p))
    toast.success('Familia eliminada')
  }

  async function assignProduct(productId: string, familyId: string | null) {
    const { error } = await supabase
      .from('products')
      .update({ family_id: familyId })
      .eq('id', productId)
    if (error) { toast.error(error.message); return }
    setProducts(products.map(p => p.id === productId ? { ...p, family_id: familyId } : p))
  }

  function toggleExpand(familyId: string) {
    setExpandedFamily(prev => prev === familyId ? null : familyId)
  }

  function getFilteredProducts(familyId: string) {
    const q = (productSearch[familyId] ?? '').toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Familias de productos</h2>
          <p className="text-sm text-muted-foreground">{families.length} familias definidas</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openNew} className="h-8 text-xs gap-1.5 bg-black text-white hover:bg-neutral-800">
            <Plus className="w-3.5 h-3.5" /> Nueva familia
          </Button>
        )}
      </div>

      {families.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-16 text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Todavía no hay familias</p>
          <p className="text-xs mt-1">Agrupá tus productos en familias para organizarlos mejor</p>
          {isAdmin && (
            <Button size="sm" onClick={openNew} className="mt-4 text-xs bg-black text-white hover:bg-neutral-800 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Crear primera familia
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {families.map((f) => {
            const familyProducts = products.filter(p => p.family_id === f.id)
            const isExpanded = expandedFamily === f.id
            const filtered = getFilteredProducts(f.id)

            return (
              <div key={f.id} className="border border-border rounded-xl bg-white overflow-hidden">
                {/* Header de la familia */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm">{f.name}</span>
                      {f.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.description}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {familyProducts.length} producto{familyProducts.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    {isAdmin && (
                      <>
                        <button onClick={() => openEdit(f)} className="p-1.5 rounded hover:bg-neutral-100 text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(f)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleExpand(f.id)}
                      className="p-1.5 rounded hover:bg-neutral-100 text-muted-foreground transition-colors ml-1"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Panel de productos */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3 bg-neutral-50/50">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={productSearch[f.id] ?? ''}
                        onChange={e => setProductSearch(prev => ({ ...prev, [f.id]: e.target.value }))}
                        placeholder="Buscar producto para agregar..."
                        className="h-8 text-xs pl-8"
                      />
                    </div>

                    <div className="border border-border rounded-lg max-h-60 overflow-y-auto divide-y divide-border bg-white">
                      {filtered.slice(0, 150).map(p => {
                        const inThisFamily = p.family_id === f.id
                        const inOtherFamily = p.family_id && p.family_id !== f.id
                        const otherFamilyName = inOtherFamily
                          ? families.find(x => x.id === p.family_id)?.name
                          : null

                        return (
                          <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={inThisFamily}
                              onChange={() => assignProduct(p.id, inThisFamily ? null : f.id)}
                              className="rounded shrink-0"
                              disabled={!!inOtherFamily}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {p.category}
                                {otherFamilyName && (
                                  <span className="ml-1 text-amber-600">· ya en "{otherFamilyName}"</span>
                                )}
                              </p>
                            </div>
                            {inThisFamily && (
                              <span className="text-[10px] text-emerald-600 font-medium shrink-0">✓ En familia</span>
                            )}
                          </label>
                        )
                      })}
                      {filtered.length === 0 && (
                        <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sin resultados</p>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Un producto solo puede pertenecer a una familia a la vez.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{editing ? 'Editar familia' : 'Nueva familia'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nombre *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Vodka Absolut" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Descripción</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción opcional" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-black scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button size="sm" className="text-xs bg-black text-white hover:bg-neutral-800" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear familia'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'
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

export function FamiliesModule({ families: initial, products, profile }: Props) {
  const [families, setFamilies] = useState<ProductFamily[]>(initial)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<ProductFamily | null>(null)
  const [form, setForm] = useState<FamilyForm>({ name: '', description: '', color: '#1C2B23' })
  const [saving, setSaving] = useState(false)
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
      if (error) { toast.error('Error al guardar'); setSaving(false); return }
      setFamilies(families.map(f => f.id === editing.id ? data : f))
      toast.success('Familia actualizada')
    } else {
      const { data, error } = await supabase
        .from('product_families')
        .insert({ name: form.name.trim(), description: form.description || null, color: form.color })
        .select()
        .single()
      if (error) { toast.error('Error al guardar'); setSaving(false); return }
      setFamilies([...families, data])
      toast.success('Familia creada')
    }
    setSaving(false)
    setShowDialog(false)
  }

  async function handleDelete(f: ProductFamily) {
    const count = products.filter(p => p.family_id === f.id).length
    if (!confirm(`¿Borrar la familia "${f.name}"?${count > 0 ? ` ${count} productos quedarán sin familia.` : ''}`)) return
    await supabase.from('product_families').delete().eq('id', f.id)
    setFamilies(families.filter(x => x.id !== f.id))
    toast.success('Familia eliminada')
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
          {isAdmin && <Button size="sm" onClick={openNew} className="mt-4 text-xs bg-black text-white hover:bg-neutral-800 gap-1.5"><Plus className="w-3.5 h-3.5" />Crear primera familia</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {families.map((f) => {
            const count = products.filter(p => p.family_id === f.id).length
            return (
              <div key={f.id} className="border border-border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                    <span className="font-medium text-sm">{f.name}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(f)} className="p-1 rounded hover:bg-neutral-100 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(f)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {f.description && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{f.description}</p>}
                <div className="mt-3">
                  <Badge variant="outline" className="text-[10px]">{count} producto{count !== 1 ? 's' : ''}</Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{editing ? 'Editar familia' : 'Nueva familia'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nombre *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Chocolates importados" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Descripción</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción opcional" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-black scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
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

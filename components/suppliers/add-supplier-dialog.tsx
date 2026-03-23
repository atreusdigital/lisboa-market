'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const LISBOA_GREEN = '#1C2B23'

interface Props {
  open: boolean
  onClose: () => void
}

export function AddSupplierDialog({ open, onClose }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '' })

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { toast.error('El nombre es requerido'); return }
    setLoading(true)
    const { error } = await supabase.from('suppliers').insert({
      name: form.name,
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
    })
    if (error) { toast.error('Error al guardar proveedor'); setLoading(false); return }
    toast.success('Proveedor agregado')
    onClose()
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Nuevo proveedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ej: Coca Cola" className="h-9 text-sm" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contacto</Label>
            <Input value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} placeholder="Nombre del vendedor" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="11 1234-5678" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="mail@proveedor.com" className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 h-9 text-sm text-white" style={{ backgroundColor: LISBOA_GREEN }} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

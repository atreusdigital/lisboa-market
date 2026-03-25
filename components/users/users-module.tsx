'use client'

import { useState } from 'react'
import type { Profile, Branch, ActivityLog, UserRole } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Eye, EyeOff, ShieldCheck, ShieldAlert, Shield, Save } from 'lucide-react'
import type { RolePermissions, PermissionKey } from '@/lib/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const roleColors: Record<string, string> = {
  director: 'bg-neutral-900 text-white',
  admin: 'bg-blue-100 text-blue-800',
  empleado: 'bg-neutral-100 text-neutral-600',
}
const roleLabels: Record<string, string> = {
  director: 'Dueño',
  admin: 'Encargado',
  empleado: 'Empleado',
}
const actionLabels: Record<string, string> = {
  sale: 'Registró una venta',
  create_order: 'Creó un pedido',
  scan_delivery: 'Escaneó un pedido con IA',
  login: 'Inició sesión',
}

interface Props {
  users: Profile[]
  branches: Branch[]
  activityLog: ActivityLog[]
  currentProfile: Profile
  rolePermissions: RolePermissions
}

interface NewUserForm {
  full_name: string
  username: string
  password: string
  role: UserRole
  branch_id: string | null
}

export function UsersModule({ users: initial, branches, activityLog, currentProfile, rolePermissions: initialPerms }: Props) {
  const [users, setUsers] = useState<Profile[]>(initial)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewUserForm>({ full_name: '', username: '', password: '', role: 'empleado', branch_id: null })
  const [editRole, setEditRole] = useState<UserRole>('empleado')
  const [editBranch, setEditBranch] = useState<string | null>(null)
  const [perms, setPerms] = useState<RolePermissions>(initialPerms)
  const [savingMatrix, setSavingMatrix] = useState(false)
  const supabase = createClient()

  function openNew() {
    setForm({ full_name: '', username: '', password: '', role: 'empleado', branch_id: null })
    setShowPassword(false)
    setShowNewDialog(true)
  }

  function openEdit(u: Profile) {
    setEditingUser(u)
    setEditRole(u.role as UserRole)
    setEditBranch(u.branch_id)
    setShowEditDialog(true)
  }

  async function handleCreate() {
    if (!form.full_name.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error('Nombre, usuario y contraseña son requeridos')
      return
    }
    if (form.password.length < 4) { toast.error('La contraseña debe tener al menos 4 caracteres'); return }
    setSaving(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al crear usuario'); setSaving(false); return }
    toast.success('Usuario creado correctamente')
    setSaving(false)
    setShowNewDialog(false)
    window.location.reload()
  }

  async function handleSaveEdit() {
    if (!editingUser) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ role: editRole, branch_id: editBranch || null })
      .eq('id', editingUser.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Usuario actualizado')
    setSaving(false)
    setShowEditDialog(false)
    window.location.reload()
  }

  async function handleSaveMatrix() {
    setSavingMatrix(true)
    const res = await fetch('/api/admin/role-permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(perms),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSavingMatrix(false); return }
    toast.success('Permisos guardados')
    setSavingMatrix(false)
  }

  async function handleDelete(u: Profile) {
    if (!confirm(`¿Borrar al usuario "${u.full_name}"? Esta acción no se puede deshacer.`)) return
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al eliminar'); return }
    setUsers(users.filter(x => x.id !== u.id))
    toast.success('Usuario eliminado')
  }

  const isAdmin = ['director', 'admin'].includes(currentProfile.role)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usuarios</h2>
          <p className="text-sm text-muted-foreground">{users.length} usuarios registrados</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openNew} className="h-8 text-xs gap-1.5 bg-black text-white hover:bg-neutral-800">
            <Plus className="w-3.5 h-3.5" /> Nuevo usuario
          </Button>
        )}
      </div>

      <Tabs defaultValue="users">
        <TabsList className="h-8">
          <TabsTrigger value="users" className="text-xs h-7">Usuarios</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs h-7">Historial</TabsTrigger>
          <TabsTrigger value="permisos" className="text-xs h-7">Permisos</TabsTrigger>
        </TabsList>

        {/* TABLA DE USUARIOS */}
        <TabsContent value="users" className="mt-4">
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-neutral-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Sucursal</th>
                  {isAdmin && <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Editar</th>}
                  {isAdmin && <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Borrar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1C2B23] flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-semibold text-white">{u.full_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-sm font-medium">{u.full_name}</span>
                        {u.id === currentProfile.id && (
                          <span className="text-[10px] text-muted-foreground">(vos)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                      {(u as any).username ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('text-[10px] border-0', roleColors[u.role])}>
                        {roleLabels[u.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {u.role === 'director' ? 'Todas' : (u.branch?.name ?? '—')}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-center">
                        {u.id !== currentProfile.id && (
                          <button onClick={() => openEdit(u)} className="text-[10px] px-2.5 py-1 rounded bg-neutral-800 text-white hover:bg-black transition-colors font-medium">
                            Editar
                          </button>
                        )}
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-4 py-3 text-center">
                        {u.id !== currentProfile.id && (
                          <button onClick={() => handleDelete(u)} className="text-[10px] px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors font-medium">
                            Borrar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* HISTORIAL */}
        <TabsContent value="activity" className="mt-4">
          <Card className="border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-neutral-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acción</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activityLog.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">No hay actividad registrada</td></tr>
                  ) : (
                    activityLog.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium">{(log.user as Profile)?.full_name ?? 'Desconocido'}</p>
                          <Badge className={cn('text-[10px] border-0 mt-0.5', roleColors[(log.user as Profile)?.role ?? 'empleado'])}>
                            {roleLabels[(log.user as Profile)?.role ?? 'empleado']}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {actionLabels[log.action] ?? log.action}
                          {log.metadata && typeof log.metadata === 'object' && 'total' in log.metadata && (
                            <span className="ml-1 text-xs">— {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(log.metadata.total as number)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          {new Date(log.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* PERMISOS */}
        <TabsContent value="permisos" className="mt-4">
          <div className="space-y-2 mb-4">
            <p className="text-xs text-muted-foreground">
              Configurá qué acciones puede realizar cada nivel de usuario. El Dueño siempre tiene acceso completo.
            </p>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-neutral-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Permiso</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-neutral-700" />
                      <span className="text-neutral-700">Dueño</span>
                    </div>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-0.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-600">Encargado</span>
                    </div>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-0.5">
                      <Shield className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-neutral-500">Empleado</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(() => {
                  const categories = Array.from(new Set(PERMISSIONS.map(p => p.category)))
                  return categories.map(cat => (
                    <>
                      <tr key={`cat-${cat}`} className="bg-neutral-50/80">
                        <td colSpan={4} className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</td>
                      </tr>
                      {PERMISSIONS.filter(p => p.category === cat).map(p => (
                        <tr key={p.key} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-foreground">{p.label}</td>
                          {/* Director: always enabled, not editable */}
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <div className="w-4 h-4 rounded border-2 border-neutral-300 bg-neutral-800 flex items-center justify-center cursor-not-allowed">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                          </td>
                          {/* Encargado */}
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <button
                                onClick={() => currentProfile.role === 'director' && setPerms(prev => ({
                                  ...prev,
                                  admin: { ...prev.admin, [p.key]: !prev.admin[p.key as PermissionKey] }
                                }))}
                                className={cn(
                                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                                  perms.admin[p.key as PermissionKey]
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'bg-white border-neutral-300',
                                  currentProfile.role === 'director' ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
                                )}
                              >
                                {perms.admin[p.key as PermissionKey] && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                          {/* Empleado */}
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <button
                                onClick={() => currentProfile.role === 'director' && setPerms(prev => ({
                                  ...prev,
                                  empleado: { ...prev.empleado, [p.key]: !prev.empleado[p.key as PermissionKey] }
                                }))}
                                className={cn(
                                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                                  perms.empleado[p.key as PermissionKey]
                                    ? 'bg-neutral-700 border-neutral-700'
                                    : 'bg-white border-neutral-300',
                                  currentProfile.role === 'director' ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
                                )}
                              >
                                {perms.empleado[p.key as PermissionKey] && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  ))
                })()}
              </tbody>
            </table>
          </div>

          {currentProfile.role === 'director' && (
            <div className="flex justify-end mt-4">
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-black text-white hover:bg-neutral-800"
                onClick={handleSaveMatrix}
                disabled={savingMatrix}
              >
                <Save className="w-3.5 h-3.5" />
                {savingMatrix ? 'Guardando...' : 'Guardar permisos'}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Nuevo usuario */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Nuevo usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre completo *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ej: Martín García" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Usuario (para iniciar sesión) *</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))} placeholder="Ej: martin" className="h-8 text-sm font-mono" />
              {form.username && <p className="text-[10px] text-muted-foreground">Iniciará sesión como: <span className="font-mono font-medium">{form.username}</span></p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contraseña / PIN *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 4 caracteres"
                  className="h-8 text-sm pr-9"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rol</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currentProfile.role === 'director' && <SelectItem value="director">Dueño</SelectItem>}
                  <SelectItem value="admin">Encargado</SelectItem>
                  <SelectItem value="empleado">Empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sucursal</Label>
              <Select value={form.branch_id ?? ''} onValueChange={v => setForm(f => ({ ...f, branch_id: v || null }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin sucursal asignada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin sucursal</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
              <Button size="sm" className="text-xs bg-black text-white hover:bg-neutral-800" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creando...' : 'Crear usuario'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar usuario */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Editar — {editingUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rol</Label>
              <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currentProfile.role === 'director' && <SelectItem value="director">Dueño</SelectItem>}
                  <SelectItem value="admin">Encargado</SelectItem>
                  <SelectItem value="empleado">Empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sucursal</Label>
              <Select value={editBranch ?? ''} onValueChange={v => setEditBranch(v || null)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin sucursal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin sucursal</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button size="sm" className="text-xs bg-black text-white hover:bg-neutral-800" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

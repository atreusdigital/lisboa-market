'use client'

import { useState } from 'react'
import type { Profile, Branch, ActivityLog } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const LISBOA_GREEN = '#1C2B23'

const roleColors: Record<string, string> = {
  director: 'bg-neutral-900 text-white',
  admin: 'bg-neutral-200 text-neutral-800',
  empleado: 'bg-neutral-100 text-neutral-600',
}

const roleLabels: Record<string, string> = {
  director: 'Director',
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
}

export function UsersModule({ users, branches, activityLog, currentProfile }: Props) {
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editBranch, setEditBranch] = useState('')
  const supabase = createClient()

  function startEdit(user: Profile) {
    setEditingUser(user.id)
    setEditRole(user.role)
    setEditBranch(user.branch_id ?? '')
  }

  async function saveEdit(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: editRole, branch_id: editBranch || null })
      .eq('id', userId)

    if (error) { toast.error('Error al actualizar usuario'); return }
    toast.success('Usuario actualizado')
    setEditingUser(null)
    window.location.reload()
  }

  const directors = users.filter((u) => u.role === 'director')
  const admins = users.filter((u) => u.role === 'admin')
  const empleados = users.filter((u) => u.role === 'empleado')

  const grouped = [
    { label: 'Directores', users: directors },
    { label: 'Encargados', users: admins },
    { label: 'Empleados', users: empleados },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Usuarios</h2>
        <p className="text-sm text-muted-foreground">{users.length} usuarios registrados</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="h-8">
          <TabsTrigger value="users" className="text-xs h-7">Usuarios</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs h-7">Historial de actividad</TabsTrigger>
        </TabsList>

        {/* USUARIOS */}
        <TabsContent value="users" className="mt-4 space-y-5">
          {grouped.map(({ label, users: groupUsers }) => (
            <div key={label}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {groupUsers.map((user) => (
                  <Card key={user.id} className="p-4 border-border bg-white">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm"
                        style={{ backgroundColor: LISBOA_GREEN }}
                      >
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.branch?.name ?? 'Sin sucursal'}</p>
                        <Badge className={cn('text-[10px] border-0 mt-1', roleColors[user.role])}>
                          {roleLabels[user.role]}
                        </Badge>
                      </div>
                      {user.id !== currentProfile.id && (
                        <button
                          onClick={() => editingUser === user.id ? setEditingUser(null) : startEdit(user)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          {editingUser === user.id ? 'Cancelar' : 'Editar'}
                        </button>
                      )}
                    </div>

                    {editingUser === user.id && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Rol</Label>
                          <Select value={editRole} onValueChange={(v) => v && setEditRole(v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="director">Director</SelectItem>
                              <SelectItem value="admin">Encargado</SelectItem>
                              <SelectItem value="empleado">Empleado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sucursal</Label>
                          <Select value={editBranch} onValueChange={(v) => setEditBranch(v ?? '')}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Sin sucursal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Sin sucursal</SelectItem>
                              {branches.map((b) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs text-white"
                          style={{ backgroundColor: LISBOA_GREEN }}
                          onClick={() => saveEdit(user.id)}
                        >
                          Guardar cambios
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
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
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No hay actividad registrada
                      </td>
                    </tr>
                  ) : (
                    activityLog.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-xs font-medium">{(log.user as Profile)?.full_name ?? 'Desconocido'}</p>
                            <Badge className={cn('text-[10px] border-0 mt-0.5', roleColors[(log.user as Profile)?.role ?? 'empleado'])}>
                              {roleLabels[(log.user as Profile)?.role ?? 'empleado']}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {actionLabels[log.action] ?? log.action}
                          {log.metadata && typeof log.metadata === 'object' && 'total' in log.metadata && (
                            <span className="ml-1 text-xs">
                              — {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(log.metadata.total as number)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          {new Date(log.created_at).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

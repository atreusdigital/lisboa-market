'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Clock, DollarSign, TrendingUp, Wallet, AlertTriangle, CheckCircle2,
  Plus, Trash2, Timer, User, ChevronDown, ChevronUp
} from 'lucide-react'
import type { Profile, Branch, Expense, Shift, CashClosing } from '@/types'

const LISBOA_GREEN = '#1C2B23'

const EXPENSE_CATEGORIES = [
  { value: 'electricidad', label: '⚡ Electricidad' },
  { value: 'limpieza', label: '🧹 Limpieza' },
  { value: 'delivery', label: '🚚 Delivery' },
  { value: 'sueldo', label: '👤 Sueldo' },
  { value: 'mantenimiento', label: '🔧 Mantenimiento' },
  { value: 'marketing', label: '📢 Marketing' },
  { value: 'otros', label: '📦 Otros' },
]

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

interface Props {
  profile: Profile
  branches: Branch[]
  openShift: (Shift & { user?: { full_name: string } }) | null
  efectivoHoy: number
  mpHoy: number
  totalHoy: number
  salesCount: number
  todayExpenses: (Expense & { user?: { full_name: string } })[]
  recentClosings: (CashClosing & { user?: { full_name: string } })[]
  recentShifts: (Shift & { user?: { full_name: string } })[]
}

export function CajaModule({
  profile, branches, openShift, efectivoHoy, mpHoy, totalHoy, salesCount,
  todayExpenses, recentClosings, recentShifts
}: Props) {
  const supabase = createClient()
  const isDirector = profile.role === 'director'
  const branchId = profile.branch_id ?? branches[0]?.id ?? ''

  // Turno state
  const [shift, setShift] = useState<(Shift & { user?: { full_name: string } }) | null>(openShift)
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [shiftNotes, setShiftNotes] = useState('')
  const [shiftLoading, setShiftLoading] = useState(false)

  // Cierre de caja state
  const [actualCash, setActualCash] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [closingLoading, setClosingLoading] = useState(false)
  const [showRecentClosings, setShowRecentClosings] = useState(false)

  // Gastos state
  const [expenses, setExpenses] = useState(todayExpenses)
  const [expenseForm, setExpenseForm] = useState({
    category: 'otros',
    description: '',
    amount: '',
  })
  const [expenseLoading, setExpenseLoading] = useState(false)

  const totalExpensesHoy = expenses.reduce((s, e) => s + e.amount, 0)
  const actualCashNum = parseFloat(actualCash) || 0
  const diff = actualCashNum - efectivoHoy

  // ─── TURNO ───────────────────────────────────────────────
  async function openShiftFn() {
    if (!openingCash) { toast.error('Ingresá el efectivo inicial'); return }
    setShiftLoading(true)
    const { data, error } = await supabase.from('shifts').insert({
      branch_id: branchId,
      user_id: profile.id,
      opening_cash: parseFloat(openingCash),
      status: 'open',
    }).select('*, user:profiles(full_name)').single()
    if (error) { toast.error('Error al abrir turno'); setShiftLoading(false); return }
    setShift(data)
    setOpeningCash('')
    toast.success('Turno abierto')
    setShiftLoading(false)
  }

  async function closeShiftFn() {
    if (!shift) return
    if (!closingCash) { toast.error('Ingresá el efectivo final'); return }
    setShiftLoading(true)
    const { error } = await supabase.from('shifts').update({
      closed_at: new Date().toISOString(),
      closing_cash: parseFloat(closingCash),
      total_sales: efectivoHoy + mpHoy,
      notes: shiftNotes || null,
      status: 'closed',
    }).eq('id', shift.id)
    if (error) { toast.error('Error al cerrar turno'); setShiftLoading(false); return }
    setShift(null)
    setClosingCash('')
    setShiftNotes('')
    toast.success('Turno cerrado correctamente')
    setShiftLoading(false)
  }

  // ─── CIERRE DE CAJA ──────────────────────────────────────
  async function saveCashClosing() {
    if (!actualCash) { toast.error('Ingresá el efectivo contado'); return }
    setClosingLoading(true)
    const { error } = await supabase.from('cash_closings').insert({
      branch_id: branchId,
      user_id: profile.id,
      shift_id: shift?.id ?? null,
      date: new Date().toISOString().split('T')[0],
      expected_cash: efectivoHoy,
      actual_cash: actualCashNum,
      difference: diff,
      notes: closingNotes || null,
    })
    if (error) { toast.error('Error al guardar cierre'); setClosingLoading(false); return }
    toast.success('Cierre de caja guardado')
    setActualCash('')
    setClosingNotes('')
    setClosingLoading(false)
  }

  // ─── GASTOS ──────────────────────────────────────────────
  async function addExpense() {
    if (!expenseForm.description || !expenseForm.amount) {
      toast.error('Completá descripción y monto')
      return
    }
    setExpenseLoading(true)
    const { data, error } = await supabase.from('expenses').insert({
      branch_id: branchId,
      user_id: profile.id,
      category: expenseForm.category,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      date: new Date().toISOString().split('T')[0],
    }).select('*').single()
    if (error) { toast.error('Error al registrar gasto'); setExpenseLoading(false); return }
    setExpenses(prev => [{ ...data, user: { full_name: profile.full_name } }, ...prev])
    setExpenseForm({ category: 'otros', description: '', amount: '' })
    toast.success('Gasto registrado')
    setExpenseLoading(false)
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar'); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
    toast.success('Gasto eliminado')
  }

  // ─── Duración del turno ───────────────────────────────────
  function shiftDuration(openedAt: string) {
    const diff = Date.now() - new Date(openedAt).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Resumen del día */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border-border">
          <p className="text-[11px] text-muted-foreground mb-1">Ventas hoy</p>
          <p className="text-xl font-bold">{salesCount}</p>
          <p className="text-xs text-muted-foreground">{fmt(totalHoy)}</p>
        </Card>
        <Card className="p-3 border-border">
          <p className="text-[11px] text-muted-foreground mb-1">Efectivo</p>
          <p className="text-xl font-bold">{fmt(efectivoHoy)}</p>
          <p className="text-xs text-muted-foreground">en caja</p>
        </Card>
        <Card className="p-3 border-border">
          <p className="text-[11px] text-muted-foreground mb-1">MercadoPago</p>
          <p className="text-xl font-bold">{fmt(mpHoy)}</p>
          <p className="text-xs text-muted-foreground">digital</p>
        </Card>
        <Card className="p-3 border-border">
          <p className="text-[11px] text-muted-foreground mb-1">Gastos</p>
          <p className="text-xl font-bold text-red-600">{fmt(totalExpensesHoy)}</p>
          <p className="text-xs text-muted-foreground">{expenses.length} registros</p>
        </Card>
      </div>

      <Tabs defaultValue="turno">
        <TabsList className="h-9">
          <TabsTrigger value="turno" className="text-xs gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Turno
          </TabsTrigger>
          <TabsTrigger value="cierre" className="text-xs gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Cierre de caja
          </TabsTrigger>
          <TabsTrigger value="gastos" className="text-xs gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Gastos
          </TabsTrigger>
        </TabsList>

        {/* ── TURNO ── */}
        <TabsContent value="turno" className="mt-4 space-y-4">
          {shift ? (
            <Card className="border-border overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: LISBOA_GREEN }}>
                <div className="flex items-center gap-2 text-white">
                  <Timer className="w-4 h-4" />
                  <span className="text-sm font-semibold">Turno abierto</span>
                </div>
                <Badge className="bg-green-500 text-white text-xs">En curso</Badge>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Empleado</p>
                    <p className="text-sm font-medium">{(shift as any).user?.full_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Duración</p>
                    <p className="text-sm font-medium">{shiftDuration(shift.opened_at)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Caja inicial</p>
                    <p className="text-sm font-medium">{fmt(shift.opening_cash)}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-3">
                  <Label className="text-xs">Efectivo al cerrar turno</Label>
                  <Input
                    type="number"
                    value={closingCash}
                    onChange={e => setClosingCash(e.target.value)}
                    placeholder="0"
                    className="h-9"
                  />
                  <Textarea
                    value={shiftNotes}
                    onChange={e => setShiftNotes(e.target.value)}
                    placeholder="Notas del turno (opcional)..."
                    className="text-sm resize-none h-20"
                  />
                  <Button
                    onClick={closeShiftFn}
                    disabled={shiftLoading}
                    variant="outline"
                    className="w-full text-sm"
                  >
                    Cerrar turno
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-border p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Abrir turno</h3>
                <p className="text-xs text-muted-foreground">Registrá el efectivo inicial en caja al empezar el turno</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Efectivo inicial en caja</Label>
                <Input
                  type="number"
                  value={openingCash}
                  onChange={e => setOpeningCash(e.target.value)}
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <Button
                onClick={openShiftFn}
                disabled={shiftLoading}
                className="w-full text-white text-sm h-10"
                style={{ backgroundColor: LISBOA_GREEN }}
              >
                <Clock className="w-4 h-4 mr-2" />
                Abrir turno
              </Button>
            </Card>
          )}

          {/* Turnos recientes */}
          {recentShifts.length > 0 && (
            <Card className="border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-neutral-50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Últimos turnos</p>
              </div>
              <div className="divide-y divide-border">
                {recentShifts.map(s => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{(s as any).user?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.opened_at).toLocaleDateString('es-AR')} · {new Date(s.opened_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          {s.closed_at ? ` → ${new Date(s.closed_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{fmt(s.total_sales)}</p>
                      <p className="text-xs text-muted-foreground">ventas</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── CIERRE DE CAJA ── */}
        <TabsContent value="cierre" className="mt-4 space-y-4">
          <Card className="border-border p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Cierre de caja</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Contá el efectivo en la caja y compará con lo que debería haber</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-neutral-50 border border-border">
              <div>
                <p className="text-[11px] text-muted-foreground">Efectivo esperado</p>
                <p className="text-lg font-bold">{fmt(efectivoHoy)}</p>
                <p className="text-[11px] text-muted-foreground">según ventas en efectivo</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Diferencia</p>
                <p className={cn('text-lg font-bold', diff === 0 ? 'text-neutral-900' : diff > 0 ? 'text-green-600' : 'text-red-600')}>
                  {diff >= 0 ? '+' : ''}{fmt(diff)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {diff === 0 ? 'Cuadra exacto ✓' : diff > 0 ? 'Sobra plata' : 'Falta plata ⚠️'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Efectivo contado en caja</Label>
              <Input
                type="number"
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                placeholder="Ingresá el total contado..."
                className="h-9 text-lg font-semibold"
              />
            </div>

            {actualCash && diff !== 0 && (
              <div className={cn('flex items-center gap-2 p-3 rounded-lg text-sm', diff < 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100')}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {diff < 0
                    ? `Faltan ${fmt(Math.abs(diff))} en caja. Revisá si hubo algún error o gasto no registrado.`
                    : `Sobran ${fmt(diff)} en caja. Puede ser cambio sin registrar.`}
                </span>
              </div>
            )}

            {actualCash && diff === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-100">
                <CheckCircle2 className="w-4 h-4" />
                <span>La caja cuadra perfectamente.</span>
              </div>
            )}

            <Textarea
              value={closingNotes}
              onChange={e => setClosingNotes(e.target.value)}
              placeholder="Notas del cierre (opcional)..."
              className="text-sm resize-none h-20"
            />

            <Button
              onClick={saveCashClosing}
              disabled={closingLoading || !actualCash}
              className="w-full text-white h-10"
              style={{ backgroundColor: LISBOA_GREEN }}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Guardar cierre de caja
            </Button>
          </Card>

          {/* Historial de cierres */}
          {recentClosings.length > 0 && (
            <Card className="border-border overflow-hidden">
              <button
                onClick={() => setShowRecentClosings(!showRecentClosings)}
                className="w-full px-4 py-3 border-b border-border bg-neutral-50 flex items-center justify-between"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cierres recientes</p>
                {showRecentClosings ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {showRecentClosings && (
                <div className="divide-y divide-border">
                  {recentClosings.map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{new Date(c.created_at).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        <p className="text-xs text-muted-foreground">{(c as any).user?.full_name}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-semibold', c.difference === 0 ? 'text-green-600' : c.difference < 0 ? 'text-red-600' : 'text-blue-600')}>
                          {c.difference >= 0 ? '+' : ''}{fmt(c.difference)}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmt(c.actual_cash)} contado</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ── GASTOS ── */}
        <TabsContent value="gastos" className="mt-4 space-y-4">
          <Card className="border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold">Registrar gasto</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría</Label>
                <Select value={expenseForm.category} onValueChange={v => setExpenseForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Monto</Label>
                <Input
                  type="number"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="$0"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Input
                value={expenseForm.description}
                onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Ej: Factura de luz, limpieza semanal..."
                className="h-9 text-sm"
              />
            </div>
            <Button
              onClick={addExpense}
              disabled={expenseLoading}
              className="w-full text-white h-9 text-sm"
              style={{ backgroundColor: LISBOA_GREEN }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Registrar gasto
            </Button>
          </Card>

          <Card className="border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-neutral-50 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gastos de hoy</p>
              <span className="text-sm font-bold text-red-600">{fmt(totalExpensesHoy)}</span>
            </div>
            {expenses.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Sin gastos registrados hoy</div>
            ) : (
              <div className="divide-y divide-border">
                {expenses.map(e => (
                  <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label} · {(e as any).user?.full_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-red-600">{fmt(e.amount)}</span>
                      {(profile.role === 'director' || profile.role === 'admin') && (
                        <button
                          onClick={() => deleteExpense(e.id)}
                          className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

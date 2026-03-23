'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, AlertTriangle, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

const LISBOA_GREEN = '#1C2B23'

interface StockItem {
  quantity: number
  min_quantity: number
  product?: { id?: string; name?: string; category?: string; cost_price?: number; is_star?: boolean }
  branch?: { name?: string }
}

interface Props {
  context: string
  stockItems: StockItem[]
  salesVelocity: Record<string, number>
}

export function ReorderClient({ context, stockItems, salesVelocity }: Props) {
  const [plan, setPlan] = useState('')
  const [loading, setLoading] = useState(false)

  const urgent = stockItems.filter((s) => s.quantity === 0 || (s.product?.is_star && s.quantity <= s.min_quantity))
  const needsReorder = stockItems.filter((s) => s.quantity <= s.min_quantity && s.quantity > 0)

  async function generatePlan() {
    setLoading(true)
    const res = await fetch('/api/ai/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    })
    const { plan } = await res.json()
    setPlan(plan)
    setLoading(false)
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plan de reposición</h2>
          <p className="text-sm text-muted-foreground">Qué pedir, cuánto y a quién — generado por IA</p>
        </div>
        <Button
          onClick={generatePlan}
          disabled={loading}
          className="h-8 text-xs gap-1.5 text-white"
          style={{ backgroundColor: LISBOA_GREEN }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Generando plan...' : 'Generar plan IA'}
        </Button>
      </div>

      {/* Alertas rápidas */}
      {urgent.length > 0 && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">
              {urgent.length} producto{urgent.length > 1 ? 's' : ''} urgente{urgent.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {urgent.map((s) => `${s.product?.name}${s.product?.is_star ? ' ⭐' : ''}`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lista de productos a reponer */}
        <Card className="border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-neutral-50 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Productos a reponer</p>
            <Badge variant="outline" className="text-xs">{needsReorder.length + urgent.filter(s => s.quantity === 0).length}</Badge>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {urgent.length === 0 && needsReorder.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Package className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                <p className="text-sm text-muted-foreground">Todo el stock está bien 🎉</p>
              </div>
            ) : (
              [...urgent, ...needsReorder.filter((s) => !urgent.includes(s))].map((s, i) => {
                const isUrgent = urgent.includes(s)
                const velocity = salesVelocity[s.product?.name ?? ''] ?? 0
                return (
                  <div key={i} className={cn('px-4 py-3', isUrgent && 'bg-red-50/50')}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {s.product?.is_star && '⭐ '}
                          {s.product?.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.branch?.name} · {velocity > 0 ? `${velocity} uds/semana` : 'sin ventas recientes'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-sm font-semibold tabular-nums', isUrgent ? 'text-red-600' : 'text-amber-600')}>
                          {s.quantity}/{s.min_quantity}
                        </p>
                        <p className="text-[10px] text-muted-foreground">stock/mín</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Plan generado por IA */}
        <Card className="border-border">
          <div className="px-4 py-3 border-b border-border bg-neutral-50 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan generado por IA</p>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {!plan && !loading && (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-neutral-300" />
                <p className="text-sm text-muted-foreground">Hacé clic en "Generar plan IA" para obtener recomendaciones de compra agrupadas por proveedor</p>
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analizando stock y ventas...</span>
              </div>
            )}
            {plan && (
              <div className="text-sm leading-relaxed space-y-1.5">
                {plan.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className={
                    line.startsWith('**') ? 'font-semibold mt-3 first:mt-0' :
                    line.startsWith('-') || line.startsWith('•') ? 'pl-3 text-muted-foreground' :
                    'text-muted-foreground'
                  }>
                    {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

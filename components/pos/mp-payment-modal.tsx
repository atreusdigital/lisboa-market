'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const LISBOA_GREEN = '#1C2B23'

type PaymentStatus = 'loading' | 'waiting' | 'approved' | 'rejected' | 'error'

interface Props {
  externalReference: string
  items: { title: string; quantity: number; unit_price: number }[]
  total: number
  onSuccess: (paymentId: string) => void
  onCancel: () => void
}

export function MPPaymentModal({ externalReference, items, total, onSuccess, onCancel }: Props) {
  const [status, setStatus] = useState<PaymentStatus>('loading')
  const [initPoint, setInitPoint] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

  useEffect(() => {
    createPreference()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function createPreference() {
    setStatus('loading')
    try {
      const res = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, external_reference: externalReference }),
      })
      const data = await res.json()
      if (!res.ok || !data.init_point) throw new Error(data.error ?? 'Error al crear preferencia')

      setInitPoint(data.init_point)
      setStatus('waiting')
      startPolling()
      startTimer()
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  function startPolling() {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mercadopago/check-payment?external_reference=${externalReference}`)
        const data = await res.json()
        if (data.status === 'approved') {
          setPaymentId(data.payment_id)
          setStatus('approved')
          if (intervalRef.current) clearInterval(intervalRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
        } else if (data.status === 'rejected') {
          setStatus('rejected')
          if (intervalRef.current) clearInterval(intervalRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
        }
      } catch {}
    }, 3000)
  }

  function startTimer() {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= 29 * 60) {
          // 29 min — casi vencido
          if (intervalRef.current) clearInterval(intervalRef.current)
          setStatus('error')
          return prev
        }
        return prev + 1
      })
    }, 1000)
  }

  function copyLink() {
    if (initPoint) {
      navigator.clipboard.writeText(initPoint)
      toast.success('Link copiado')
    }
  }

  const qrUrl = initPoint
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(initPoint)}`
    : null

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between" style={{ backgroundColor: LISBOA_GREEN }}>
          <div>
            <p className="text-white font-semibold text-sm">Pago con MercadoPago</p>
            <p className="text-white/60 text-xs">{formatCurrency(total)}</p>
          </div>
          {status === 'waiting' && (
            <p className="text-white/50 text-xs tabular-nums">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
          )}
        </div>

        <div className="p-6">
          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
              <p className="text-sm text-muted-foreground">Generando QR de pago...</p>
            </div>
          )}

          {/* Waiting for payment */}
          {status === 'waiting' && qrUrl && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-center text-muted-foreground">
                Escaneá el QR con la app de Mercado Pago o compartí el link al cliente
              </p>

              {/* QR Code */}
              <div className="border-2 border-neutral-100 rounded-xl p-2">
                <img
                  src={qrUrl}
                  alt="QR de pago"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>

              {/* Polling indicator */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Esperando pago...
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={copyLink}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar link
                </Button>
                <a
                  href={initPoint ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir link
                  </Button>
                </a>
              </div>

              <button
                onClick={onCancel}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar y volver al carrito
              </button>
            </div>
          )}

          {/* Approved */}
          {status === 'approved' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              <div className="text-center">
                <p className="font-semibold text-lg">¡Pago aprobado!</p>
                <p className="text-sm text-muted-foreground mt-1">{formatCurrency(total)}</p>
                {paymentId && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {paymentId}</p>
                )}
              </div>
              <Button
                className="w-full text-white"
                style={{ backgroundColor: LISBOA_GREEN }}
                onClick={() => onSuccess(paymentId ?? '')}
              >
                Confirmar venta
              </Button>
            </div>
          )}

          {/* Rejected */}
          {status === 'rejected' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <XCircle className="w-16 h-16 text-red-500" />
              <div className="text-center">
                <p className="font-semibold text-lg">Pago rechazado</p>
                <p className="text-sm text-muted-foreground mt-1">El cliente puede intentar nuevamente</p>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={createPreference}>
                  <RefreshCw className="w-4 h-4" />
                  Reintentar
                </Button>
                <Button variant="outline" className="flex-1" onClick={onCancel}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <XCircle className="w-16 h-16 text-neutral-300" />
              <div className="text-center">
                <p className="font-semibold">Error al generar el pago</p>
                <p className="text-sm text-muted-foreground mt-1">Verificá la conexión y reintentá</p>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={createPreference}>
                  <RefreshCw className="w-4 h-4" />
                  Reintentar
                </Button>
                <Button variant="outline" className="flex-1" onClick={onCancel}>
                  Volver
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

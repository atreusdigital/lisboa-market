import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    // Solo procesar notificaciones de pagos aprobados
    if (type !== 'payment' || !data?.id) {
      return NextResponse.json({ ok: true })
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MP no configurado' }, { status: 500 })
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
    const paymentClient = new Payment(client)
    const payment = await paymentClient.get({ id: data.id })

    if (payment.status !== 'approved') {
      return NextResponse.json({ ok: true })
    }

    const external_reference = payment.external_reference
    if (!external_reference) return NextResponse.json({ ok: true })

    // Actualizar la venta con el mp_payment_id
    const supabase = await createClient()
    await supabase
      .from('sales')
      .update({ mp_payment_id: String(payment.id) })
      .eq('id', external_reference)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('MP webhook error:', error)
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}

// MP hace GET al webhook para verificar
export async function GET() {
  return NextResponse.json({ ok: true })
}

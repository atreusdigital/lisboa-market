import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'

export async function GET(request: NextRequest) {
  try {
    const external_reference = request.nextUrl.searchParams.get('external_reference')

    if (!external_reference) {
      return NextResponse.json({ error: 'Falta external_reference' }, { status: 400 })
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 500 })
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
    const paymentClient = new Payment(client)

    const result = await paymentClient.search({
      options: {
        criteria: 'desc',
        // @ts-ignore — external_reference está soportado pero no en el tipo del SDK
        external_reference,
      },
    })

    const payments = result.results ?? []
    const approved = payments.find((p: any) => p.status === 'approved')

    if (approved) {
      return NextResponse.json({
        status: 'approved',
        payment_id: String(approved.id),
        payment_method: approved.payment_type_id,
        amount: approved.transaction_amount,
      })
    }

    const rejected = payments.find((p: any) => p.status === 'rejected' || p.status === 'cancelled')
    if (rejected) {
      return NextResponse.json({ status: 'rejected' })
    }

    return NextResponse.json({ status: 'pending' })
  } catch (error) {
    console.error('MP check payment error:', error)
    return NextResponse.json({ error: 'Error al verificar pago' }, { status: 500 })
  }
}

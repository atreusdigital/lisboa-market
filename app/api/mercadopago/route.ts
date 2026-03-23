import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { amount, description } = await request.json()

    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 500 })
    }

    const response = await fetch('https://api.mercadopago.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${Date.now()}-${Math.random()}`,
      },
      body: JSON.stringify({
        amount,
        currency_id: 'ARS',
        description,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.message ?? 'Error MercadoPago' }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('MercadoPago error:', error)
    return NextResponse.json({ error: 'Error al procesar pago' }, { status: 500 })
  }
}

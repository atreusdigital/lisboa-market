import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'

export async function POST(request: NextRequest) {
  try {
    const { items, external_reference } = await request.json()

    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 500 })
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
    const preference = new Preference(client)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lisboa-market.vercel.app'

    const result = await preference.create({
      body: {
        items: items.map((item: { title: string; quantity: number; unit_price: number }) => ({
          id: item.title,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          currency_id: 'ARS',
        })),
        external_reference,
        notification_url: `${baseUrl}/api/mercadopago/webhook`,
        back_urls: {
          success: `${baseUrl}/pos`,
          failure: `${baseUrl}/pos`,
          pending: `${baseUrl}/pos`,
        },
        auto_return: 'approved',
        statement_descriptor: 'Lisboa Market',
        expires: true,
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      },
    })

    return NextResponse.json({
      preference_id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    })
  } catch (error) {
    console.error('MP create preference error:', error)
    return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 500 })
  }
}

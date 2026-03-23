import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { message } = await request.json()

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM ?? '+14155238886'
  const to = process.env.SEBASTIAN_WHATSAPP

  if (!accountSid || !authToken || !to) {
    return NextResponse.json({ error: 'Twilio no configurado' }, { status: 500 })
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${from}`,
        To: `whatsapp:${to}`,
        Body: message,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Twilio error:', error)
    return NextResponse.json({ error: 'Error al enviar WhatsApp' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

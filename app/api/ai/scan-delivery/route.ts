import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // 60 seconds (requires Vercel Pro or hobby with max 60s)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mediaType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analizá esta imagen de una factura/remito de proveedor para un kiosco argentino.

Extraé TODA la información disponible y respondé ÚNICAMENTE con este JSON exacto, sin texto adicional:

{
  "proveedor": "nombre del proveedor o distribuidora",
  "fecha": "fecha en formato YYYY-MM-DD si está visible",
  "numero_factura": "número de factura si está visible",
  "items": [
    {
      "descripcion_factura": "descripción exacta tal como aparece en la factura",
      "codigo_factura": "código de barras o código interno si está visible, sino null",
      "cantidad": número de unidades,
      "precio_unit": precio unitario sin IVA como número (si está visible),
      "importe": importe total del ítem como número (si está visible)
    }
  ],
  "subtotal": subtotal sin impuestos como número,
  "iva_pct": porcentaje de IVA como número (ej: 21 para 21%), null si no se ve,
  "iva_monto": monto de IVA como número,
  "iibb_pct": porcentaje de IIBB como número, null si no se ve,
  "iibb_monto": monto de IIBB como número, null si no se ve,
  "otros_impuestos": monto de otros impuestos como número, null si no se ve,
  "total": total final como número
}

Reglas importantes:
- La cantidad puede venir en cajas (DI, UN, etc.) - extraé la cantidad numérica
- Si hay columna PRECIO UNIT usá ese valor (NO el IMPORTE que es precio × cantidad)
- Si ves "B.O." o "BONIFICACIÓN" ignorala para el precio
- Extraé IVA, IIBB y cualquier percepción que aparezca en el pie de la factura
- Si un campo no está visible, usá null`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ items: [] })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Error scanning delivery:', error)
    return NextResponse.json({ error: 'Error processing image' }, { status: 500 })
  }
}

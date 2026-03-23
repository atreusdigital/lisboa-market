import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

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
      model: 'claude-opus-4-6',
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
              text: `Analizá esta imagen de un pedido/remito de proveedor para un kiosco/mini supermercado argentino.

Identificá todos los productos visibles y sus cantidades.

Respondé ÚNICAMENTE con un JSON en este formato exacto, sin texto adicional:
{
  "items": [
    { "name": "nombre del producto", "quantity": número }
  ]
}

Reglas:
- Usá nombres de productos claros y comunes en Argentina (ej: "Coca Cola 1.5L", "Fernet Branca 750ml", "Galletitas Oreo")
- Si no podés leer bien una cantidad, usá 1 como valor por defecto
- Incluí todos los productos visibles aunque no estés 100% seguro del nombre
- Si no es una imagen de productos/pedido, devolvé: {"items": []}`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parsear JSON de la respuesta
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

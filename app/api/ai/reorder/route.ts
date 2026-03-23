import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { context } = await request.json()

  const prompt = `Generá un plan de reposición para Lisboa Market basado en estos datos:

${context}

El plan debe:
1. Priorizar productos estrella (⭐) con stock bajo — son críticos
2. Calcular cantidad sugerida a pedir (stock mínimo × 3 como base, ajustado por velocidad de venta)
3. Agrupar por proveedor para facilitar los pedidos
4. Indicar urgencia: 🔴 Urgente (stock = 0 o estrella bajo mínimo), 🟡 Esta semana, 🟢 Próxima semana

Formato de respuesta:
- Un bloque por proveedor con sus productos
- Para cada producto: nombre, stock actual, sugerencia de compra, urgencia
- Al final: resumen de inversión estimada si hay precios de costo disponibles

Sé conciso y accionable. Respondé en español.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ plan: text })
}

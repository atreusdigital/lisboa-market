import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { context } = await request.json()

  const prompt = `Analizá los datos de ventas de Lisboa Market y generá un informe ejecutivo breve.

Datos:
${context}

Generá un análisis con estas secciones (usá emojis y negrita):
1. **Resumen del día** — qué pasó hoy en términos de ventas
2. **Productos estrella en riesgo** — productos marcados como estrella con stock bajo
3. **Tendencias destacadas** — qué se vende más, qué bajó
4. **Productos estancados** — sin movimiento en los últimos días
5. **Recomendación principal** — una acción concreta a tomar hoy

Sé directo, usá los datos reales. Máximo 300 palabras.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ analysis: text })
}

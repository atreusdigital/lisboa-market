import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { message, context } = await request.json()

  const systemPrompt = `Sos el asistente IA de Lisboa Market, una cadena de 2 kioscos 24hs en Buenos Aires (Caballito y Villa Luro).

Tu rol es ayudar a los dueños y encargados a entender el negocio en tiempo real.

Datos actuales del negocio:
${context}

Respondé en español, de forma concisa y directa. Usá números reales del contexto. Si no tenés datos suficientes para responder algo, decílo claramente.
Podés usar emojis para hacer las respuestas más claras. Formateá con negrita cuando sea útil.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ reply: text })
}

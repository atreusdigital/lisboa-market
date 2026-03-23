import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { branch_id } = await request.json()

    // Obtener stock y ventas recientes
    const { data: stock } = await supabase
      .from('stock')
      .select('*, product:products(name, category, sell_price)')
      .eq('branch_id', branch_id)
      .order('quantity')

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('product_id, quantity, sale:sales(created_at, branch_id)')
      .gte('sale.created_at', sevenDaysAgo.toISOString())

    const stockData = stock?.map((s) => ({
      name: s.product?.name,
      category: s.product?.category,
      stock: s.quantity,
      min_stock: s.min_quantity,
      sell_price: s.product?.sell_price,
    }))

    const prompt = `Sos el sistema de inteligencia artificial de Lisboa Market, un mini supermercado 24hs en Buenos Aires.

Analizá el siguiente inventario y generá recomendaciones de reposición:

STOCK ACTUAL:
${JSON.stringify(stockData?.slice(0, 30), null, 2)}

Respondé con un JSON en este formato:
{
  "urgent": [{ "product": "nombre", "reason": "motivo", "suggested_quantity": número }],
  "recommended": [{ "product": "nombre", "reason": "motivo", "suggested_quantity": número }],
  "insights": ["insight 1", "insight 2"]
}

- "urgent": productos con stock crítico que hay que pedir YA
- "recommended": productos que conviene reponer pronto
- "insights": 2-3 observaciones relevantes sobre el inventario

Sé conciso y práctico. Usá pesos argentinos si mencionás valores.`

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ urgent: [], recommended: [], insights: [] })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (error) {
    console.error('Error generating suggestions:', error)
    return NextResponse.json({ error: 'Error generating suggestions' }, { status: 500 })
  }
}

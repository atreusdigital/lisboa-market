import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBusinessContext } from '@/lib/ai/build-context'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const context = await buildBusinessContext(supabase)
    return NextResponse.json({ context })
  } catch (error) {
    console.error('Context fetch error:', error)
    return NextResponse.json({ error: 'Error al cargar contexto' }, { status: 500 })
  }
}

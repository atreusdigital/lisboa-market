import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60

interface ProductRow {
  name: string
  category: string
  subcategory: string | null
  barcode: string | null
  cost_price: number
  sell_price: number
  pedidos_ya_price: number
  rappi_price: number
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { products, pass } = await req.json() as { products: ProductRow[]; pass: 'names' | 'barcodes' }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (pass === 'names') {
    // Pass 1: upsert sin barcodes — garantizado sin conflictos
    const payload = products.map(p => ({
      name: p.name,
      category: p.category,
      subcategory: p.subcategory,
      barcode: null,
      cost_price: p.cost_price,
      sell_price: p.sell_price,
      pedidos_ya_price: p.pedidos_ya_price,
      rappi_price: p.rappi_price,
    }))
    const { error } = await admin.from('products').upsert(payload, { onConflict: 'name' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, count: payload.length })
  }

  if (pass === 'barcodes') {
    // Pass 2: asignar barcodes de a uno (skip si hay conflicto)
    let set = 0
    for (const p of products) {
      if (!p.barcode) continue
      const { error } = await admin.from('products').update({ barcode: p.barcode }).eq('name', p.name)
      if (!error) set++
    }
    return NextResponse.json({ ok: true, count: set })
  }

  return NextResponse.json({ error: 'pass inválido' }, { status: 400 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { count } = await admin.from('products').select('*', { count: 'exact', head: true })
  return NextResponse.json({ count: count ?? 0 })
}

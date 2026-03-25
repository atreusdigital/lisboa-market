import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json() as {
    branch_id: string
    proveedor: string | null
    fecha: string | null
    numero_factura: string | null
    invoice_image_base64: string | null
    subtotal: number | null
    iva_monto: number | null
    iibb_monto: number | null
    total: number | null
    items: {
      product_id: string
      descripcion_factura: string
      cantidad: number
      costo_unit: number | null
      sell_price: number | null
    }[]
  }

  // Upload invoice image to Supabase Storage
  let invoice_image_url: string | null = null
  if (body.invoice_image_base64) {
    const imageBuffer = Buffer.from(body.invoice_image_base64, 'base64')
    const fileName = `${Date.now()}_${user.id}.jpg`
    const { data: uploadData, error: uploadError } = await admin.storage
      .from('facturas')
      .upload(fileName, imageBuffer, { contentType: 'image/jpeg', upsert: false })

    if (!uploadError && uploadData) {
      const { data: { publicUrl } } = admin.storage.from('facturas').getPublicUrl(uploadData.path)
      invoice_image_url = publicUrl
    }
  }

  // Save purchase header
  const { data: purchase, error: purchaseError } = await admin
    .from('purchases')
    .insert({
      branch_id: body.branch_id,
      user_id: user.id,
      proveedor: body.proveedor,
      fecha: body.fecha,
      numero_factura: body.numero_factura,
      invoice_image_url,
      subtotal: body.subtotal,
      iva_monto: body.iva_monto,
      iibb_monto: body.iibb_monto,
      total: body.total,
      items_count: body.items.length,
    })
    .select('id')
    .single()

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: purchaseError?.message ?? 'Error guardando compra' }, { status: 500 })
  }

  // Save purchase items
  const purchaseItems = body.items.map(item => {
    const costoUnit = item.costo_unit ?? 0
    const costTotal = costoUnit * item.cantidad
    const rent = item.sell_price && costoUnit > 0
      ? ((item.sell_price - costoUnit) / item.sell_price * 100)
      : null
    return {
      purchase_id: purchase.id,
      product_id: item.product_id,
      descripcion_factura: item.descripcion_factura,
      cantidad: item.cantidad,
      costo_unit: costoUnit,
      costo_total: costTotal,
      sell_price: item.sell_price,
      rent_pct: rent ? Math.round(rent * 10) / 10 : null,
    }
  })

  await admin.from('purchase_items').insert(purchaseItems)

  return NextResponse.json({ ok: true, purchase_id: purchase.id })
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branch_id')
  const purchaseId = searchParams.get('id')

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (purchaseId) {
    const { data: items } = await admin
      .from('purchase_items')
      .select('*, product:products(name, category)')
      .eq('purchase_id', purchaseId)
    return NextResponse.json(items ?? [])
  }

  let q = admin
    .from('purchases')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (branchId) q = q.eq('branch_id', branchId)

  const { data } = await q
  return NextResponse.json(data ?? [])
}

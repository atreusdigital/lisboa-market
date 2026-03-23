import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: 'No podés borrarte a vos mismo' }, { status: 400 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { DEFAULT_PERMISSIONS, type RolePermissions } from '@/lib/permissions'

export async function GET() {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await admin
    .from('settings')
    .select('value')
    .eq('key', 'role_permissions')
    .single()

  if (error || !data) {
    return NextResponse.json(DEFAULT_PERMISSIONS)
  }
  return NextResponse.json(data.value)
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') {
    return NextResponse.json({ error: 'Solo el dueño puede modificar permisos' }, { status: 403 })
  }

  const permissions = await req.json() as RolePermissions

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await admin.from('settings').upsert({
    key: 'role_permissions',
    value: permissions,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

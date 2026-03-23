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

  const { full_name, username, password, role, branch_id } = await req.json()

  if (!full_name || !username || !password || !role) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const email = `${username.toLowerCase().replace(/\s+/g, '')}@lisboa.internal`

  // Crear en Supabase Auth
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Actualizar profile
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name,
      username: username.toLowerCase().trim(),
      role,
      branch_id: branch_id || null,
    })
    .eq('id', newUser.user.id)

  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

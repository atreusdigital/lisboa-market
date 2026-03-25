import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const PERMISSIONS = [
  { key: 'abrir_cerrar_turnos', label: 'Abrir/cerrar turnos', category: 'Caja' },
  { key: 'cierre_caja', label: 'Realizar cierres de caja', category: 'Caja' },
  { key: 'agregar_categorias_gasto', label: 'Agregar categorías de gasto', category: 'Caja' },
  { key: 'registrar_gastos', label: 'Registrar gastos', category: 'Caja' },
  { key: 'gestionar_usuarios', label: 'Crear/editar/eliminar usuarios', category: 'Usuarios' },
  { key: 'importar_productos', label: 'Importar catálogo de productos', category: 'Stock' },
  { key: 'limpiar_catalogo', label: 'Limpiar catálogo completo', category: 'Stock' },
  { key: 'gestionar_proveedores', label: 'Gestionar proveedores y pedidos', category: 'Proveedores' },
  { key: 'escanear_remitos', label: 'Escanear remitos con IA', category: 'Proveedores' },
  { key: 'ver_reportes', label: 'Ver reportes y análisis', category: 'Reportes' },
  { key: 'ver_todas_sucursales', label: 'Ver todas las sucursales', category: 'Sistema' },
  { key: 'gestionar_promociones', label: 'Crear y activar promociones', category: 'Sistema' },
] as const

export type PermissionKey = typeof PERMISSIONS[number]['key']

export type RolePermissions = Record<string, Record<PermissionKey, boolean>>

export const DEFAULT_PERMISSIONS: RolePermissions = {
  director: Object.fromEntries(PERMISSIONS.map(p => [p.key, true])) as Record<PermissionKey, boolean>,
  admin: {
    abrir_cerrar_turnos: true,
    cierre_caja: true,
    agregar_categorias_gasto: true,
    registrar_gastos: true,
    gestionar_usuarios: true,
    importar_productos: true,
    limpiar_catalogo: false,
    gestionar_proveedores: true,
    escanear_remitos: true,
    ver_reportes: true,
    ver_todas_sucursales: false,
    gestionar_promociones: false,
  },
  empleado: {
    abrir_cerrar_turnos: false,
    cierre_caja: false,
    agregar_categorias_gasto: false,
    registrar_gastos: true,
    gestionar_usuarios: false,
    importar_productos: false,
    limpiar_catalogo: false,
    gestionar_proveedores: false,
    escanear_remitos: false,
    ver_reportes: false,
    ver_todas_sucursales: false,
    gestionar_promociones: false,
  },
}

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

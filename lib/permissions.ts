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

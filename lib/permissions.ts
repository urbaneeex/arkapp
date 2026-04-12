/**
 * Constantes y tipos compartidos para el sistema de permisos.
 * La matriz por defecto se usa como fallback cuando no hay datos en DB.
 */

export const PERMISSION_LEVEL_IDS = [
  'basico',
  'bajo',
  'medio',
  'alto',
  'propietario',
] as const

export type LevelId = (typeof PERMISSION_LEVEL_IDS)[number]

export type PermissionKey =
  | 'calendar_view'
  | 'work_board_view'
  | 'appointments_create'
  | 'appointments_edit'
  | 'appointments_delete'
  | 'appointments_move'
  | 'pipeline_stages_manage'
  | 'clients_view'
  | 'clients_edit'
  | 'clients_delete'
  | 'services_view'
  | 'services_edit'
  | 'services_delete'
  | 'staff_view'
  | 'staff_invite'
  | 'staff_edit'
  | 'reports_view'
  | 'finances_view'
  | 'finances_manage'
  | 'settings_manage'
  | 'permissions_manage'
  | 'time_tracking_view'
  | 'time_tracking_manage'
  | 'absences_view'
  | 'absences_manage'

export type Permissions = Record<PermissionKey, boolean>

export type PermissionMatrix = Record<LevelId, Permissions>

const baseKeys: PermissionKey[] = [
  'calendar_view',
  'work_board_view',
  'appointments_create',
  'appointments_edit',
  'appointments_delete',
  'appointments_move',
  'pipeline_stages_manage',
  'clients_view',
  'clients_edit',
  'clients_delete',
  'services_view',
  'services_edit',
  'services_delete',
  'staff_view',
  'staff_invite',
  'staff_edit',
  'reports_view',
  'finances_view',
  'finances_manage',
  'settings_manage',
  'permissions_manage',
  'time_tracking_view',
  'time_tracking_manage',
  'absences_view',
  'absences_manage',
]

function makePermissions(overrides: Partial<Permissions>): Permissions {
  const p: Record<string, boolean> = {}
  baseKeys.forEach((k) => {
    p[k] = overrides[k] ?? false
  })
  return p as Permissions
}

export const DEFAULT_MATRIX: PermissionMatrix = {
  basico: makePermissions({
    calendar_view: true,
    work_board_view: true,
  }),
  bajo: makePermissions({
    calendar_view: true,
    work_board_view: true,
    appointments_create: true,
    clients_view: true,
    services_view: true,
  }),
  medio: makePermissions({
    calendar_view: true,
    work_board_view: true,
    appointments_create: true,
    appointments_edit: true,
    appointments_move: true,
    clients_view: true,
    clients_edit: true,
    services_view: true,
    services_edit: true,
    staff_view: true,
    reports_view: true,
    finances_view: true,
    time_tracking_view: true,
    absences_view: true,
  }),
  alto: makePermissions({
    calendar_view: true,
    work_board_view: true,
    appointments_create: true,
    appointments_edit: true,
    appointments_delete: true,
    appointments_move: true,
    clients_view: true,
    clients_edit: true,
    clients_delete: true,
    services_view: true,
    services_edit: true,
    services_delete: true,
    staff_view: true,
    staff_invite: true,
    staff_edit: true,
    reports_view: true,
    finances_view: true,
    finances_manage: true,
    settings_manage: true,
    time_tracking_view: true,
    time_tracking_manage: true,
    absences_view: true,
    absences_manage: true,
    pipeline_stages_manage: true,
  }),
  propietario: makePermissions({
    calendar_view: true,
    work_board_view: true,
    appointments_create: true,
    appointments_edit: true,
    appointments_delete: true,
    appointments_move: true,
    clients_view: true,
    clients_edit: true,
    clients_delete: true,
    services_view: true,
    services_edit: true,
    services_delete: true,
    staff_view: true,
    staff_invite: true,
    staff_edit: true,
    reports_view: true,
    finances_view: true,
    finances_manage: true,
    settings_manage: true,
    permissions_manage: true,
    time_tracking_view: true,
    time_tracking_manage: true,
    absences_view: true,
    absences_manage: true,
    pipeline_stages_manage: true,
  }),
}

/** Normaliza un objeto de permisos desde la DB (puede tener keys faltantes) rellenando con el nivel por defecto */
export function mergeWithDefault(
  level: LevelId,
  fromDb: Record<string, boolean> | null | undefined
): Permissions {
  const def = DEFAULT_MATRIX[level]
  if (!fromDb || typeof fromDb !== 'object') return { ...def }
  const out = { ...def }
  baseKeys.forEach((k) => {
    if (typeof fromDb[k] === 'boolean') (out as Record<string, boolean>)[k] = fromDb[k]
  })
  return out
}

/** Devuelve la matriz por defecto para serializar en DB (solo niveles editables; propietario puede omitirse o ir siempre todo) */
export function getDefaultMatrixForDb(): Record<string, Permissions> {
  return { ...DEFAULT_MATRIX }
}

/** Filas para la UI de la matriz (categoría, etiqueta, key del permiso) */
export const PERMISSION_ROWS: { category: string; permission: string; key: PermissionKey }[] = [
  { category: 'Calendario', permission: 'Ver calendario', key: 'calendar_view' },
  { category: 'Calendario', permission: 'Ver tablero (Kanban / lista)', key: 'work_board_view' },
  { category: 'Calendario', permission: 'Crear citas', key: 'appointments_create' },
  { category: 'Calendario', permission: 'Editar citas', key: 'appointments_edit' },
  { category: 'Calendario', permission: 'Eliminar citas', key: 'appointments_delete' },
  { category: 'Calendario', permission: 'Mover/arrastrar citas', key: 'appointments_move' },
  {
    category: 'Calendario',
    permission: 'Gestionar columnas del embudo (Kanban)',
    key: 'pipeline_stages_manage',
  },
  { category: 'Clientes', permission: 'Ver clientes', key: 'clients_view' },
  { category: 'Clientes', permission: 'Crear y editar clientes', key: 'clients_edit' },
  { category: 'Clientes', permission: 'Eliminar clientes', key: 'clients_delete' },
  { category: 'Servicios', permission: 'Ver servicios', key: 'services_view' },
  { category: 'Servicios', permission: 'Crear y editar servicios', key: 'services_edit' },
  { category: 'Servicios', permission: 'Eliminar servicios', key: 'services_delete' },
  { category: 'Equipo', permission: 'Ver empleados', key: 'staff_view' },
  { category: 'Equipo', permission: 'Invitar empleados', key: 'staff_invite' },
  { category: 'Equipo', permission: 'Editar y eliminar empleados', key: 'staff_edit' },
  { category: 'Reportes', permission: 'Ver reportes', key: 'reports_view' },
  { category: 'Finanzas', permission: 'Ver finanzas', key: 'finances_view' },
  { category: 'Finanzas', permission: 'Gestionar ingresos y gastos', key: 'finances_manage' },
  { category: 'Configuración', permission: 'Ver y editar configuración del negocio', key: 'settings_manage' },
  { category: 'Permisos', permission: 'Gestionar roles y permisos', key: 'permissions_manage' },
  { category: 'Fichajes', permission: 'Ver fichajes del equipo', key: 'time_tracking_view' },
  { category: 'Fichajes', permission: 'Gestionar fichajes (crear/editar)', key: 'time_tracking_manage' },
  { category: 'Vacaciones', permission: 'Ver solicitudes de ausencia', key: 'absences_view' },
  { category: 'Vacaciones', permission: 'Aprobar/rechazar ausencias', key: 'absences_manage' },
]

export const PERMISSION_LEVELS_UI = [
  { id: 'basico' as const, label: 'Básico' },
  { id: 'bajo' as const, label: 'Bajo' },
  { id: 'medio' as const, label: 'Medio' },
  { id: 'alto' as const, label: 'Alto' },
  { id: 'propietario' as const, label: 'Propietario' },
]

/** Comprueba si `userId` es asignado en metadata.kanban_assignees [{ id, name }, ...]. */
export function metadataKanbanAssigneesIncludeUser(metadata: unknown, userId: string): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const raw = (metadata as Record<string, unknown>).kanban_assignees
  if (!Array.isArray(raw)) return false
  return raw.some((e) => {
    if (e && typeof e === 'object' && 'id' in e) {
      return String((e as { id: unknown }).id) === userId
    }
    return false
  })
}

/** Creador, staff_id principal o lista kanban_assignees. */
export function userParticipatesInAppointmentRow(
  row: {
    created_by?: string | null
    staff_id?: string | null
    metadata?: unknown | null
    business_id: string
  },
  userId: string,
  businessId: string
): boolean {
  if (row.business_id !== businessId) return false
  if (row.created_by === userId) return true
  if (row.staff_id === userId) return true
  return metadataKanbanAssigneesIncludeUser(row.metadata, userId)
}

type AppointmentAccessRow = {
  business_id: string
  created_by?: string | null
  staff_id?: string | null
  metadata?: unknown | null
}

/** Ver, abrir, editar y mover: solo participantes (creador o asignados). */
export function userCanAccessAppointmentClient(
  item: AppointmentAccessRow,
  userId: string,
  businessId: string
): boolean {
  return userParticipatesInAppointmentRow(item, userId, businessId)
}

/** Editar tarea: participantes (creador o asignados). Mismo criterio que ver/abrir/mover. */
export function userCanEditAppointmentClient(
  item: AppointmentAccessRow,
  userId: string,
  businessId: string
): boolean {
  return userCanAccessAppointmentClient(item, userId, businessId)
}

/** Eliminar tarea: solo el creador (asignados no pueden borrar). */
export function userCanDeleteAppointmentClient(
  item: Pick<AppointmentAccessRow, 'business_id' | 'created_by'>,
  userId: string,
  businessId: string
): boolean {
  return item.business_id === businessId && item.created_by != null && item.created_by === userId
}

/** @deprecated Usar userCanEditAppointmentClient */
export function userCanEditAppointmentCardClient(
  item: AppointmentAccessRow,
  userId: string,
  businessId: string
): boolean {
  return userCanEditAppointmentClient(item, userId, businessId)
}

/** @deprecated Usar userCanAccessAppointmentClient */
export function userCanOpenAppointmentDetailClient(
  item: AppointmentAccessRow,
  userId: string,
  businessId: string
): boolean {
  return userCanAccessAppointmentClient(item, userId, businessId)
}

/** @deprecated Usar userCanAccessAppointmentClient */
export function userCanMoveAppointmentCardClient(
  item: AppointmentAccessRow,
  userId: string,
  businessId: string,
  _myTeamIds?: readonly string[]
): boolean {
  return userCanAccessAppointmentClient(item, userId, businessId)
}

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
export function userParticipatesInAppointmentRow(row: {
  created_by?: string | null
  staff_id?: string | null
  metadata?: unknown | null
  business_id: string
}, userId: string, businessId: string): boolean {
  if (row.business_id !== businessId) return false
  if (row.created_by === userId) return true
  if (row.staff_id === userId) return true
  return metadataKanbanAssigneesIncludeUser(row.metadata, userId)
}

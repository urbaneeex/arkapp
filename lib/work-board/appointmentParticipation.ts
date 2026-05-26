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

/** Coincidencia `team_id` / `team_ids` de la tarjeta con equipos del usuario (SSR/cliente). */
export function userSharesTeamWithAppointmentCard(
  item: { team_id?: string | null; team_ids?: string[] | undefined },
  myTeamIds: readonly string[]
): boolean {
  if (!myTeamIds.length) return false
  const mine = new Set(myTeamIds)
  if (item.team_id && mine.has(item.team_id)) return true
  for (const tid of item.team_ids ?? []) {
    if (mine.has(tid)) return true
  }
  return false
}

/** Solo el creador puede editar contenido (título, equipos, asignaciones amplias, etc.). */
export function userCanEditAppointmentCardClient(
  item: { business_id: string; created_by?: string | null },
  userId: string,
  businessId: string
): boolean {
  return item.business_id === businessId && item.created_by === userId
}

/** Abrir detalle (formulario solo lectura + actividad): creador o asignado principal / kanban_assignees. */
export function userCanOpenAppointmentDetailClient(
  item: {
    business_id: string
    created_by?: string | null
    staff_id?: string | null
    metadata?: unknown | null
  },
  userId: string,
  businessId: string
): boolean {
  if (userCanEditAppointmentCardClient(item, userId, businessId)) return true
  return userParticipatesInAppointmentRow(
    {
      business_id: businessId,
      created_by: item.created_by,
      staff_id: item.staff_id,
      metadata: item.metadata,
    },
    userId,
    businessId
  )
}

/** Mover columna / marcar completado: creador, staff principal, kanban_assignees o equipo de la tarjeta. */
export function userCanMoveAppointmentCardClient(
  item: {
    business_id: string
    created_by?: string | null
    staff_id?: string | null
    metadata?: unknown | null
    team_id?: string | null
    team_ids?: string[]
  },
  userId: string,
  businessId: string,
  myTeamIds: readonly string[]
): boolean {
  if (item.business_id !== businessId) return false
  if (
    userParticipatesInAppointmentRow(
      {
        business_id: businessId,
        created_by: item.created_by,
        staff_id: item.staff_id,
        metadata: item.metadata,
      },
      userId,
      businessId
    )
  ) {
    return true
  }
  return userSharesTeamWithAppointmentCard(item, myTeamIds)
}

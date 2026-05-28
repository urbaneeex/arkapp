import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  kanbanPriorityLabel,
  parseKanbanPriorityFromMetadata,
  type KanbanPriorityLevel,
} from '@/lib/work-items/kanbanPriority'

export type AppointmentAuditRecord = Record<string, unknown> | null

export type AppointmentActivityNameContext = {
  staffNames: Map<string, string>
  stageLabels: Map<string, string>
  clientNames: Map<string, string>
  serviceNames: Map<string, string>
  teamNames: Map<string, string>
}

export type AppointmentAuditRowInput = {
  actor_id: string | null
  action: string
  old_record: AppointmentAuditRecord
  new_record: AppointmentAuditRecord
}

function titleOf(rec: AppointmentAuditRecord): string {
  if (!rec) return 'Sin título'
  const t = rec.title
  return typeof t === 'string' && t.trim() ? t.trim() : 'Sin título'
}

function strId(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v)
}

function formatDateTime(iso: unknown, dateOnly?: boolean): string | null {
  if (iso == null || iso === '') return null
  const s = String(iso)
  const d = parseISO(s)
  if (Number.isNaN(d.getTime())) return null
  if (dateOnly) return format(d, 'd MMM yyyy', { locale: es })
  return format(d, 'd MMM yyyy, HH:mm', { locale: es })
}

function nameFromMap(map: Map<string, string>, id: unknown, fallback = 'Sin nombre'): string {
  const key = strId(id)
  if (!key) return fallback
  return map.get(key)?.trim() || fallback
}

function kanbanAssigneeIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const raw = (metadata as Record<string, unknown>).kanban_assignees
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  for (const e of raw) {
    if (e && typeof e === 'object' && 'id' in e) {
      const id = String((e as { id: unknown }).id)
      if (id) ids.push(id)
    }
  }
  return ids
}

function formatAssigneeList(ids: string[], ctx: AppointmentActivityNameContext): string {
  if (ids.length === 0) return 'nadie'
  return ids.map((id) => ctx.staffNames.get(id)?.trim() || 'Usuario').join(', ')
}

function visibilityLabel(v: unknown): string | null {
  if (v === 'personal') return 'Personal'
  if (v === 'team') return 'Equipo'
  if (v === 'business') return 'Negocio'
  return null
}

function isDateOnlyMeta(metadata: unknown, key: 'kanban_start_date_only' | 'kanban_end_date_only'): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return (metadata as Record<string, unknown>)[key] === true
}

/** Frases de cambio (sin nombre de actor). Vacío si no hay cambio legible. */
export function describeAppointmentAuditChangePhrases(
  row: AppointmentAuditRowInput,
  ctx: AppointmentActivityNameContext
): string[] {
  if (!row.actor_id) return []

  const { action, old_record: oldR, new_record: newR } = row
  const phrases: string[] = []

  if (action === 'insert') {
    phrases.push(`creó la tarea «${titleOf(newR)}»`)
    return phrases
  }

  if (action === 'delete') {
    phrases.push(`eliminó la tarea «${titleOf(oldR)}»`)
    return phrases
  }

  if (action !== 'update' || !oldR || !newR) return []

  const oldTitle = typeof oldR.title === 'string' ? oldR.title.trim() : ''
  const newTitle = typeof newR.title === 'string' ? newR.title.trim() : ''
  if (oldTitle !== newTitle && newTitle) {
    phrases.push(`renombró la tarea a «${newTitle}»`)
  }

  const oldStart = oldR.start_time
  const newStart = newR.start_time
  if (oldStart !== newStart) {
    if (newStart == null || newStart === '') {
      phrases.push('eliminó la fecha de inicio')
    } else {
      const label = formatDateTime(newStart, isDateOnlyMeta(newR.metadata, 'kanban_start_date_only'))
      if (label) phrases.push(`cambió la fecha de inicio a ${label}`)
    }
  }

  const oldEnd = oldR.end_time
  const newEnd = newR.end_time
  if (oldEnd !== newEnd) {
    if (newEnd == null || newEnd === '') {
      phrases.push('eliminó la fecha de fin')
    } else {
      const label = formatDateTime(newEnd, isDateOnlyMeta(newR.metadata, 'kanban_end_date_only'))
      if (label) phrases.push(`cambió la fecha de fin a ${label}`)
    }
  }

  const oldStaff = strId(oldR.staff_id)
  const newStaff = strId(newR.staff_id)
  const oldAssignees = kanbanAssigneeIds(oldR.metadata)
  const newAssignees = kanbanAssigneeIds(newR.metadata)
  const assigneesChanged =
    oldStaff !== newStaff || oldAssignees.join('\0') !== newAssignees.join('\0')

  if (assigneesChanged) {
    const ids = newAssignees.length > 0 ? newAssignees : newStaff ? [newStaff] : []
    if (ids.length === 0) {
      phrases.push('quitó la asignación')
    } else {
      phrases.push(`asignó a ${formatAssigneeList(ids, ctx)}`)
    }
  }

  const oldStage = strId(oldR.pipeline_stage_id)
  const newStage = strId(newR.pipeline_stage_id)
  if (oldStage !== newStage && newStage) {
    const label = nameFromMap(ctx.stageLabels, newStage, 'otra columna')
    phrases.push(`movió a la columna «${label}»`)
  }

  const oldCompleted = oldR.completed_at
  const newCompleted = newR.completed_at
  if (!oldCompleted && newCompleted) {
    phrases.push('marcó la tarea como completada')
  } else if (oldCompleted && !newCompleted) {
    phrases.push('reabrió la tarea')
  }

  const oldArchived = oldR.archived_at
  const newArchived = newR.archived_at
  if (!oldArchived && newArchived) {
    phrases.push('archivó la tarea')
  } else if (oldArchived && !newArchived) {
    phrases.push('restauró la tarea del archivo')
  }

  const oldPriority = parseKanbanPriorityFromMetadata(oldR.metadata)
  const newPriority = parseKanbanPriorityFromMetadata(newR.metadata)
  if (oldPriority !== newPriority) {
    if (!newPriority) {
      phrases.push('quitó la prioridad')
    } else {
      const label = kanbanPriorityLabel(newPriority as KanbanPriorityLevel) ?? newPriority
      phrases.push(`cambió la prioridad a ${label}`)
    }
  }

  const oldClient = strId(oldR.client_id)
  const newClient = strId(newR.client_id)
  if (oldClient !== newClient) {
    if (!newClient) {
      phrases.push('desvinculó el cliente')
    } else {
      phrases.push(`vinculó el cliente ${nameFromMap(ctx.clientNames, newClient)}`)
    }
  }

  const oldService = strId(oldR.service_id)
  const newService = strId(newR.service_id)
  if (oldService !== newService) {
    if (!newService) {
      phrases.push('desvinculó el servicio')
    } else {
      phrases.push(`vinculó el servicio ${nameFromMap(ctx.serviceNames, newService)}`)
    }
  }

  const oldTeam = strId(oldR.team_id)
  const newTeam = strId(newR.team_id)
  if (oldTeam !== newTeam) {
    if (!newTeam) {
      phrases.push('quitó el equipo')
    } else {
      phrases.push(`cambió el equipo a ${nameFromMap(ctx.teamNames, newTeam)}`)
    }
  }

  const oldVis = oldR.visibility
  const newVis = newR.visibility
  if (oldVis !== newVis && newVis != null) {
    const label = visibilityLabel(newVis)
    if (label) phrases.push(`cambió la visibilidad a ${label}`)
  }

  const oldStatus = oldR.status
  const newStatus = newR.status
  if (
    oldStatus !== newStatus &&
    newStatus != null &&
    oldCompleted === newCompleted &&
    oldStage === newStage
  ) {
    phrases.push(`cambió el estado a ${String(newStatus)}`)
  }

  return phrases
}

export function actorDisplayName(actorId: string, staffNames: Map<string, string>): string {
  return staffNames.get(actorId)?.trim() || 'Un usuario'
}

/** Una línea: «Nombre frase1; frase2» */
export function formatAppointmentAuditLine(
  row: AppointmentAuditRowInput,
  ctx: AppointmentActivityNameContext
): string | null {
  if (!row.actor_id) return null
  const phrases = describeAppointmentAuditChangePhrases(row, ctx)
  if (phrases.length === 0) return null
  const who = actorDisplayName(row.actor_id, ctx.staffNames)
  return `${who} ${phrases.join('; ')}`
}

export function mergeAuditPhraseGroups(
  phraseGroups: string[][],
  actorId: string,
  staffNames: Map<string, string>
): string | null {
  const merged: string[] = []
  for (const group of phraseGroups) {
    for (const p of group) {
      if (!merged.includes(p)) merged.push(p)
    }
  }
  if (merged.length === 0) return null
  return `${actorDisplayName(actorId, staffNames)} ${merged.join('; ')}`
}

export function buildNameContextFromRows(params: {
  staffNames: Map<string, string>
  stages?: { id: string; label: string }[]
  clients?: { id: string; name: string | null }[]
  services?: { id: string; name: string | null }[]
  teams?: { id: string; name: string | null }[]
}): AppointmentActivityNameContext {
  const stageLabels = new Map<string, string>()
  for (const s of params.stages ?? []) {
    if (s.id) stageLabels.set(s.id, s.label?.trim() || 'Columna')
  }
  const clientNames = new Map<string, string>()
  for (const c of params.clients ?? []) {
    if (c.id && c.name) clientNames.set(c.id, c.name)
  }
  const serviceNames = new Map<string, string>()
  for (const s of params.services ?? []) {
    if (s.id && s.name) serviceNames.set(s.id, s.name)
  }
  const teamNames = new Map<string, string>()
  for (const t of params.teams ?? []) {
    if (t.id && t.name) teamNames.set(t.id, t.name)
  }
  return {
    staffNames: params.staffNames,
    stageLabels,
    clientNames,
    serviceNames,
    teamNames,
  }
}

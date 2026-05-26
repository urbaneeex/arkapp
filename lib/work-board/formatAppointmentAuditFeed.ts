type AuditRow = {
  actor_id: string | null
  action: string
  old_record: Record<string, unknown> | null
  new_record: Record<string, unknown> | null
  created_at: string
}

function titleOf(rec: Record<string, unknown> | null): string {
  if (!rec) return 'una tarea'
  const t = rec.title
  return typeof t === 'string' && t.trim() ? t.trim() : 'una tarea'
}

function relativeTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24)
  if (days === 1) return 'ayer'
  return `hace ${days} d`
}

export function formatAuditRowText(
  row: AuditRow,
  staffNames: Map<string, string>
): string {
  const who = row.actor_id ? staffNames.get(row.actor_id) ?? 'Un usuario' : 'Sistema'
  const oldR = row.old_record
  const newR = row.new_record
  if (row.action === 'insert') {
    return `${who} creó «${titleOf(newR)}»`
  }
  if (row.action === 'delete') {
    return `${who} eliminó «${titleOf(oldR)}»`
  }
  const oldCompleted =
    oldR && typeof oldR === 'object' && 'completed_at' in oldR
      ? (oldR as { completed_at?: unknown }).completed_at
      : null
  const newCompleted =
    newR && typeof newR === 'object' && 'completed_at' in newR
      ? (newR as { completed_at?: unknown }).completed_at
      : null
  if (!oldCompleted && newCompleted) {
    return `${who} completó «${titleOf(newR)}»`
  }
  const oldStage =
    oldR && typeof oldR === 'object' && 'pipeline_stage_id' in oldR
      ? String((oldR as { pipeline_stage_id?: unknown }).pipeline_stage_id ?? '')
      : ''
  const newStage =
    newR && typeof newR === 'object' && 'pipeline_stage_id' in newR
      ? String((newR as { pipeline_stage_id?: unknown }).pipeline_stage_id ?? '')
      : ''
  if (oldStage && newStage && oldStage !== newStage) {
    return `${who} cambió el estado de «${titleOf(newR)}»`
  }
  return `${who} actualizó «${titleOf(newR)}»`
}

/** Convierte filas de appointment_audit_log en frases cortas para el feed del propietario. */
export function formatAppointmentAuditFeed(
  rows: AuditRow[],
  staffNames: Map<string, string>
): { text: string; created_at: string }[] {
  const out: { text: string; created_at: string }[] = []
  for (const row of rows) {
    const text = formatAuditRowText(row, staffNames)
    out.push({ text: `${text} · ${relativeTime(row.created_at)}`, created_at: row.created_at })
  }
  return out
}

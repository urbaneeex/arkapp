import {
  buildNameContextFromRows,
  formatAppointmentAuditLine,
  type AppointmentActivityNameContext,
  type AppointmentAuditRowInput,
} from '@/lib/work-board/describeAppointmentAuditChanges'

type AuditRow = AppointmentAuditRowInput & {
  created_at: string
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
  row: AppointmentAuditRowInput,
  ctx: AppointmentActivityNameContext
): string | null {
  return formatAppointmentAuditLine(row, ctx)
}

/** Convierte filas de appointment_audit_log en frases cortas para el feed del propietario. */
export function formatAppointmentAuditFeed(
  rows: AuditRow[],
  staffNames: Map<string, string>,
  nameContext?: Partial<Omit<AppointmentActivityNameContext, 'staffNames'>>
): { text: string; created_at: string }[] {
  const ctx: AppointmentActivityNameContext = {
    staffNames,
    stageLabels: nameContext?.stageLabels ?? new Map(),
    clientNames: nameContext?.clientNames ?? new Map(),
    serviceNames: nameContext?.serviceNames ?? new Map(),
    teamNames: nameContext?.teamNames ?? new Map(),
  }

  const out: { text: string; created_at: string }[] = []
  for (const row of rows) {
    const text = formatAuditRowText(row, ctx)
    if (!text) continue
    out.push({ text: `${text} · ${relativeTime(row.created_at)}`, created_at: row.created_at })
  }
  return out
}

export { buildNameContextFromRows }

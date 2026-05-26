import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatAuditRowText } from '@/lib/work-board/formatAppointmentAuditFeed'
import type {
  AppointmentActivityItem,
  AppointmentCommentRow,
} from '@/lib/work-board/appointmentActivityTypes'
import { tipTapContentToPlainText } from '@/lib/work-board/tiptapContent'

type AuditRow = {
  id: string
  actor_id: string | null
  action: string
  old_record: Record<string, unknown> | null
  new_record: Record<string, unknown> | null
  created_at: string
}

function staffNameFromRow(
  staff: AppointmentCommentRow['staff']
): string {
  if (!staff) return 'Usuario'
  const one = Array.isArray(staff) ? staff[0] : staff
  return (one?.name ?? '').trim() || 'Usuario'
}

export function formatActivityTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, "d MMM 'a las' HH:mm", { locale: es })
}

export function buildAppointmentActivityFeed(
  auditRows: AuditRow[],
  comments: AppointmentCommentRow[],
  staffNames: Map<string, string>
): AppointmentActivityItem[] {
  const items: AppointmentActivityItem[] = []

  for (const row of auditRows) {
    if (row.action === 'insert') continue
    items.push({
      id: row.id,
      kind: 'audit',
      created_at: row.created_at,
      text: formatAuditRowText(row, staffNames),
    })
  }

  for (const c of comments) {
    const author = staffNames.get(c.author_id) ?? staffNameFromRow(c.staff)
    items.push({
      id: c.id,
      kind: 'comment',
      created_at: c.created_at,
      author_name: author,
      text: tipTapContentToPlainText(c.content, 120) || 'Comentario',
      content: c.content,
    })
  }

  items.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return items
}

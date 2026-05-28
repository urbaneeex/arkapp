import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  describeAppointmentAuditChangePhrases,
  mergeAuditPhraseGroups,
  type AppointmentActivityNameContext,
  type AppointmentAuditRowInput,
} from '@/lib/work-board/describeAppointmentAuditChanges'
import type {
  AppointmentActivityItem,
  AppointmentCommentRow,
} from '@/lib/work-board/appointmentActivityTypes'
import { tipTapContentToPlainText } from '@/lib/work-board/tiptapContent'

const AUDIT_GROUP_WINDOW_MS = 5000

type AuditRow = AppointmentAuditRowInput & {
  id: string
  created_at: string
}

function staffNameFromRow(staff: AppointmentCommentRow['staff']): string {
  if (!staff) return 'Usuario'
  const one = Array.isArray(staff) ? staff[0] : staff
  return (one?.name ?? '').trim() || 'Usuario'
}

export function formatActivityTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, "d MMM 'a las' HH:mm", { locale: es })
}

type AuditGroup = {
  id: string
  actor_id: string
  created_at: string
  phraseGroups: string[][]
}

function flushAuditGroup(group: AuditGroup | null, ctx: AppointmentActivityNameContext): AppointmentActivityItem | null {
  if (!group) return null
  const text = mergeAuditPhraseGroups(group.phraseGroups, group.actor_id, ctx.staffNames)
  if (!text) return null
  return {
    id: group.id,
    kind: 'audit',
    created_at: group.created_at,
    text,
  }
}

function groupAuditRows(rows: AuditRow[], ctx: AppointmentActivityNameContext): AppointmentActivityItem[] {
  const items: AppointmentActivityItem[] = []
  let current: AuditGroup | null = null

  for (const row of rows) {
    if (!row.actor_id) continue

    const phrases = describeAppointmentAuditChangePhrases(row, ctx)
    if (phrases.length === 0) continue

    const rowTime = new Date(row.created_at).getTime()
    const canMerge =
      current &&
      current.actor_id === row.actor_id &&
      row.action !== 'insert' &&
      row.action !== 'delete' &&
      !Number.isNaN(rowTime) &&
      rowTime - new Date(current.created_at).getTime() <= AUDIT_GROUP_WINDOW_MS

    if (canMerge && current) {
      current.phraseGroups.push(phrases)
      current.created_at = row.created_at
      continue
    }

    const flushed = flushAuditGroup(current, ctx)
    if (flushed) items.push(flushed)

    current = {
      id: row.id,
      actor_id: row.actor_id,
      created_at: row.created_at,
      phraseGroups: [phrases],
    }
  }

  const last = flushAuditGroup(current, ctx)
  if (last) items.push(last)

  return items
}

export function buildAppointmentActivityFeed(
  auditRows: AuditRow[],
  comments: AppointmentCommentRow[],
  ctx: AppointmentActivityNameContext
): AppointmentActivityItem[] {
  const auditItems = groupAuditRows(auditRows, ctx)

  const commentItems: AppointmentActivityItem[] = comments.map((c) => {
    const author = ctx.staffNames.get(c.author_id) ?? staffNameFromRow(c.staff)
    return {
      id: c.id,
      kind: 'comment',
      created_at: c.created_at,
      author_name: author,
      text: tipTapContentToPlainText(c.content, 120) || 'Comentario',
      content: c.content,
    }
  })

  const items = [...auditItems, ...commentItems]
  items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return items
}

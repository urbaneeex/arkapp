import type { Json } from '@/types/database.types'

export type AppointmentActivityItem = {
  id: string
  kind: 'audit' | 'comment'
  created_at: string
  /** Línea corta para eventos de sistema */
  text?: string
  author_name?: string
  /** Documento TipTap (solo comentarios) */
  content?: Json
}

export type AppointmentCommentRow = {
  id: string
  appointment_id: string
  business_id: string
  author_id: string
  content: Json
  created_at: string
  staff?: { name: string | null } | { name: string | null }[] | null
}

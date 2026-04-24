import type { WorkBoardStaffOption } from '@/lib/work-items/types'

/** Campo del formulario de edición (navegación legacy; el Kanban usa edición en popover). */
export type WorkBoardCardFieldFocus =
  | 'schedule'
  | 'staff'
  | 'priority'
  | 'client'
  | 'service'

export type WorkBoardKanbanClientOption = {
  id: string
  name: string
  phone?: string | null
  email?: string | null
}

export type WorkBoardCardQuickEditContext = {
  businessId: string
  currentUserId: string
  staffOptions: WorkBoardStaffOption[]
  services: { id: string; name: string; duration: number; price: number }[]
  clients: WorkBoardKanbanClientOption[]
  onUpdated: () => void
}

export const WORK_BOARD_KANBAN_CHIP_CLASS =
  'inline-flex max-w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-600/80 bg-zinc-900/80 px-2 py-1.5 font-medium text-zinc-300 shadow-sm transition-colors hover:border-zinc-500 hover:bg-zinc-800/90'

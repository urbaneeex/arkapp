import type { KanbanScope } from '@/lib/work-board/kanbanScope'
import type { WorkItemCard } from '@/lib/work-items/types'

export type KanbanScopeFilterOpts = {
  canTasksViewAll: boolean
  currentUserId: string
  /** Equipos donde el usuario es miembro (para ámbito «Mi equipo»). */
  myTeamIds: string[]
}

/** Filtra tarjetas Kanban según pestaña Mis / Equipo / Todo (datos ya cargados). */
export function filterKanbanItemsByScope(
  items: WorkItemCard[],
  scope: KanbanScope,
  opts: KanbanScopeFilterOpts
): WorkItemCard[] {
  if (!opts.canTasksViewAll) return items

  switch (scope) {
    case 'todo':
      return items
    case 'mis':
      return items.filter(
        (i) =>
          i.staff_id === opts.currentUserId ||
          i.created_by === opts.currentUserId
      )
    case 'equipo': {
      const teamSet = new Set(opts.myTeamIds)
      if (teamSet.size === 0) return []
      return items.filter((i) => {
        if (i.team_id && teamSet.has(i.team_id)) return true
        const ids = i.team_ids
        if (!ids?.length) return false
        return ids.some((tid) => teamSet.has(tid))
      })
    }
    default:
      return items
  }
}

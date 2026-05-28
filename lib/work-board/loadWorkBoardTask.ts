import { createClient } from '@/lib/supabase/server'
import {
  mapAppointmentRowsToWorkItems,
  type AppointmentRowInput,
} from '@/lib/work-items/mapAppointmentRow'
import { ensurePipelineStagesForBusiness, normalizeStageCategoryRow } from '@/lib/work-items/seedPipelineStages'
import type { PipelineStageRow, WorkBoardStaffOption, WorkItemCard } from '@/lib/work-items/types'
import { userCanAccessAppointmentClient } from '@/lib/work-board/appointmentParticipation'
import { APPOINTMENTS_SELECT_SLIM } from '@/lib/work-board/loadWorkBoardBootstrap'

export type WorkBoardTaskPayload = {
  businessId: string
  currentUserId: string
  item: WorkItemCard
  initialStages: PipelineStageRow[]
  initialStaffOptions: WorkBoardStaffOption[]
  teamsForKanban: { id: string; name: string; color: string }[]
  myTeamIds: string[]
}

export async function fetchWorkBoardTaskPayload(
  userId: string,
  businessId: string,
  taskId: string
): Promise<WorkBoardTaskPayload | null> {
  const supabase = await createClient()

  const [
    ,
    { data: teamRows },
    { data: teamMemberRows },
    { data: appointmentRow, error: appointmentError },
    { data: stages },
    { data: staffRows },
  ] = await Promise.all([
    ensurePipelineStagesForBusiness(supabase, businessId),
    supabase.from('teams').select('id, name, color').eq('business_id', businessId).order('name'),
    supabase.from('team_members').select('team_id').eq('staff_id', userId),
    supabase
      .from('appointments')
      .select(APPOINTMENTS_SELECT_SLIM)
      .eq('business_id', businessId)
      .eq('id', taskId)
      .is('archived_at', null)
      .maybeSingle(),
    supabase
      .from('pipeline_stages')
      .select('id, business_id, slug, label, sort_order, color, stage_category')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('staff')
      .select('id, name, email, color')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
  ])

  if (appointmentError || !appointmentRow) return null

  const myTeamIds = (teamMemberRows ?? []).map((r) => r.team_id).filter(Boolean) as string[]
  const rowsTyped = [appointmentRow] as unknown as AppointmentRowInput[]
  const [item] = mapAppointmentRowsToWorkItems(rowsTyped)
  if (!item) return null

  if (!userCanAccessAppointmentClient(item, userId, businessId)) return null

  const initialStages: PipelineStageRow[] = (stages ?? []).map((row) => {
    const r = row as {
      id: string
      business_id: string
      slug: string
      label: string
      sort_order: number
      color: string | null
      stage_category?: string | null
    }
    return {
      id: r.id,
      business_id: r.business_id,
      slug: r.slug,
      label: r.label,
      sort_order: r.sort_order,
      color: r.color?.trim() || '#6366f1',
      stage_category: normalizeStageCategoryRow(r.slug, r.stage_category),
    }
  })

  return {
    businessId,
    currentUserId: userId,
    item,
    initialStages,
    initialStaffOptions: (staffRows ?? []) as WorkBoardStaffOption[],
    teamsForKanban: (teamRows ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),
    myTeamIds,
  }
}

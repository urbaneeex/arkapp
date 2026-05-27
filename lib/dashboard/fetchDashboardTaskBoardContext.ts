import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeStageCategoryRow } from '@/lib/work-items/seedPipelineStages'
import type { DashboardTaskBoardContext } from '@/lib/dashboard/dashboardTypes'
import type { PipelineStageRow, WorkBoardStaffOption } from '@/lib/work-items/types'

export async function fetchDashboardTaskBoardContext(
  supabase: SupabaseClient,
  businessId: string,
  userId: string
): Promise<DashboardTaskBoardContext> {
  const [{ data: stages }, { data: staffRows }, { data: teamRows }, { data: teamMemberRows }] =
    await Promise.all([
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
      supabase.from('teams').select('id, name, color').eq('business_id', businessId).order('name'),
      supabase.from('team_members').select('team_id').eq('staff_id', userId),
    ])

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
    initialStages,
    initialStaffOptions: (staffRows ?? []) as WorkBoardStaffOption[],
    teamsForKanban: (teamRows ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),
    myTeamIds: (teamMemberRows ?? []).map((r) => r.team_id).filter(Boolean) as string[],
  }
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessIdForUser } from '@/lib/supabase/business'
import { WorkBoardPageClient } from '@/components/work-board/WorkBoardPageClient'
import { mapAppointmentRowToWorkItem, type AppointmentRowInput } from '@/lib/work-items/mapAppointmentRow'
import type { PipelineStageRow, WorkBoardStaffOption } from '@/lib/work-items/types'

export default async function WorkBoardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const businessId = await getBusinessIdForUser(user.id)
  if (!businessId) redirect('/dashboard')

  const [{ data: stages }, { data: appointments }, { data: staffRows }] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('id, business_id, slug, label, sort_order')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('appointments')
      .select(
        `
        id,
        business_id,
        title,
        start_time,
        end_time,
        status,
        price_total,
        client_id,
        service_id,
        staff_id,
        pipeline_stage_id,
        clients(name, phone),
        services(name, duration, price),
        staff(name),
        pipeline_stages(id, slug, label, sort_order)
      `
      )
      .eq('business_id', businessId)
      .order('start_time', { ascending: true }),
    supabase
      .from('staff')
      .select('id, name, email, color')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
  ])

  const stageRows = (stages ?? []) as PipelineStageRow[]
  const cards = (appointments ?? []).map((row) =>
    mapAppointmentRowToWorkItem(row as unknown as AppointmentRowInput)
  )
  const staffOptions = (staffRows ?? []) as WorkBoardStaffOption[]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkBoardPageClient
        businessId={businessId}
        currentUserId={user.id}
        initialStages={stageRows}
        initialItems={cards}
        initialStaffOptions={staffOptions}
      />
    </div>
  )
}

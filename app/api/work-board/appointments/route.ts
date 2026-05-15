import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'
import type { Database } from '@/types/database.types'

type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']

export const runtime = 'nodejs'

/**
 * Crear tarea/cita desde el tablero con sesión de servidor (cookies).
 * Checklist seguridad §11: getUser, businessId verificado, errores genéricos al cliente.
 */
const BodySchema = z.object({
  business_id: z.string().uuid(),
  title: z.string().min(1).max(2000),
  pipeline_stage_id: z.string().uuid().nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  staff_id: z.string().uuid().nullable().optional(),
  price_total: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.literal('confirmed').optional(),
  visibility: z.enum(['personal', 'team', 'business']),
  team_id: z.string().uuid().nullable().optional(),
  team_ids_for_bridge: z.array(z.string().uuid()).optional().default([]),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const access = await resolveUserBusinessAndPermissions(user.id)
  if (!access || !hasServerPermission(access, 'work_board_view')) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  const body = parsed.data
  if (body.business_id !== access.businessId) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  let stageId = body.pipeline_stage_id ?? null
  if (!stageId) {
    const { data: firstStage, error: firstStageErr } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('business_id', access.businessId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (firstStageErr) {
      console.error('[work-board/appointments POST] default stage', firstStageErr)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    stageId = firstStage?.id ?? null
    if (!stageId) {
      return NextResponse.json({ error: 'Configura al menos una columna en el tablero' }, { status: 400 })
    }
  } else {
    const { data: st } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('id', stageId)
      .eq('business_id', access.businessId)
      .maybeSingle()
    if (!st) {
      return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
    }
  }

  const teamId = body.team_id ?? null
  if (teamId) {
    const { data: tm } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('business_id', access.businessId)
      .maybeSingle()
    if (!tm) {
      return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
    }
  }

  const bridgeIds = body.team_ids_for_bridge ?? []
  if (bridgeIds.length > 0) {
    const { data: teamRows, error: teamCountErr } = await supabase
      .from('teams')
      .select('id')
      .eq('business_id', access.businessId)
      .in('id', bridgeIds)
    if (teamCountErr || !teamRows || teamRows.length !== bridgeIds.length) {
      return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
    }
  }

  if (body.client_id) {
    const { data: cl } = await supabase
      .from('clients')
      .select('id')
      .eq('id', body.client_id)
      .eq('business_id', access.businessId)
      .maybeSingle()
    if (!cl) {
      return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
    }
  }

  if (body.service_id) {
    const { data: sv } = await supabase
      .from('services')
      .select('id')
      .eq('id', body.service_id)
      .eq('business_id', access.businessId)
      .maybeSingle()
    if (!sv) {
      return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
    }
  }

  if (body.staff_id) {
    const { data: stf } = await supabase
      .from('staff')
      .select('id')
      .eq('id', body.staff_id)
      .eq('business_id', access.businessId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!stf) {
      return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
    }
  }

  let admin: ReturnType<typeof createServiceRoleClient>
  try {
    admin = createServiceRoleClient()
  } catch (e) {
    console.error('[work-board/appointments POST] service role', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  let nextBoardSort: number | undefined
  if (stageId) {
    const { data: maxRows, error: maxErr } = await admin
      .from('appointments')
      .select('board_sort_order')
      .eq('business_id', access.businessId)
      .eq('pipeline_stage_id', stageId)
      .order('board_sort_order', { ascending: false, nullsFirst: false })
      .limit(1)
    if (maxErr) {
      console.error('[work-board/appointments POST] board_sort_order', maxErr)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    const max = maxRows?.[0]?.board_sort_order
    nextBoardSort = typeof max === 'number' && !Number.isNaN(max) ? max + 1 : 0
  }

  const insertRow = {
    business_id: access.businessId,
    title: body.title.trim(),
    start_time: body.start_time ?? null,
    end_time: body.end_time ?? null,
    client_id: body.client_id ?? null,
    service_id: body.service_id ?? null,
    staff_id: body.staff_id ?? null,
    price_total: body.price_total ?? null,
    metadata: (body.metadata ?? null) as AppointmentInsert['metadata'],
    status: (body.status ?? 'confirmed') as AppointmentInsert['status'],
    visibility: body.visibility,
    team_id: teamId,
    created_by: user.id,
    ...(stageId
      ? {
          pipeline_stage_id: stageId,
          ...(nextBoardSort !== undefined ? { board_sort_order: nextBoardSort } : {}),
        }
      : {}),
  } as AppointmentInsert

  const { data: inserted, error: insErr } = await admin.from('appointments').insert(insertRow)
    .select('id')
    .maybeSingle()

  if (insErr || !inserted?.id) {
    console.error('[work-board/appointments POST] insert', insErr)
    return NextResponse.json({ error: 'No se pudo crear la tarea' }, { status: 500 })
  }

  const appointmentId = inserted.id

  if (body.visibility === 'team' && bridgeIds.length > 0) {
    const { error: bridgeErr } = await admin.from('appointment_teams').insert(
      bridgeIds.map((tid) => ({
        appointment_id: appointmentId,
        team_id: tid,
      }))
    )
    if (bridgeErr) {
      console.error('[work-board/appointments POST] appointment_teams', bridgeErr)
      await admin.from('appointments').delete().eq('id', appointmentId).eq('business_id', access.businessId)
      return NextResponse.json({ error: 'No se pudo crear la tarea' }, { status: 500 })
    }
  }

  return NextResponse.json({ id: appointmentId })
}

import { createClient } from '@/lib/supabase/server'
import { getBusinessForUser } from '@/lib/supabase/business'
import { DEFAULT_MATRIX, PERMISSION_LEVEL_IDS, type LevelId } from '@/lib/permissions'
import type { ActionIconKey, PendingAction } from '@/components/dashboard/PendingActionsCard'
import { WORK_BOARD_CALENDAR_PATH } from '@/lib/routes'
import {
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'

/** Coincide con lucide usados en tarjetas KPI (cliente mapea a icono). */
export type DashboardStatIconKey =
  | 'calendar'
  | 'clock'
  | 'users'
  | 'dollar'
  | 'trending'
  | 'user-x'

export type DashboardBootstrapStat = {
  title: string
  value: string
  href: string
  iconKey: DashboardStatIconKey
  colorClass: string
}

export type DashboardBootstrapNextAppointment = {
  id: string
  start_time: string
  status: string | null
  clientName: string
  serviceName: string
}

export type DashboardBootstrapPayload =
  | { kind: 'no_business' }
  | {
      kind: 'ok'
      businessId: string
      pendingActions: PendingAction[]
      stats: DashboardBootstrapStat[]
      nextAppointments: DashboardBootstrapNextAppointment[]
      hasClock: boolean
      canSeeLiveClockPanel: boolean
      liveClockBetaEnabled: boolean
    }

const SIGNATURE_TYPE_SECTORS: Record<string, string> = {
  document: 'empresa',
  vacation: 'vacaciones',
  schedule: 'horario',
  time_report: 'informe',
}

const SIGNATURE_TYPE_ACTIONS: Record<string, string> = {
  document: 'Pendiente de firmar',
  vacation: 'Pendiente de firmar',
  schedule: 'Pendiente de firmar',
  time_report: 'Pendiente de firmar',
}

/**
 * Datos del Inicio (SSR + GET /api/dashboard/bootstrap). Sin redirects.
 */
export async function fetchDashboardBootstrapPayload(
  userId: string,
  userEmail: string
): Promise<DashboardBootstrapPayload> {
  const businessResult = await getBusinessForUser(userId)
  if (!businessResult) {
    return { kind: 'no_business' }
  }

  const business = businessResult.business
  const isOwner = businessResult.isOwner

  const supabase = await createClient()

  const todayStart = startOfToday().toISOString()
  const todayEnd = endOfToday().toISOString()
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
  const monthStart = startOfMonth(new Date()).toISOString()
  const monthEnd = endOfMonth(new Date()).toISOString()

  const { data: myStaff } = await supabase
    .from('staff')
    .select('id, access_level, name')
    .eq('business_id', business.id)
    .or(`id.eq.${userId},email.eq.${userEmail}`)
    .is('deleted_at', null)
    .maybeSingle()

  const myStaffId = myStaff?.id ?? userId

  const [
    { count: todayCount },
    { count: weekCount },
    { count: clientsCount },
    { data: revenueData },
    { data: monthAppointments },
    { count: noShowCount },
    { data: nextAppointmentsRaw },
    { count: pendingAbsencesCount },
    { count: pendingSignaturesOwnerCount },
    { data: myPendingSignatures },
    { data: myPendingAbsences },
    { data: myOpenEntry },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd)
      .in('status', ['pending', 'confirmed', 'in_progress']),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .gte('start_time', weekStart)
      .lte('start_time', weekEnd)
      .in('status', ['pending', 'confirmed', 'in_progress', 'completed']),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase
      .from('appointments')
      .select('price_total')
      .eq('business_id', business.id)
      .eq('status', 'completed')
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd),
    supabase
      .from('appointments')
      .select('id, status')
      .eq('business_id', business.id)
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'no_show')
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd),
    supabase
      .from('appointments')
      .select('id, start_time, end_time, status, clients(name), services(name)')
      .eq('business_id', business.id)
      .gte('start_time', todayStart)
      .in('status', ['pending', 'confirmed', 'in_progress'])
      .order('start_time', { ascending: true })
      .limit(5),
    supabase
      .from('staff_absence_requests')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'pending'),
    supabase
      .from('staff_signatures')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'pending')
      .eq('document_type', 'document'),
    supabase
      .from('staff_signatures')
      .select('id, document_type, reference_period')
      .eq('staff_id', myStaffId)
      .eq('status', 'pending'),
    supabase
      .from('staff_absence_requests')
      .select('id, type, start_date')
      .eq('staff_id', myStaffId)
      .eq('status', 'pending'),
    supabase
      .from('time_entries')
      .select('id, clock_in')
      .eq('staff_id', myStaffId)
      .gte('clock_in', todayStart)
      .is('clock_out', null)
      .maybeSingle(),
  ])

  const accessLevel = myStaff?.access_level
  const normalizedLevel: LevelId =
    typeof accessLevel === 'string' && (PERMISSION_LEVEL_IDS as readonly string[]).includes(accessLevel)
      ? (accessLevel as LevelId)
      : 'basico'
  const canSeeLiveClockPanel =
    isOwner ||
    DEFAULT_MATRIX[normalizedLevel].time_tracking_view ||
    DEFAULT_MATRIX[normalizedLevel].time_tracking_manage

  const revenue =
    revenueData?.reduce((acc, row) => acc + (row.price_total ?? 0), 0) ?? 0

  const signatureTypeCounts = (myPendingSignatures ?? []).reduce<Record<string, number>>((acc, sig) => {
    const key = sig.document_type ?? 'document'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const topSignatureTypeEntry =
    Object.entries(signatureTypeCounts).sort((a, b) => b[1] - a[1])[0] ?? null
  const topSignatureTypeKey = topSignatureTypeEntry?.[0] ?? 'document'
  const topSector = SIGNATURE_TYPE_SECTORS[topSignatureTypeKey] ?? 'empresa'
  const topAction = SIGNATURE_TYPE_ACTIONS[topSignatureTypeKey] ?? 'Firmar'

  const mySignatureIcon: ActionIconKey =
    topSignatureTypeKey === 'vacation'
      ? 'vacation'
      : topSignatureTypeKey === 'schedule'
        ? 'schedule'
        : topSignatureTypeKey === 'time_report'
          ? 'time_report'
          : 'document'

  const pendingActions: PendingAction[] = []

  const hasClock =
    isOwner ||
    DEFAULT_MATRIX[normalizedLevel].time_tracking_view ||
    DEFAULT_MATRIX[normalizedLevel].time_tracking_manage
  if (hasClock && !myOpenEntry) {
    pendingActions.push({
      id: 'clock',
      label: 'No has fichado entrada hoy',
      sublabel: 'Recuerda registrar tu jornada',
      href: '/dashboard/fichar?tab=fichar',
      icon: 'clock',
      variant: 'warning',
    })
  }

  if (isOwner || DEFAULT_MATRIX[normalizedLevel].absences_manage) {
    const absences = pendingAbsencesCount ?? 0
    pendingActions.push({
      id: 'absences',
      label:
        absences > 0
          ? `${absences} solicitud${absences !== 1 ? 'es' : ''} de ausencia pendiente${absences !== 1 ? 's' : ''}`
          : 'Sin solicitudes de ausencia pendientes',
      sublabel: absences > 0 ? 'Requiere tu aprobación' : undefined,
      href: '/dashboard/fichar?tab=aprobaciones',
      icon: 'absences',
      variant: absences > 0 ? 'warning' : 'success',
      count: absences > 0 ? absences : undefined,
    })

    const sigs = pendingSignaturesOwnerCount ?? 0
    pendingActions.push({
      id: 'sigs-owner',
      label:
        sigs > 0
          ? `${sigs} archivo${sigs !== 1 ? 's' : ''} pendiente${sigs !== 1 ? 's' : ''} de firma`
          : 'Sin archivos pendientes de firma',
      sublabel: sigs > 0 ? 'Empleados aún no han firmado' : undefined,
      href: '/dashboard/staff?tab=documentos',
      icon: 'signature',
      variant: sigs > 0 ? 'default' : 'success',
      count: sigs > 0 ? sigs : undefined,
    })
  }

  const mySigs = myPendingSignatures?.length ?? 0
  if (mySigs > 0) {
    pendingActions.push({
      id: 'my-sigs',
      label: `${mySigs} documento${mySigs !== 1 ? 's' : ''} de ${topSector}`,
      sublabel: topAction,
      href: '/dashboard/fichar?tab=documentos',
      icon: mySignatureIcon,
      variant: 'warning',
      count: mySigs,
    })
  }

  const myAbsences = myPendingAbsences?.length ?? 0
  if (myAbsences > 0) {
    pendingActions.push({
      id: 'my-absences',
      label: `${myAbsences} solicitud${myAbsences !== 1 ? 'es' : ''} de ausencia en espera`,
      sublabel: 'Pendiente de aprobación',
      href: '/dashboard/fichar?tab=solicitudes',
      icon: 'absence_own',
      variant: 'default',
      count: myAbsences,
    })
  }

  const totalMonth = monthAppointments?.length ?? 0
  const completedMonth =
    monthAppointments?.filter((a) => a.status === 'completed').length ?? 0
  const occupancyRate =
    totalMonth > 0 ? Math.round((completedMonth / totalMonth) * 100) : 0
  const noShowRate =
    totalMonth > 0 ? Math.round(((noShowCount ?? 0) / totalMonth) * 100) : 0

  const stats: DashboardBootstrapStat[] = [
    {
      title: 'Citas hoy',
      value: String(todayCount ?? 0),
      iconKey: 'calendar',
      href: WORK_BOARD_CALENDAR_PATH,
      colorClass: 'bg-brand text-white',
    },
    {
      title: 'Citas esta semana',
      value: String(weekCount ?? 0),
      iconKey: 'clock',
      href: WORK_BOARD_CALENDAR_PATH,
      colorClass: 'bg-brand text-white',
    },
    {
      title: 'Clientes activos',
      value: String(clientsCount ?? 0),
      iconKey: 'users',
      href: '/dashboard/clients',
      colorClass: 'bg-emerald-600 text-white',
    },
    {
      title: 'Ingresos del mes',
      value: new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
      }).format(revenue),
      iconKey: 'dollar',
      href: '/dashboard/finances',
      colorClass: 'bg-amber-600 text-white',
    },
    {
      title: 'Tasa de ocupación',
      value: `${occupancyRate}%`,
      iconKey: 'trending',
      href: '/dashboard/reports',
      colorClass: 'bg-violet-600 text-white',
    },
    {
      title: 'Tasa no-show',
      value: `${noShowRate}%`,
      iconKey: 'user-x',
      href: '/dashboard/reports',
      colorClass: 'bg-gray-600 text-white',
    },
  ]

  const nextAppointments: DashboardBootstrapNextAppointment[] = (nextAppointmentsRaw ?? []).map(
    (apt: {
      id: string
      start_time: string | null
      status: string | null
      clients?: unknown
      services?: unknown
    }) => {
      const clientName = Array.isArray(apt.clients)
        ? (apt.clients[0] as { name?: string })?.name
        : (apt.clients as { name?: string } | null)?.name
      const serviceName = Array.isArray(apt.services)
        ? (apt.services[0] as { name?: string })?.name
        : (apt.services as { name?: string } | null)?.name
      return {
        id: apt.id,
        start_time: apt.start_time ?? '',
        status: apt.status,
        clientName: clientName ?? 'Sin cliente',
        serviceName: serviceName ?? 'Sin servicio',
      }
    }
  )

  const liveClockBetaEnabled = process.env.NEXT_PUBLIC_DASHBOARD_LIVE_CLOCK_BETA === '1'

  return {
    kind: 'ok',
    businessId: business.id,
    pendingActions,
    stats,
    nextAppointments,
    hasClock,
    canSeeLiveClockPanel,
    liveClockBetaEnabled,
  }
}

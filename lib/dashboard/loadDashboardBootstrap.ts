import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getBusinessForUser } from '@/lib/supabase/business'
import { DEFAULT_MATRIX, PERMISSION_LEVEL_IDS, type LevelId } from '@/lib/permissions'
import type { ActionIconKey, PendingAction } from '@/components/dashboard/PendingActionsCard'
import type {
  DashboardBootstrapPayload,
  DashboardHeavyPayload,
  DashboardHeroPayload,
  DashboardMetricsPayload,
  DashboardShellPayload,
  OwnerDashboardPayload,
  StaffDashboardPayload,
} from '@/lib/dashboard/dashboardTypes'
import { startOfToday } from 'date-fns'
import { fetchOwnerDashboard, fetchOwnerHeroMetrics, fetchOwnerHeavyMetrics } from '@/lib/dashboard/fetchOwnerDashboard'
import { fetchStaffDashboard, fetchStaffHeroMetrics, fetchStaffHeavyMetrics } from '@/lib/dashboard/fetchStaffDashboard'

export type { DashboardBootstrapPayload } from '@/lib/dashboard/dashboardTypes'

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

type DashboardShellOk = Extract<DashboardShellPayload, { kind: 'ok' }>

function mergeBootstrap(
  shell: DashboardShellOk,
  metrics: DashboardMetricsPayload
): Extract<DashboardBootstrapPayload, { kind: 'ok' }> {
  return {
    kind: 'ok',
    role: shell.role,
    businessId: shell.businessId,
    pendingActions: shell.pendingActions,
    hasClock: shell.hasClock,
    canSeeLiveClockPanel: shell.canSeeLiveClockPanel,
    liveClockBetaEnabled: shell.liveClockBetaEnabled,
    ownerHome: metrics.ownerHome,
    staffHome: metrics.staffHome,
  }
}

/**
 * Shell rápido: negocio, rol, pending actions. Sin métricas pesadas.
 */
export async function fetchDashboardShell(
  userId: string,
  userEmail: string
): Promise<DashboardShellPayload> {
  const businessResult = await getBusinessForUser(userId)
  if (!businessResult) {
    return { kind: 'no_business' }
  }

  const business = businessResult.business
  const isOwner = businessResult.isOwner
  const role = isOwner ? 'owner' : 'staff'

  const supabase = await createClient()

  const { data: myStaff } = await supabase
    .from('staff')
    .select('id, access_level, name, contract_hours_per_week, vacation_days_per_year')
    .eq('business_id', business.id)
    .or(`id.eq.${userId},email.eq.${userEmail}`)
    .is('deleted_at', null)
    .maybeSingle()

  const myStaffId = myStaff?.id ?? userId

  const [
    { count: pendingAbsencesCount },
    { count: pendingSignaturesOwnerCount },
    { data: myPendingSignatures },
    { data: myPendingAbsences },
    { data: myOpenEntry },
  ] = await Promise.all([
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
      .gte('clock_in', startOfToday().toISOString())
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

  const liveClockBetaEnabled = process.env.NEXT_PUBLIC_DASHBOARD_LIVE_CLOCK_BETA === '1'

  return {
    kind: 'ok',
    role,
    businessId: business.id,
    pendingActions,
    hasClock,
    canSeeLiveClockPanel,
    liveClockBetaEnabled,
    myStaffId,
    contractHoursPerWeek: myStaff?.contract_hours_per_week ?? null,
    vacationDaysPerYear: myStaff?.vacation_days_per_year ?? null,
  }
}

/**
 * Métricas pesadas (owner/staff home). Separado del shell para streaming SSR.
 */
export async function fetchDashboardHero(
  shell: DashboardShellOk,
  userId: string,
  userEmail: string
): Promise<DashboardHeroPayload> {
  void userEmail

  if (shell.role === 'owner') {
    try {
      const ownerHero = await fetchOwnerHeroMetrics(
        shell.businessId,
        userId,
        shell.myStaffId
      )
      return { kind: 'ok', role: 'owner', ownerHero }
    } catch (e) {
      console.error('[dashboard hero] owner', e)
      return { kind: 'ok', role: 'owner' }
    }
  }

  try {
    const staffHero = await fetchStaffHeroMetrics(
      shell.businessId,
      userId,
      shell.myStaffId
    )
    return { kind: 'ok', role: 'staff', staffHero }
  } catch (e) {
    console.error('[dashboard hero] staff', e)
    return { kind: 'ok', role: 'staff' }
  }
}

export async function fetchDashboardHeavy(
  shell: DashboardShellOk,
  userId: string,
  userEmail: string
): Promise<DashboardHeavyPayload> {
  void userEmail

  if (shell.role === 'owner') {
    try {
      const ownerHeavy = await fetchOwnerHeavyMetrics(
        shell.businessId,
        userId,
        shell.myStaffId
      )
      return { kind: 'ok', role: 'owner', ownerHeavy }
    } catch (e) {
      console.error('[dashboard heavy] owner', e)
      return { kind: 'ok', role: 'owner' }
    }
  }

  try {
    const staffHeavy = await fetchStaffHeavyMetrics(
      shell.businessId,
      userId,
      shell.myStaffId,
      shell.contractHoursPerWeek,
      shell.vacationDaysPerYear
    )
    return { kind: 'ok', role: 'staff', staffHeavy }
  } catch (e) {
    console.error('[dashboard heavy] staff', e)
    return { kind: 'ok', role: 'staff' }
  }
}

export async function fetchDashboardMetrics(
  shell: DashboardShellOk,
  userId: string,
  userEmail: string
): Promise<DashboardMetricsPayload> {
  const [hero, heavy] = await Promise.all([
    fetchDashboardHero(shell, userId, userEmail),
    fetchDashboardHeavy(shell, userId, userEmail),
  ])

  if (hero.kind !== 'ok' || heavy.kind !== 'ok') return {}

  let ownerHome: OwnerDashboardPayload | undefined
  let staffHome: StaffDashboardPayload | undefined

  if (shell.role === 'owner' && hero.ownerHero && heavy.ownerHeavy) {
    const h = hero.ownerHero
    const d = heavy.ownerHeavy
    ownerHome = {
      section1: {
        tasksToday: h.tasksToday,
        clientsWeek: d.section1.clientsWeek,
        overdueTasks: d.section1.overdueTasks,
        revenueMonth: h.revenueMonth,
      },
      section2: d.section2,
      section3: d.section3,
      appointmentsWeekChart: d.appointmentsWeekChart,
      tasksTodayList: d.tasksTodayList,
    }
  } else if (shell.role === 'staff' && hero.staffHero && heavy.staffHeavy) {
    const h = hero.staffHero
    const d = heavy.staffHeavy
    staffHome = {
      section1: {
        tasksToday: h.tasksToday,
        ...d.section1,
      },
      section3: d.section3,
      section4: d.section4,
      tasksTodayList: d.tasksTodayList,
      teamAbsencesWeek: d.teamAbsencesWeek,
    }
  } else {
    try {
      if (shell.role === 'owner') {
        const admin = createServiceRoleClient()
        ownerHome = await fetchOwnerDashboard(
          admin,
          shell.businessId,
          userId,
          shell.myStaffId
        )
      } else {
        const supabase = await createClient()
        staffHome = await fetchStaffDashboard(
          supabase,
          shell.businessId,
          userId,
          shell.myStaffId,
          shell.contractHoursPerWeek,
          shell.vacationDaysPerYear
        )
      }
    } catch (e) {
      console.error('[dashboard metrics] fallback', e)
    }
  }

  return { ownerHome, staffHome }
}

export const getDashboardShellCached = cache(fetchDashboardShell)

export const getDashboardHeroCached = cache(
  async (userId: string, userEmail: string): Promise<DashboardHeroPayload> => {
    const shell = await getDashboardShellCached(userId, userEmail)
    if (shell.kind !== 'ok') return { kind: 'no_business' }
    return fetchDashboardHero(shell, userId, userEmail)
  }
)

export const getDashboardHeavyCached = cache(
  async (userId: string, userEmail: string): Promise<DashboardHeavyPayload> => {
    const shell = await getDashboardShellCached(userId, userEmail)
    if (shell.kind !== 'ok') return { kind: 'no_business' }
    return fetchDashboardHeavy(shell, userId, userEmail)
  }
)

export const getDashboardMetricsCached = cache(
  async (userId: string, userEmail: string): Promise<DashboardMetricsPayload> => {
    const shell = await getDashboardShellCached(userId, userEmail)
    if (shell.kind !== 'ok') return {}
    return fetchDashboardMetrics(shell, userId, userEmail)
  }
)

export const getDashboardBootstrapCached = cache(
  async (userId: string, userEmail: string): Promise<DashboardBootstrapPayload> => {
    const shell = await getDashboardShellCached(userId, userEmail)
    if (shell.kind !== 'ok') return shell
    const metrics = await getDashboardMetricsCached(userId, userEmail)
    return mergeBootstrap(shell, metrics)
  }
)

/**
 * Datos del Inicio (SSR + GET /api/dashboard/bootstrap). Sin redirects.
 */
export type DashboardBootstrapPart = 'shell' | 'hero' | 'heavy' | 'all'

export async function fetchDashboardBootstrapPayload(
  userId: string,
  userEmail: string,
  part: DashboardBootstrapPart = 'all'
): Promise<
  DashboardBootstrapPayload | DashboardShellPayload | DashboardHeroPayload | DashboardHeavyPayload
> {
  if (part === 'shell') return getDashboardShellCached(userId, userEmail)
  if (part === 'hero') return getDashboardHeroCached(userId, userEmail)
  if (part === 'heavy') return getDashboardHeavyCached(userId, userEmail)
  return getDashboardBootstrapCached(userId, userEmail)
}

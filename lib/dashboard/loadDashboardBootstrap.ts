import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getBusinessForUser } from '@/lib/supabase/business'
import { DEFAULT_MATRIX, PERMISSION_LEVEL_IDS, type LevelId } from '@/lib/permissions'
import type { ActionIconKey, PendingAction } from '@/components/dashboard/PendingActionsCard'
import type {
  DashboardBootstrapPayload,
  OwnerDashboardPayload,
  StaffDashboardPayload,
} from '@/lib/dashboard/dashboardTypes'
import { startOfToday } from 'date-fns'
import { fetchOwnerDashboard } from '@/lib/dashboard/fetchOwnerDashboard'
import { fetchStaffDashboard } from '@/lib/dashboard/fetchStaffDashboard'

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

  let ownerHome: OwnerDashboardPayload | undefined
  let staffHome: StaffDashboardPayload | undefined

  if (isOwner) {
    try {
      const admin = createServiceRoleClient()
      ownerHome = await fetchOwnerDashboard(
        admin,
        business.id,
        userId,
        myStaff?.id ?? userId
      )
    } catch (e) {
      console.error('[dashboard bootstrap] owner home', e)
    }
  } else {
    staffHome = await fetchStaffDashboard(
      supabase,
      business.id,
      myStaffId,
      myStaff?.contract_hours_per_week ?? null,
      myStaff?.vacation_days_per_year ?? null
    )
  }

  return {
    kind: 'ok',
    role,
    businessId: business.id,
    pendingActions,
    hasClock,
    canSeeLiveClockPanel,
    liveClockBetaEnabled,
    ownerHome,
    staffHome,
  }
}

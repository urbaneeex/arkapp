import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCachedUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessForUser } from '@/lib/supabase/business'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  UserX,
  Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LiveClockPanel } from '@/components/dashboard/LiveClockPanel'
import { PendingActionsCard, type ActionIconKey } from '@/components/dashboard/PendingActionsCard'
import { DEFAULT_MATRIX, PERMISSION_LEVEL_IDS, type LevelId } from '@/lib/permissions'
import {
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata: Metadata = {
  title: 'Inicio',
}

/** Sector label used in "N documento(s) de [sector]" */
const SIGNATURE_TYPE_SECTORS: Record<string, string> = {
  document:    'empresa',
  vacation:    'vacaciones',
  schedule:    'horario',
  time_report: 'informe',
}

/** Subtitle action for each document type */
const SIGNATURE_TYPE_ACTIONS: Record<string, string> = {
  document:    'Pendiente de firmar',
  vacation:    'Pendiente de firmar',
  schedule:    'Pendiente de firmar',
  time_report: 'Pendiente de firmar',
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-zinc-900 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-lg bg-zinc-900 animate-pulse" />
        <div className="h-64 rounded-lg bg-zinc-900 animate-pulse" />
      </div>
    </>
  )
}

// ─── Dashboard content (streamed) ────────────────────────────────────────────

async function DashboardContent({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const businessResult = await getBusinessForUser(userId)
  if (!businessResult) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-950/50 p-6 text-amber-200">
        <p className="font-medium">No tienes un negocio configurado</p>
        <p className="mt-1 text-sm">
          Contacta al administrador para asociar tu cuenta a un negocio.
        </p>
      </div>
    )
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

  // myStaff primero (necesitamos su id para las queries personales)
  const { data: myStaff } = await supabase
    .from('staff')
    .select('id, access_level, name')
    .eq('business_id', business.id)
    .or(`id.eq.${userId},email.eq.${userEmail}`)
    .is('deleted_at', null)
    .maybeSingle()

  const myStaffId = myStaff?.id ?? userId

  // Todas las demás queries en paralelo
  const [
    { count: todayCount },
    { count: weekCount },
    { count: clientsCount },
    { data: revenueData },
    { data: monthAppointments },
    { count: noShowCount },
    { data: nextAppointments },
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

  type ActionItem = Parameters<typeof PendingActionsCard>[0]['actions'][number]
  const pendingActions: ActionItem[] = []

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
      icon: 'clock' as ActionIconKey,
      variant: 'warning',
    })
  }

  if (isOwner || DEFAULT_MATRIX[normalizedLevel].absences_manage) {
    const absences = pendingAbsencesCount ?? 0
    pendingActions.push({
      id: 'absences',
      label: absences > 0
        ? `${absences} solicitud${absences !== 1 ? 'es' : ''} de ausencia pendiente${absences !== 1 ? 's' : ''}`
        : 'Sin solicitudes de ausencia pendientes',
      sublabel: absences > 0 ? 'Requiere tu aprobación' : undefined,
      href: '/dashboard/fichar?tab=aprobaciones',
      icon: 'absences' as ActionIconKey,
      variant: absences > 0 ? 'warning' : 'success',
      count: absences > 0 ? absences : undefined,
    })

    const sigs = pendingSignaturesOwnerCount ?? 0
    pendingActions.push({
      id: 'sigs-owner',
      label: sigs > 0
        ? `${sigs} archivo${sigs !== 1 ? 's' : ''} pendiente${sigs !== 1 ? 's' : ''} de firma`
        : 'Sin archivos pendientes de firma',
      sublabel: sigs > 0 ? 'Empleados aún no han firmado' : undefined,
      href: '/dashboard/staff?tab=documentos',
      icon: 'signature' as ActionIconKey,
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
      icon: 'absence_own' as ActionIconKey,
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

  const stats = [
    {
      title: 'Citas hoy',
      value: todayCount ?? 0,
      icon: Calendar,
      href: '/dashboard/calendar',
      color: 'bg-brand text-white',
    },
    {
      title: 'Citas esta semana',
      value: weekCount ?? 0,
      icon: Clock,
      href: '/dashboard/calendar',
      color: 'bg-brand text-white',
    },
    {
      title: 'Clientes activos',
      value: clientsCount ?? 0,
      icon: Users,
      href: '/dashboard/clients',
      color: 'bg-emerald-600 text-white',
    },
    {
      title: 'Ingresos del mes',
      value: new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
      }).format(revenue),
      icon: DollarSign,
      href: '/dashboard/finances',
      color: 'bg-amber-600 text-white',
    },
    {
      title: 'Tasa de ocupación',
      value: `${occupancyRate}%`,
      icon: TrendingUp,
      href: '/dashboard/reports',
      color: 'bg-violet-600 text-white',
    },
    {
      title: 'Tasa no-show',
      value: `${noShowRate}%`,
      icon: UserX,
      href: '/dashboard/reports',
      color: 'bg-gray-600 text-white',
    },
  ]

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {stats.map(({ title, value, icon: Icon, href, color }) => (
          <Link key={title} href={href} className="cursor-pointer">
            <Card className="h-32 p-6 hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  {title}
                </CardTitle>
                <div className={`rounded-lg p-2 shrink-0 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-2 flex-1 flex items-end">
                <div className="text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximas citas</CardTitle>
          </CardHeader>
          <CardContent>
            {nextAppointments && nextAppointments.length > 0 ? (
              <ul className="space-y-3">
                {nextAppointments.map((apt: any) => {
                  const clientName = Array.isArray(apt.clients)
                    ? apt.clients[0]?.name
                    : apt.clients?.name
                  const serviceName = Array.isArray(apt.services)
                    ? apt.services[0]?.name
                    : apt.services?.name
                  return (
                    <li key={apt.id}>
                      <Link
                        href={`/dashboard/appointments/${apt.id}/edit`}
                        className="cursor-pointer flex items-center justify-between rounded-lg border border-zinc-800 p-3 hover:bg-zinc-950"
                      >
                        <div>
                          <p className="font-medium text-zinc-100">
                            {clientName ?? 'Sin cliente'}
                          </p>
                          <p className="text-sm text-zinc-400">
                            {serviceName ?? 'Sin servicio'} ·{' '}
                            {format(
                              new Date(apt.start_time),
                              'HH:mm',
                              { locale: es }
                            )}
                          </p>
                        </div>
                        <Badge variant={apt.status as any}>
                          {apt.status}
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400 py-4">
                No hay citas programadas para hoy.
              </p>
            )}
            <Link
              href="/dashboard/calendar"
              className="mt-4 inline-block text-sm font-medium text-brand hover:underline cursor-pointer"
            >
              Ver calendario →
            </Link>
          </CardContent>
        </Card>

        <PendingActionsCard actions={pendingActions} hasClock={hasClock} />
      </div>

      {canSeeLiveClockPanel && (
        <div className="mt-6">
          <LiveClockPanel businessId={business.id} />
        </div>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  // Nombre desde auth metadata — disponible sin RTT extra
  const authDisplayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split('@')[0]?.trim() ||
    'Usuario'

  return (
    <div>
      {/* Renderiza instantáneamente sin esperar datos */}
      <PageHeader title={`Hola, ${authDisplayName}`} className="mb-8" />

      {/* Los datos streaman en cuanto la DB responde */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent userId={user.id} userEmail={user.email ?? ''} />
      </Suspense>
    </div>
  )
}

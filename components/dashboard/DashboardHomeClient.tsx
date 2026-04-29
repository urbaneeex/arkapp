'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  UserX,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PendingActionsCard } from '@/components/dashboard/PendingActionsCard'
import { WORK_BOARD_CALENDAR_PATH } from '@/lib/routes'
import type { DashboardBootstrapPayload, DashboardStatIconKey } from '@/lib/dashboard/loadDashboardBootstrap'

const STAT_ICONS: Record<DashboardStatIconKey, LucideIcon> = {
  calendar: Calendar,
  clock: Clock,
  users: Users,
  dollar: DollarSign,
  trending: TrendingUp,
  'user-x': UserX,
}

const LiveClockPanelBeta = dynamic(
  () =>
    import('@/components/dashboard/beta/LiveClockPanel').then((m) => m.LiveClockPanel),
  {
    loading: () => (
      <div
        className="mt-6 h-40 w-full animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40"
        aria-hidden
      />
    ),
  }
)

export function DashboardHomeClient({ data }: { data: DashboardBootstrapPayload }) {
  if (data.kind === 'no_business') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-950/50 p-6 text-amber-200">
        <p className="font-medium">No tienes un negocio configurado</p>
        <p className="mt-1 text-sm">
          Contacta al administrador para asociar tu cuenta a un negocio.
        </p>
      </div>
    )
  }

  const {
    businessId,
    pendingActions,
    stats,
    nextAppointments,
    hasClock,
    canSeeLiveClockPanel,
    liveClockBetaEnabled,
  } = data

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        {stats.map(({ title, value, iconKey, href, colorClass }) => {
          const Icon = STAT_ICONS[iconKey]
          return (
            <Link key={title} href={href} className="cursor-pointer">
              <Card className="flex h-32 flex-col p-6 transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between p-0 pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
                  <div className={`shrink-0 rounded-lg p-2 ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 items-end p-0 pt-2">
                  <div className="text-2xl font-bold">{value}</div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximas citas</CardTitle>
          </CardHeader>
          <CardContent>
            {nextAppointments.length > 0 ? (
              <ul className="space-y-3">
                {nextAppointments.map((apt) => (
                  <li key={apt.id}>
                    <Link
                      href={`/dashboard/appointments/${apt.id}/edit`}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 p-3 hover:bg-zinc-950"
                    >
                      <div>
                        <p className="font-medium text-zinc-100">{apt.clientName}</p>
                        <p className="text-sm text-zinc-400">
                          {apt.serviceName} ·{' '}
                          {apt.start_time
                            ? format(new Date(apt.start_time), 'HH:mm', { locale: es })
                            : '—'}
                        </p>
                      </div>
                      <Badge variant={apt.status as never}>{apt.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-zinc-400">No hay citas programadas para hoy.</p>
            )}
            <Link
              href={WORK_BOARD_CALENDAR_PATH}
              className="mt-4 inline-block cursor-pointer text-sm font-medium text-brand hover:underline"
            >
              Ver calendario →
            </Link>
          </CardContent>
        </Card>

        <PendingActionsCard actions={pendingActions} hasClock={hasClock} />
      </div>

      {liveClockBetaEnabled && canSeeLiveClockPanel && (
        <div className="mt-6">
          <LiveClockPanelBeta businessId={businessId} />
        </div>
      )}
    </>
  )
}

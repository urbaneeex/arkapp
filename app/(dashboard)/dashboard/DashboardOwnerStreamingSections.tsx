import { Suspense } from 'react'
import {
  OwnerDashboardRowOneShell,
  OwnerSecondaryRow,
  OwnerTasksTodayListColumn,
  OwnerTasksTodayNumber,
  OwnerWeekChartColumn,
} from '@/components/dashboard/DashboardOwnerSections'
import { DashboardMiniMetric } from '@/components/dashboard/blocks/DashboardMiniMetric'
import {
  getDashboardHeavyCached,
  getDashboardHeroCached,
} from '@/lib/dashboard/loadDashboardBootstrap'
import {
  OwnerMiniMetricSkeleton,
  OwnerTasksListInlineSkeleton,
  OwnerTasksNumberSkeleton,
  OwnerWeekChartSkeleton,
  OwnerSecondaryRowSkeleton,
} from '@/components/dashboard/DashboardPageSkeleton'

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

async function OwnerTasksNumberSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const hero = await getDashboardHeroCached(userId, userEmail)
  if (hero.kind !== 'ok' || !hero.ownerHero) {
    return <OwnerTasksTodayNumber tasks={null} />
  }
  return <OwnerTasksTodayNumber tasks={hero.ownerHero.tasksToday} />
}

async function OwnerTasksListSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  if (heavy.kind !== 'ok' || !heavy.ownerHeavy) {
    return <OwnerTasksTodayListColumn tasksTodayList={{ items: [], moreCount: 0 }} />
  }
  return <OwnerTasksTodayListColumn tasksTodayList={heavy.ownerHeavy.tasksTodayList} />
}

async function OwnerClientsMetric({ userId, userEmail }: { userId: string; userEmail: string }) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  const v =
    heavy.kind === 'ok' && heavy.ownerHeavy?.section1.clientsWeek != null
      ? String(heavy.ownerHeavy.section1.clientsWeek.thisWeek)
      : '--'
  return <DashboardMiniMetric centered valueSize="large" label="Nuevos clientes" value={v} />
}

async function OwnerOverdueMetric({ userId, userEmail }: { userId: string; userEmail: string }) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  const v =
    heavy.kind === 'ok' && heavy.ownerHeavy?.section1.overdueTasks != null
      ? String(heavy.ownerHeavy.section1.overdueTasks)
      : '--'
  return (
    <DashboardMiniMetric
      centered
      valueSize="large"
      label="Tareas vencidas"
      value={v}
      highlight="danger"
    />
  )
}

async function OwnerUnassignedMetric({ userId, userEmail }: { userId: string; userEmail: string }) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  const unassigned = heavy.kind === 'ok' ? heavy.ownerHeavy?.section2.unassigned : null
  return (
    <DashboardMiniMetric
      centered
      valueSize="large"
      label="Sin asignar"
      value={unassigned != null ? String(unassigned.total) : '--'}
      highlight={unassigned != null && unassigned.olderThan24h > 0 ? 'amber' : undefined}
    />
  )
}

async function OwnerRevenueMetric({ userId, userEmail }: { userId: string; userEmail: string }) {
  const hero = await getDashboardHeroCached(userId, userEmail)
  const revenue = hero.kind === 'ok' ? hero.ownerHero?.revenueMonth : null
  const value =
    revenue == null ? '--' : revenue.available ? fmtEur(revenue.amount) : '—'
  return (
    <DashboardMiniMetric centered valueSize="large" label="Facturado mes" value={value} />
  )
}

function OwnerWeekMetricsSlot({ userId, userEmail }: { userId: string; userEmail: string }) {
  return (
    <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3">
      <Suspense fallback={<OwnerMiniMetricSkeleton />}>
        <OwnerClientsMetric userId={userId} userEmail={userEmail} />
      </Suspense>
      <Suspense fallback={<OwnerMiniMetricSkeleton />}>
        <OwnerOverdueMetric userId={userId} userEmail={userEmail} />
      </Suspense>
      <Suspense fallback={<OwnerMiniMetricSkeleton />}>
        <OwnerUnassignedMetric userId={userId} userEmail={userEmail} />
      </Suspense>
      <Suspense fallback={<OwnerMiniMetricSkeleton />}>
        <OwnerRevenueMetric userId={userId} userEmail={userEmail} />
      </Suspense>
    </div>
  )
}

async function OwnerWeekChartSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  if (heavy.kind !== 'ok' || !heavy.ownerHeavy) {
    return <OwnerWeekChartColumn appointmentsWeekChart={null} />
  }
  return <OwnerWeekChartColumn appointmentsWeekChart={heavy.ownerHeavy.appointmentsWeekChart} />
}

async function OwnerSecondarySection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  if (heavy.kind !== 'ok' || !heavy.ownerHeavy) return null
  const d = heavy.ownerHeavy
  return <OwnerSecondaryRow section2={d.section2} section3={d.section3} />
}

export function DashboardOwnerStreamingSections({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  return (
    <div className="space-y-3 md:space-y-4">
      <OwnerDashboardRowOneShell
        tasksNumber={
          <Suspense fallback={<OwnerTasksNumberSkeleton />}>
            <OwnerTasksNumberSection userId={userId} userEmail={userEmail} />
          </Suspense>
        }
        tasksList={
          <Suspense fallback={<OwnerTasksListInlineSkeleton />}>
            <OwnerTasksListSection userId={userId} userEmail={userEmail} />
          </Suspense>
        }
        weekMetrics={<OwnerWeekMetricsSlot userId={userId} userEmail={userEmail} />}
        weekChart={
          <Suspense fallback={<OwnerWeekChartSkeleton />}>
            <OwnerWeekChartSection userId={userId} userEmail={userEmail} />
          </Suspense>
        }
      />

      <Suspense fallback={<OwnerSecondaryRowSkeleton />}>
        <OwnerSecondarySection userId={userId} userEmail={userEmail} />
      </Suspense>
    </div>
  )
}

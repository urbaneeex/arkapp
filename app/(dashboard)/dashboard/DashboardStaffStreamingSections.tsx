import { Suspense } from 'react'
import { DashboardMiniMetric } from '@/components/dashboard/blocks/DashboardMiniMetric'
import {
  StaffDashboardRowOneShell,
  StaffSecondaryRows,
  StaffTasksTodayListColumn,
  StaffTasksTodayNumber,
} from '@/components/dashboard/DashboardStaffSections'
import {
  getDashboardHeavyCached,
  getDashboardHeroCached,
} from '@/lib/dashboard/loadDashboardBootstrap'
import {
  OwnerMiniMetricSkeleton,
  OwnerTasksListInlineSkeleton,
  OwnerTasksNumberSkeleton,
  StaffSecondaryRowsSkeleton,
} from '@/components/dashboard/DashboardPageSkeleton'

async function StaffTasksNumberSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const hero = await getDashboardHeroCached(userId, userEmail)
  if (hero.kind !== 'ok' || !hero.staffHero) {
    return <StaffTasksTodayNumber tasksToday={null} />
  }
  return <StaffTasksTodayNumber tasksToday={hero.staffHero.tasksToday} />
}

async function StaffTasksListSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  if (heavy.kind !== 'ok' || !heavy.staffHeavy) {
    return <StaffTasksTodayListColumn tasksTodayList={{ items: [], moreCount: 0 }} />
  }
  return (
    <StaffTasksTodayListColumn
      tasksTodayList={heavy.staffHeavy.tasksTodayList}
      taskBoardContext={heavy.staffHeavy.taskBoardContext}
    />
  )
}

async function StaffPendingMetricHero({ userId, userEmail }: { userId: string; userEmail: string }) {
  const hero = await getDashboardHeroCached(userId, userEmail)
  const v =
    hero.kind === 'ok' && hero.staffHero?.pendingTotal != null
      ? String(hero.staffHero.pendingTotal)
      : '--'
  return <DashboardMiniMetric valueSize="large" label="Tareas pendientes" value={v} />
}

async function StaffDueTodayMetric({ userId, userEmail }: { userId: string; userEmail: string }) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  const m = heavy.kind === 'ok' ? heavy.staffHeavy?.section1.pendingTasks : null
  return (
    <DashboardMiniMetric
      valueSize="large"
      label="Vencen hoy"
      value={m != null ? String(m.dueToday) : '--'}
      highlight={m != null && m.dueToday > 0 ? 'amber' : undefined}
    />
  )
}

async function StaffCompletedMetric({ userId, userEmail }: { userId: string; userEmail: string }) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  const v =
    heavy.kind === 'ok' && heavy.staffHeavy?.section1.completedThisWeek != null
      ? String(heavy.staffHeavy.section1.completedThisWeek)
      : '--'
  return <DashboardMiniMetric valueSize="large" label="Completadas" value={v} highlight="success" />
}

async function StaffClockMetric({ userId, userEmail }: { userId: string; userEmail: string }) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  const clock = heavy.kind === 'ok' ? heavy.staffHeavy?.section1.clockToday : null
  return (
    <DashboardMiniMetric
      valueSize="large"
      label="Horas fichadas"
      value={clock ? `${clock.hoursWorked} h` : '—'}
    />
  )
}

function StaffWeekMetricsSlot({ userId, userEmail }: { userId: string; userEmail: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Suspense fallback={<OwnerMiniMetricSkeleton />}>
        <StaffPendingMetricHero userId={userId} userEmail={userEmail} />
      </Suspense>
      <Suspense fallback={<OwnerMiniMetricSkeleton />}>
        <StaffDueTodayMetric userId={userId} userEmail={userEmail} />
      </Suspense>
      <Suspense fallback={<OwnerMiniMetricSkeleton />}>
        <StaffCompletedMetric userId={userId} userEmail={userEmail} />
      </Suspense>
      <Suspense fallback={<OwnerMiniMetricSkeleton />}>
        <StaffClockMetric userId={userId} userEmail={userEmail} />
      </Suspense>
    </div>
  )
}

async function StaffSecondarySection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const heavy = await getDashboardHeavyCached(userId, userEmail)
  if (heavy.kind !== 'ok' || !heavy.staffHeavy) return null
  const d = heavy.staffHeavy
  return (
    <StaffSecondaryRows
      section3={d.section3}
      section4={d.section4}
      teamAbsencesWeek={d.teamAbsencesWeek}
    />
  )
}

export function DashboardStaffStreamingSections({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  return (
    <div className="space-y-3 md:space-y-4">
      <StaffDashboardRowOneShell
        tasksNumber={
          <Suspense fallback={<OwnerTasksNumberSkeleton />}>
            <StaffTasksNumberSection userId={userId} userEmail={userEmail} />
          </Suspense>
        }
        tasksList={
          <Suspense fallback={<OwnerTasksListInlineSkeleton />}>
            <StaffTasksListSection userId={userId} userEmail={userEmail} />
          </Suspense>
        }
        weekMetrics={<StaffWeekMetricsSlot userId={userId} userEmail={userEmail} />}
      />

      <Suspense fallback={<StaffSecondaryRowsSkeleton />}>
        <StaffSecondarySection userId={userId} userEmail={userEmail} />
      </Suspense>
    </div>
  )
}

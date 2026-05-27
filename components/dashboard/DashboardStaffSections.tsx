import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, BarChart2, Calendar, Palmtree, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DashboardBlockGrid } from '@/components/dashboard/blocks/DashboardBlockGrid'
import { DashboardSurfaceCard } from '@/components/dashboard/blocks/DashboardSurfaceCard'
import { DashboardMiniMetric } from '@/components/dashboard/blocks/DashboardMiniMetric'
import { DashboardOwnerTasksTodayList } from '@/components/dashboard/blocks/DashboardOwnerTasksTodayList'
import { DashboardHoursProgress } from '@/components/dashboard/blocks/DashboardHoursProgress'
import type {
  OwnerTasksToday,
  OwnerTasksTodayList,
  StaffDashboardPayload,
  StaffHeavyPayload,
} from '@/lib/dashboard/dashboardTypes'
import {
  DASHBOARD_BLOCK_MUTED_CLASS,
  DASHBOARD_BLOCK_VALUE_LARGE_CLASS,
} from '@/components/dashboard/blocks/dashboardBlockTypography'

const WORK_BOARD_PATH = '/dashboard/work-board'
const URGENCY_LABEL = {
  overdue: 'Vencida',
  today: 'Vence hoy',
  week: 'Esta semana',
} as const

const URGENCY_CLASS = {
  overdue: 'text-red-400 bg-red-950/40 border-red-900/50',
  today: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
  week: 'text-zinc-400 bg-zinc-800/60 border-zinc-700',
} as const

export function StaffTasksTodayNumber({
  tasksToday,
}: {
  tasksToday: OwnerTasksToday | null | undefined
}) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center text-center md:max-w-[40%] md:pr-4 md:border-r md:border-zinc-800/80">
      <p className={DASHBOARD_BLOCK_VALUE_LARGE_CLASS}>
        {tasksToday != null ? tasksToday.total : '--'}
      </p>
      {tasksToday != null ? (
        <p
          className={cn(
            'mt-1.5 flex flex-wrap justify-center gap-x-2 gap-y-0.5',
            DASHBOARD_BLOCK_MUTED_CLASS
          )}
        >
          <span>{tasksToday.pending} pend.</span>
          <span>·</span>
          <span>{tasksToday.inProgress} en curso</span>
          <span>·</span>
          <span>{tasksToday.completedToday} complet.</span>
        </p>
      ) : null}
    </div>
  )
}

export function StaffTasksTodayListColumn({
  tasksTodayList,
}: {
  tasksTodayList: OwnerTasksTodayList
}) {
  return (
    <div className="min-w-0 flex-1 border-t border-zinc-800/80 pt-4 md:border-t-0 md:pl-4">
      <DashboardOwnerTasksTodayList
        items={tasksTodayList.items}
        moreCount={tasksTodayList.moreCount}
        workBoardHref={WORK_BOARD_PATH}
      />
    </div>
  )
}

export function StaffWeekMetricsGrid({
  section1,
}: {
  section1: StaffHeavyPayload['section1']
}) {
  const pendingMetrics = section1.pendingTasks
  return (
    <div className="grid grid-cols-2 gap-3">
      <DashboardMiniMetric
        valueSize="large"
        label="Tareas pendientes"
        value={pendingMetrics != null ? String(pendingMetrics.total) : '--'}
        highlight={pendingMetrics != null && pendingMetrics.overdue > 0 ? 'danger' : undefined}
      />
      <DashboardMiniMetric
        valueSize="large"
        label="Vencen hoy"
        value={pendingMetrics != null ? String(pendingMetrics.dueToday) : '--'}
        highlight={pendingMetrics != null && pendingMetrics.dueToday > 0 ? 'amber' : undefined}
      />
      <DashboardMiniMetric
        valueSize="large"
        label="Completadas"
        value={section1.completedThisWeek != null ? String(section1.completedThisWeek) : '--'}
        highlight="success"
      />
      <DashboardMiniMetric
        valueSize="large"
        label="Horas fichadas"
        value={section1.clockToday ? `${section1.clockToday.hoursWorked} h` : '—'}
      />
    </div>
  )
}

export function StaffDashboardRowOneShell({
  tasksNumber,
  tasksList,
  weekMetrics,
}: {
  tasksNumber: React.ReactNode
  tasksList: React.ReactNode
  weekMetrics: React.ReactNode
}) {
  return (
    <DashboardBlockGrid matchRowHeight>
      <DashboardSurfaceCard
        title="Tareas hoy"
        titleIcon={Calendar}
        compact
        className="flex h-full w-full flex-col"
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:items-stretch">
          {tasksNumber}
          {tasksList}
        </div>
      </DashboardSurfaceCard>

      <DashboardSurfaceCard
        title="Esta semana"
        titleIcon={BarChart2}
        compact
        className="flex h-full w-full flex-col"
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        {weekMetrics}
      </DashboardSurfaceCard>
    </DashboardBlockGrid>
  )
}

export function StaffSecondaryRows({
  section3,
  section4,
  teamAbsencesWeek,
}: {
  section3: StaffHeavyPayload['section3']
  section4: StaffHeavyPayload['section4']
  teamAbsencesWeek: StaffHeavyPayload['teamAbsencesWeek']
}) {
  const hours = section4.hoursWeek
  const targetHours = hours?.contractHoursPerWeek ?? 40
  const vacation = section4.vacation

  return (
    <>
      <DashboardBlockGrid>
        <DashboardSurfaceCard title="Mis tareas urgentes" titleIcon={AlertCircle}>
          {section3.urgent.length > 0 ? (
            <ul className="space-y-2">
              {section3.urgent.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`${WORK_BOARD_PATH}?task=${t.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 px-3 py-2 hover:bg-zinc-900/50"
                  >
                    <span className="truncate text-[13px] text-zinc-200">{t.title}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                        URGENCY_CLASS[t.urgency]
                      )}
                    >
                      {URGENCY_LABEL[t.urgency]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-zinc-500">Sin tareas urgentes</p>
          )}
        </DashboardSurfaceCard>

        <DashboardSurfaceCard title="Mis horas esta semana" titleIcon={Timer}>
          {hours?.available ? (
            <DashboardHoursProgress hoursWorked={hours.hoursWorked} targetHours={targetHours} />
          ) : (
            <p className="text-[13px] text-zinc-500">—</p>
          )}
        </DashboardSurfaceCard>
      </DashboardBlockGrid>

      <DashboardBlockGrid>
        <DashboardSurfaceCard title="Vacaciones y equipo" titleIcon={Palmtree}>
          {vacation?.available ? (
            <div className="mb-4">
              <p className="text-[11px] text-zinc-500">Días disponibles</p>
              <p className="text-2xl font-medium tabular-nums text-zinc-100 md:text-[28px]">
                {vacation.daysRemaining ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {vacation.daysUsedThisYear ?? 0} usados de {vacation.daysPerYear ?? '—'}
              </p>
            </div>
          ) : (
            <p className="mb-4 text-[13px] text-zinc-500">Vacaciones: Próximamente</p>
          )}
          <p className="mb-2 text-[11px] font-medium text-zinc-500">Ausencias del equipo</p>
          {teamAbsencesWeek.length > 0 ? (
            <ul className="space-y-2">
              {teamAbsencesWeek.map((a, i) => (
                <li key={`${a.staffName}-${i}`} className="text-[13px] text-zinc-400">
                  <span className="text-zinc-200">{a.staffName}</span>
                  {' · '}
                  {format(new Date(a.startDate), 'd MMM', { locale: es })}
                  {' – '}
                  {format(new Date(a.endDate), 'd MMM', { locale: es })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-zinc-500">Nadie de baja esta semana</p>
          )}
        </DashboardSurfaceCard>
      </DashboardBlockGrid>
    </>
  )
}

export function DashboardStaffSections({ data }: { data: StaffDashboardPayload }) {
  return (
    <div className="space-y-3 md:space-y-4">
      <StaffDashboardRowOneShell
        tasksNumber={<StaffTasksTodayNumber tasksToday={data.section1.tasksToday} />}
        tasksList={<StaffTasksTodayListColumn tasksTodayList={data.tasksTodayList} />}
        weekMetrics={
          <StaffWeekMetricsGrid
            section1={{
              pendingTasks: data.section1.pendingTasks,
              clockToday: data.section1.clockToday,
              completedThisWeek: data.section1.completedThisWeek,
              motivationalNote: data.section1.motivationalNote,
            }}
          />
        }
      />
      <StaffSecondaryRows
        section3={data.section3}
        section4={data.section4}
        teamAbsencesWeek={data.teamAbsencesWeek}
      />
    </div>
  )
}

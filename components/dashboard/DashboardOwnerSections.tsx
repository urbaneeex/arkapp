import Link from 'next/link'
import { Activity, BarChart2, Calendar, Users } from 'lucide-react'
import { DashboardBlockGrid } from '@/components/dashboard/blocks/DashboardBlockGrid'
import { DashboardSurfaceCard } from '@/components/dashboard/blocks/DashboardSurfaceCard'
import { DashboardMiniMetric } from '@/components/dashboard/blocks/DashboardMiniMetric'
import { DashboardTeamWorkloadList } from '@/components/dashboard/blocks/DashboardTeamWorkloadList'
import {
  DashboardRecentActivityList,
  DASHBOARD_ACTIVITY_MORE_HREF,
  DASHBOARD_ACTIVITY_PREVIEW_COUNT,
} from '@/components/dashboard/blocks/DashboardRecentActivityList'
import { DashboardOwnerTasksTodayList } from '@/components/dashboard/blocks/DashboardOwnerTasksTodayList'
import { WeekAppointmentsBarChart } from '@/components/dashboard/blocks/WeekAppointmentsBarChart'
import {
  DASHBOARD_BLOCK_MUTED_CLASS,
  DASHBOARD_BLOCK_VALUE_LARGE_CLASS,
} from '@/components/dashboard/blocks/dashboardBlockTypography'
import type {
  OwnerDashboardPayload,
  OwnerHeavyPayload,
  OwnerRevenueMonth,
  OwnerTasksToday,
  OwnerTasksTodayList,
  OwnerWeekChartDay,
} from '@/lib/dashboard/dashboardTypes'
import { cn } from '@/lib/utils'

const WORK_BOARD_PATH = '/dashboard/work-board'

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function revenueValue(revenue: OwnerRevenueMonth | null | undefined) {
  if (revenue == null) return '--'
  return revenue.available ? fmtEur(revenue.amount) : '—'
}

export function OwnerTasksTodayNumber({
  tasks,
}: {
  tasks: OwnerTasksToday | null | undefined
}) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center text-center md:max-w-[40%] md:pr-4 md:border-r md:border-zinc-800/80">
      <p className={DASHBOARD_BLOCK_VALUE_LARGE_CLASS}>
        {tasks != null ? tasks.total : '--'}
      </p>
      {tasks != null ? (
        <p
          className={cn(
            'mt-1.5 flex flex-wrap justify-center gap-x-2 gap-y-0.5',
            DASHBOARD_BLOCK_MUTED_CLASS
          )}
        >
          <span>{tasks.pending} pend.</span>
          <span>·</span>
          <span>{tasks.inProgress} en curso</span>
          <span>·</span>
          <span>{tasks.completedToday} complet.</span>
        </p>
      ) : null}
    </div>
  )
}

export function OwnerTasksTodayListColumn({
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

type OwnerWeekMetricsProps = {
  clientsWeek: OwnerHeavyPayload['section1']['clientsWeek']
  overdueTasks: OwnerHeavyPayload['section1']['overdueTasks']
  unassigned: OwnerHeavyPayload['section2']['unassigned']
  revenueMonth: OwnerRevenueMonth | null | undefined
}

export function OwnerWeekMetricsGrid({
  clientsWeek,
  overdueTasks,
  unassigned,
  revenueMonth,
}: OwnerWeekMetricsProps) {
  return (
    <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3">
      <DashboardMiniMetric
        centered
        valueSize="large"
        label="Nuevos clientes"
        value={clientsWeek != null ? String(clientsWeek.thisWeek) : '--'}
      />
      <DashboardMiniMetric
        centered
        valueSize="large"
        label="Tareas vencidas"
        value={overdueTasks != null ? String(overdueTasks) : '--'}
        highlight="danger"
      />
      <DashboardMiniMetric
        centered
        valueSize="large"
        label="Sin asignar"
        value={unassigned != null ? String(unassigned.total) : '--'}
        highlight={unassigned != null && unassigned.olderThan24h > 0 ? 'amber' : undefined}
      />
      <DashboardMiniMetric
        centered
        valueSize="large"
        label="Facturado mes"
        value={revenueValue(revenueMonth)}
      />
    </div>
  )
}

export function OwnerWeekChartColumn({
  appointmentsWeekChart,
}: {
  appointmentsWeekChart: OwnerWeekChartDay[] | null | undefined
}) {
  return (
    <div className="flex min-w-0 flex-col border-t border-zinc-800/80 pt-4 md:border-t-0 md:pt-0 md:pl-5">
      <p className={cn('mb-2 md:mb-2', DASHBOARD_BLOCK_MUTED_CLASS)}>Citas esta semana</p>
      <div className="w-full">
        <WeekAppointmentsBarChart data={appointmentsWeekChart ?? null} />
      </div>
    </div>
  )
}

export function OwnerSecondaryRow({
  section2,
  section3,
}: {
  section2: OwnerHeavyPayload['section2']
  section3: OwnerHeavyPayload['section3']
}) {
  return (
    <DashboardBlockGrid matchRowHeight>
      <DashboardSurfaceCard
        title="Carga del equipo"
        titleIcon={Users}
        className="flex h-full w-full flex-col"
        contentClassName="flex min-h-0 flex-1 flex-col"
        headerAside={
          section2.clockToday?.available
            ? `${section2.clockToday.clockedIn}/${section2.clockToday.totalStaff} empleados fichados`
            : undefined
        }
      >
        {section2.workload?.length ? (
          <DashboardTeamWorkloadList
            workload={section2.workload}
            notClockedStaffIds={section2.clockToday?.notClockedStaffIds ?? []}
            workloadBarMax={section2.workloadBarMax}
          />
        ) : (
          <p className="text-[13px] text-zinc-500">--</p>
        )}
      </DashboardSurfaceCard>

      <DashboardSurfaceCard
        title="Actividad reciente"
        titleIcon={Activity}
        className="flex h-full w-full flex-col"
        contentClassName="flex min-h-0 flex-1 flex-col"
        headerAside={
          section3.urgent.activity.length > DASHBOARD_ACTIVITY_PREVIEW_COUNT ? (
            <Link
              href={DASHBOARD_ACTIVITY_MORE_HREF}
              className="font-medium text-brand hover:underline"
            >
              Ver más Actividad
            </Link>
          ) : undefined
        }
      >
        <DashboardRecentActivityList items={section3.urgent.activity} />
      </DashboardSurfaceCard>
    </DashboardBlockGrid>
  )
}

/** Layout fila 1 owner (estructura fija; contenido vía children/slots). */
export function OwnerDashboardRowOneShell({
  tasksNumber,
  tasksList,
  weekMetrics,
  weekChart,
}: {
  tasksNumber: React.ReactNode
  tasksList: React.ReactNode
  weekMetrics: React.ReactNode
  weekChart: React.ReactNode
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
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 md:items-start md:gap-x-6">
          <div className="min-w-0 md:border-r md:border-zinc-800/80 md:pr-5">{weekMetrics}</div>
          {weekChart}
        </div>
      </DashboardSurfaceCard>
    </DashboardBlockGrid>
  )
}

export function DashboardOwnerSections({ data }: { data: OwnerDashboardPayload }) {
  return (
    <div className="space-y-3 md:space-y-4">
      <OwnerDashboardRowOneShell
        tasksNumber={<OwnerTasksTodayNumber tasks={data.section1.tasksToday} />}
        tasksList={<OwnerTasksTodayListColumn tasksTodayList={data.tasksTodayList} />}
        weekMetrics={
          <OwnerWeekMetricsGrid
            clientsWeek={data.section1.clientsWeek}
            overdueTasks={data.section1.overdueTasks}
            unassigned={data.section2.unassigned}
            revenueMonth={data.section1.revenueMonth}
          />
        }
        weekChart={<OwnerWeekChartColumn appointmentsWeekChart={data.appointmentsWeekChart} />}
      />
      <OwnerSecondaryRow section2={data.section2} section3={data.section3} />
    </div>
  )
}

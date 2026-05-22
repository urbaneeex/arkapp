'use client'

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
import type { OwnerDashboardPayload } from '@/lib/dashboard/dashboardTypes'

const WORK_BOARD_PATH = '/dashboard/work-board'

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export function DashboardOwnerSections({ data }: { data: OwnerDashboardPayload }) {
  const s1 = data.section1
  const s2 = data.section2
  const s3 = data.section3
  const tasks = s1.tasksToday

  const revenue = s1.revenueMonth
  const revenueValue =
    revenue == null ? '--' : revenue.available ? fmtEur(revenue.amount) : '—'

  return (
    <div className="space-y-3 md:space-y-4">
      <DashboardBlockGrid matchRowHeight>
        <DashboardSurfaceCard
          title="Tareas hoy"
          titleIcon={Calendar}
          compact
          className="flex h-full w-full flex-col"
          contentClassName="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:items-stretch">
            <div className="flex shrink-0 flex-col justify-center md:max-w-[40%] md:pr-4 md:border-r md:border-zinc-800/80">
              <p className="text-2xl font-medium tabular-nums text-zinc-100 md:text-[28px]">
                {tasks != null ? tasks.total : '--'}
              </p>
              {tasks != null ? (
                <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                  <span>{tasks.pending} pend.</span>
                  <span>·</span>
                  <span>{tasks.inProgress} en curso</span>
                  <span>·</span>
                  <span>{tasks.completedToday} complet.</span>
                </p>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 border-t border-zinc-800/80 pt-4 md:border-t-0 md:pl-4">
              <DashboardOwnerTasksTodayList
                items={data.tasksTodayList.items}
                moreCount={data.tasksTodayList.moreCount}
                workBoardHref={WORK_BOARD_PATH}
              />
            </div>
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
            <div className="min-w-0 md:border-r md:border-zinc-800/80 md:pr-5">
              <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3">
              <DashboardMiniMetric
                centered
                label="Nuevos clientes"
                value={s1.clientsWeek != null ? String(s1.clientsWeek.thisWeek) : '--'}
                hint={
                  s1.clientsWeek != null
                    ? `${s1.clientsWeek.delta >= 0 ? '+' : ''}${s1.clientsWeek.delta} vs ant.`
                    : undefined
                }
              />
              <DashboardMiniMetric
                centered
                label="Tareas vencidas"
                value={s1.overdueTasks != null ? String(s1.overdueTasks) : '--'}
                highlight="danger"
              />
              <DashboardMiniMetric
                centered
                label="Sin asignar"
                value={s2.unassigned != null ? String(s2.unassigned.total) : '--'}
                hint={
                  s2.unassigned != null && s2.unassigned.olderThan24h > 0
                    ? `${s2.unassigned.olderThan24h} +24h`
                    : undefined
                }
                highlight={
                  s2.unassigned != null && s2.unassigned.olderThan24h > 0 ? 'amber' : undefined
                }
              />
              <DashboardMiniMetric
                centered
                label="Facturado mes"
                value={revenueValue}
                hint={
                  revenue?.available && revenue.previousAmount > 0
                    ? `${revenue.delta >= 0 ? '+' : ''}${fmtEur(revenue.delta)}`
                    : undefined
                }
              />
              </div>
            </div>

            <div className="flex min-w-0 flex-col border-t border-zinc-800/80 pt-4 md:border-t-0 md:pt-0 md:pl-5">
              <p className="mb-2 text-[11px] leading-tight text-zinc-500 md:mb-2">
                Citas esta semana
              </p>
              <div className="w-full">
                <WeekAppointmentsBarChart data={data.appointmentsWeekChart} />
              </div>
            </div>
          </div>
        </DashboardSurfaceCard>
      </DashboardBlockGrid>

      <DashboardBlockGrid matchRowHeight>
        <DashboardSurfaceCard
          title="Carga del equipo"
          titleIcon={Users}
          className="flex h-full w-full flex-col"
          contentClassName="flex min-h-0 flex-1 flex-col"
          headerAside={
            s2.clockToday?.available
              ? `${s2.clockToday.clockedIn}/${s2.clockToday.totalStaff} empleados fichados`
              : undefined
          }
        >
          {s2.workload?.length ? (
            <DashboardTeamWorkloadList
              workload={s2.workload}
              notClockedStaffIds={s2.clockToday?.notClockedStaffIds ?? []}
              workloadBarMax={s2.workloadBarMax}
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
            s3.urgent.activity.length > DASHBOARD_ACTIVITY_PREVIEW_COUNT ? (
              <Link
                href={DASHBOARD_ACTIVITY_MORE_HREF}
                className="font-medium text-brand hover:underline"
              >
                Ver más Actividad
              </Link>
            ) : undefined
          }
        >
          <DashboardRecentActivityList items={s3.urgent.activity} />
        </DashboardSurfaceCard>
      </DashboardBlockGrid>
    </div>
  )
}

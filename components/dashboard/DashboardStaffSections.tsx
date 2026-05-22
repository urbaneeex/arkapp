'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AlertCircle,
  BarChart2,
  Calendar,
  Palmtree,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DashboardBlockGrid } from '@/components/dashboard/blocks/DashboardBlockGrid'
import { DashboardSurfaceCard } from '@/components/dashboard/blocks/DashboardSurfaceCard'
import { DashboardMiniMetric } from '@/components/dashboard/blocks/DashboardMiniMetric'
import { DashboardTimeline } from '@/components/dashboard/blocks/DashboardTimeline'
import { DashboardHoursProgress } from '@/components/dashboard/blocks/DashboardHoursProgress'
import { WORK_BOARD_CALENDAR_PATH } from '@/lib/routes'
import type { StaffDashboardPayload } from '@/lib/dashboard/dashboardTypes'

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

function untilLabelFromNow(startTime: string) {
  const minutes = Math.max(0, Math.round((new Date(startTime).getTime() - Date.now()) / 60000))
  if (minutes < 60) return `en ${minutes} min`
  const h = Math.floor(minutes / 60)
  return `en ${h} h`
}

export function DashboardStaffSections({ data }: { data: StaffDashboardPayload }) {
  const s1 = data.section1
  const tasks = s1.pendingTasks
  const hours = data.section4.hoursWeek
  const targetHours = hours?.contractHoursPerWeek ?? 40
  const vacation = data.section4.vacation

  return (
    <div className="space-y-3 md:space-y-4">
      <DashboardBlockGrid>
        <DashboardSurfaceCard title="Mis citas hoy" titleIcon={Calendar}>
          <p className="text-2xl font-medium tabular-nums text-zinc-100 md:text-[28px]">
            {s1.appointmentsToday}
          </p>
          <div className="my-3 border-t border-zinc-800/80" />
          {s1.nextAppointment ? (
            <div>
              <p className="text-[11px] text-zinc-500">
                Próxima · {untilLabelFromNow(s1.nextAppointment.startTime)}
              </p>
              <p className="mt-0.5 text-[13px] text-zinc-200">
                {s1.nextAppointment.clientName} · {s1.nextAppointment.serviceName}
              </p>
              <p className="text-[11px] tabular-nums text-zinc-500">
                {format(new Date(s1.nextAppointment.startTime), 'HH:mm', { locale: es })}
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-zinc-500">Sin citas hoy</p>
          )}
        </DashboardSurfaceCard>

        <DashboardSurfaceCard title="Esta semana" titleIcon={BarChart2}>
          <div className="grid grid-cols-2 gap-3">
            <DashboardMiniMetric
              label="Tareas pendientes"
              value={tasks != null ? String(tasks.total) : '--'}
              highlight={tasks != null && tasks.overdue > 0 ? 'danger' : undefined}
            />
            <DashboardMiniMetric
              label="Vencen hoy"
              value={tasks != null ? String(tasks.dueToday) : '--'}
              highlight={tasks != null && tasks.dueToday > 0 ? 'amber' : undefined}
            />
            <DashboardMiniMetric
              label="Completadas"
              value={s1.completedThisWeek != null ? String(s1.completedThisWeek) : '--'}
              hint={s1.motivationalNote ?? undefined}
              highlight="success"
            />
            <DashboardMiniMetric
              label="Horas fichadas"
              value={s1.clockToday ? `${s1.clockToday.hoursWorked} h` : '—'}
              hint={
                s1.clockToday?.open
                  ? `Entrada ${format(new Date(s1.clockToday.clockIn), 'HH:mm', { locale: es })}`
                  : s1.clockToday
                    ? 'Jornada cerrada'
                    : 'Próximamente'
              }
            />
          </div>
        </DashboardSurfaceCard>
      </DashboardBlockGrid>

      <DashboardBlockGrid>
        <DashboardSurfaceCard title="Mis tareas urgentes" titleIcon={AlertCircle}>
          {data.section3.urgent.length > 0 ? (
            <ul className="space-y-2">
              {data.section3.urgent.map((t) => (
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
            <DashboardHoursProgress
              hoursWorked={hours.hoursWorked}
              targetHours={targetHours}
            />
          ) : (
            <p className="text-[13px] text-zinc-500">—</p>
          )}
        </DashboardSurfaceCard>
      </DashboardBlockGrid>

      <DashboardBlockGrid>
        <DashboardSurfaceCard
          title="Mi agenda hoy"
          titleIcon={Calendar}
          footer={
            data.section2.hasMore ? (
              <Link
                href={WORK_BOARD_CALENDAR_PATH}
                className="text-[13px] font-medium text-brand hover:underline"
              >
                Ver todas →
              </Link>
            ) : undefined
          }
        >
          <DashboardTimeline
            items={data.section2.timeline.map((item) => ({
              id: item.id,
              time: item.startTime,
              status: item.status,
              primary: item.clientName,
              secondary: item.serviceName,
              href: `/dashboard/appointments/${item.id}/edit`,
            }))}
            emptyMessage="No tienes citas hoy"
          />
        </DashboardSurfaceCard>

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
          {data.teamAbsencesWeek.length > 0 ? (
            <ul className="space-y-2">
              {data.teamAbsencesWeek.map((a, i) => (
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
    </div>
  )
}

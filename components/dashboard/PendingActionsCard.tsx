'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2,
  ClipboardList,
  PenLine,
  Clock,
  CalendarOff,
  FileText,
  ChevronRight,
  Zap,
  Umbrella,
  CalendarDays,
  BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_BLOCK_BODY_CLASS,
  DASHBOARD_BLOCK_MUTED_CLASS,
} from '@/components/dashboard/blocks/dashboardBlockTypography'
import {
  DASHBOARD_CARD_BODY_PAD,
  DASHBOARD_CARD_HEADER_PAD,
} from '@/components/dashboard/blocks/DashboardSurfaceCard'

type Variant = 'default' | 'warning' | 'success'

/** String keys that identify which icon to render. */
export type ActionIconKey =
  | 'absences'
  | 'signature'
  | 'clock'
  | 'absence_own'
  | 'document'
  | 'vacation'
  | 'schedule'
  | 'time_report'

const ICONS: Record<ActionIconKey, React.ReactNode> = {
  absences:    <ClipboardList className="h-4 w-4" />,
  signature:   <PenLine className="h-4 w-4" />,
  clock:       <Clock className="h-4 w-4" />,
  absence_own: <CalendarOff className="h-4 w-4" />,
  document:    <FileText className="h-4 w-4" />,
  vacation:    <Umbrella className="h-4 w-4" />,
  schedule:    <CalendarDays className="h-4 w-4" />,
  time_report: <BarChart2 className="h-4 w-4" />,
}

export type PendingAction = {
  id: string
  label: string
  sublabel?: string
  href: string
  /** Use an ActionIconKey string — resolved to the real icon inside the component */
  icon: ActionIconKey
  variant?: Variant
  count?: number
}

interface Props {
  actions: PendingAction[]
  /** Whether the clock-in reminder is relevant for this user at all */
  hasClock: boolean
}

const variantStyles: Record<Variant, string> = {
  default: 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800/60',
  warning: 'border-amber-700/30 bg-amber-950/20 hover:bg-amber-950/30',
  success: 'border-green-700/20 bg-green-950/10',
}

const iconBg: Record<Variant, string> = {
  default: 'bg-zinc-800 text-zinc-300',
  warning: 'bg-amber-950/50 text-amber-400',
  success: 'bg-green-950/50 text-green-400',
}

const CLOCK_ACTION: PendingAction = {
  id: 'clock',
  label: 'No has fichado entrada hoy',
  sublabel: 'Recuerda registrar tu jornada',
  href: '/dashboard/fichar?tab=fichar',
  icon: 'clock',
  variant: 'warning',
}

export function PendingActionsCard({ actions: initialActions, hasClock }: Props) {
  // Track clock status on the client so we can update it without a full reload
  const [isClockedIn, setIsClockedIn] = useState<boolean | null>(null)

  // On mount: determine initial clock status from the SSR-rendered actions
  useEffect(() => {
    const hasClockReminder = initialActions.some(a => a.id === 'clock')
    // If the server already added the reminder the user wasn't clocked in at SSR time
    setIsClockedIn(!hasClockReminder)
  }, [initialActions])

  // Listen for clock-status-changed event dispatched by ClockStatusButton
  useEffect(() => {
    const handler = async () => {
      try {
        const res = await fetch('/api/clock/clock-in', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setIsClockedIn(data.clocked_in ?? false)
      } catch {
        // silent
      }
    }
    window.addEventListener('clock-status-changed', handler)
    return () => window.removeEventListener('clock-status-changed', handler)
  }, [])

  // Build the final actions list, inserting/removing the clock reminder reactively
  const actions: PendingAction[] = (() => {
    // Start with all non-clock actions from the server
    const rest = initialActions.filter(a => a.id !== 'clock')

    // isClockedIn === null means we haven't hydrated yet — keep SSR state
    if (isClockedIn === null) return initialActions

    // Insert clock reminder at the top if the user is not clocked in
    if (hasClock && !isClockedIn) return [CLOCK_ACTION, ...rest]
    return rest
  })()

  const pendingActions = actions.filter(a => a.variant !== 'success')
  const allDone = pendingActions.length === 0

  return (
    <Card className="flex flex-col">
      <CardHeader className={DASHBOARD_CARD_HEADER_PAD}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-4 w-4 text-brand" />
            Acciones pendientes
          </CardTitle>
          {!allDone && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand text-white text-xs font-bold">
              {pendingActions.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn('pt-0', DASHBOARD_CARD_BODY_PAD)}>
        {allDone ? (
          <div className="flex flex-col items-center justify-center pb-1 text-center gap-2">
            <div className="rounded-full bg-green-950/30 p-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className={DASHBOARD_BLOCK_BODY_CLASS}>Todo al día</p>
              <p className={cn('mt-0.5', DASHBOARD_BLOCK_MUTED_CLASS)}>
                No tienes acciones pendientes
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {actions.map(action => {
              const variant = action.variant ?? 'default'
              if (variant === 'success') return null
              return (
                <li key={action.id}>
                  <Link
                    href={action.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors group',
                      variantStyles[variant]
                    )}
                  >
                    <div className={cn('shrink-0 rounded-lg p-2', iconBg[variant])}>
                      {ICONS[action.icon]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100 leading-tight">
                        {action.label}
                      </p>
                      {action.sublabel && (
                        <p className="text-xs text-zinc-500 mt-0.5">{action.sublabel}</p>
                      )}
                    </div>
                    {action.count !== undefined && action.count > 0 && (
                      <span className={cn(
                        'shrink-0 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-xs font-bold',
                        variant === 'warning'
                          ? 'bg-amber-950/60 text-amber-300'
                          : 'bg-zinc-700 text-zinc-200'
                      )}>
                        {action.count}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}


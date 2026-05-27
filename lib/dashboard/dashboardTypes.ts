import type { PendingAction } from '@/components/dashboard/PendingActionsCard'
import type { PipelineStageRow, WorkBoardStaffOption, WorkItemCard } from '@/lib/work-items/types'

export type DashboardRole = 'owner' | 'staff'

export type DashboardTaskBoardContext = {
  businessId: string
  currentUserId: string
  initialStages: PipelineStageRow[]
  initialStaffOptions: WorkBoardStaffOption[]
  teamsForKanban: { id: string; name: string; color: string }[]
  myTeamIds: string[]
}

export type DashboardTaskOpenCache = {
  context: DashboardTaskBoardContext
  itemsById: Record<string, WorkItemCard>
}

export type OwnerTasksToday = {
  total: number
  pending: number
  inProgress: number
  completedToday: number
}

export type OwnerClientsWeek = {
  thisWeek: number
  previousWeek: number
  delta: number
}

export type OwnerRevenueMonth = {
  amount: number
  previousAmount: number
  delta: number
  available: boolean
}

export type OwnerClockToday = {
  clockedIn: number
  totalStaff: number
  notClockedStaffIds: string[]
  available: boolean
}

export type OwnerWorkloadRow = {
  staffId: string
  name: string
  color: string | null
  activeCount: number
  load: 'disponible' | 'ocupado' | 'sobrecargado'
}

export type OwnerAbsencesWeek = {
  staffNames: string[]
  available: boolean
}

export type OwnerUnassignedLeads = {
  total: number
  olderThan24h: number
  available: boolean
}

export type OwnerNextAppointment = {
  id: string
  clientName: string
  serviceName: string
  startTime: string
  minutesUntil: number
} | null

export type OwnerUrgentToday = {
  noShowsThisWeek: number | null
  completedToday: number | null
  activeTotal: number | null
  activity: Array<{ text: string; created_at: string }>
}

export type OwnerWeekChartDay = {
  dayLabel: string
  count: number
  isToday: boolean
}

export type OwnerTodayTaskItem = {
  id: string
  title: string
  /** Fecha / horario legible (chip del tablero). */
  dateLabel: string
  /** Cliente, servicio, precio… */
  briefInfo?: string
  /** Etiqueta de estado: En curso, Pendiente… */
  stateLabel: string
  stageSlug: string
  stageColor: string | null
  /** Tarjeta tablero para abrir modal sin bootstrap. */
  workItem?: WorkItemCard
}

export type OwnerTasksTodayList = {
  /** En curso primero, luego pendientes (máx. 3 visibles). */
  items: OwnerTodayTaskItem[]
  /** Tareas adicionales no mostradas (+N en UI). */
  moreCount: number
}

export type StaffTeamAbsence = {
  staffName: string
  startDate: string
  endDate: string
}

export type OwnerDashboardPayload = {
  section1: {
    tasksToday: OwnerTasksToday | null
    clientsWeek: OwnerClientsWeek | null
    overdueTasks: number | null
    revenueMonth: OwnerRevenueMonth | null
  }
  section2: {
    clockToday: OwnerClockToday | null
    workload: OwnerWorkloadRow[] | null
    /** Referencia barra "Carga del equipo" (desde config_json.workload.barMax). */
    workloadBarMax: number
    absencesWeek: OwnerAbsencesWeek | null
    unassigned: OwnerUnassignedLeads | null
  }
  section3: {
    nextAppointment: OwnerNextAppointment | null
    urgent: OwnerUrgentToday
  }
  appointmentsWeekChart: OwnerWeekChartDay[] | null
  tasksTodayList: OwnerTasksTodayList
  taskBoardContext?: DashboardTaskBoardContext | null
}

export type StaffMyDay = {
  tasksToday: OwnerTasksToday | null
  pendingTasks: {
    total: number
    dueToday: number
    overdue: number
    thisWeek: number
  } | null
  clockToday: {
    clockIn: string
    hoursWorked: number
    open: boolean
  } | null
  completedThisWeek: number | null
  motivationalNote: string | null
}

export type StaffUrgentTask = {
  id: string
  title: string
  urgency: 'overdue' | 'today' | 'week'
  endTime: string | null
}

export type StaffHoursWeek = {
  hoursWorked: number
  contractHoursPerWeek: number | null
  available: boolean
}

export type StaffVacation = {
  daysPerYear: number | null
  daysUsedThisYear: number | null
  daysRemaining: number | null
  available: boolean
}

export type StaffDashboardPayload = {
  section1: StaffMyDay
  section3: {
    urgent: StaffUrgentTask[]
  }
  section4: {
    hoursWeek: StaffHoursWeek | null
    vacation: StaffVacation | null
  }
  tasksTodayList: OwnerTasksTodayList
  teamAbsencesWeek: StaffTeamAbsence[]
  taskBoardContext?: DashboardTaskBoardContext | null
}

export type DashboardMetricsPayload = {
  ownerHome?: OwnerDashboardPayload
  staffHome?: StaffDashboardPayload
}

export type OwnerHeroPayload = {
  tasksToday: OwnerTasksToday | null
  revenueMonth: OwnerRevenueMonth | null
}

export type OwnerHeavyPayload = {
  section1: Pick<OwnerDashboardPayload['section1'], 'clientsWeek' | 'overdueTasks'>
  section2: OwnerDashboardPayload['section2']
  section3: OwnerDashboardPayload['section3']
  appointmentsWeekChart: OwnerWeekChartDay[] | null
  tasksTodayList: OwnerTasksTodayList
  taskBoardContext?: DashboardTaskBoardContext | null
}

export type StaffHeroPayload = {
  tasksToday: OwnerTasksToday | null
  pendingTotal: number | null
}

export type StaffHeavyPayload = {
  section1: Omit<StaffDashboardPayload['section1'], 'tasksToday'>
  section3: StaffDashboardPayload['section3']
  section4: StaffDashboardPayload['section4']
  tasksTodayList: OwnerTasksTodayList
  teamAbsencesWeek: StaffTeamAbsence[]
  taskBoardContext?: DashboardTaskBoardContext | null
}

export type DashboardHeroPayload =
  | { kind: 'no_business' }
  | { kind: 'ok'; role: DashboardRole; ownerHero?: OwnerHeroPayload; staffHero?: StaffHeroPayload }

export type DashboardHeavyPayload =
  | { kind: 'no_business' }
  | { kind: 'ok'; role: DashboardRole; ownerHeavy?: OwnerHeavyPayload; staffHeavy?: StaffHeavyPayload }

export type DashboardShellPayload =
  | { kind: 'no_business' }
  | {
      kind: 'ok'
      role: DashboardRole
      businessId: string
      pendingActions: PendingAction[]
      hasClock: boolean
      canSeeLiveClockPanel: boolean
      liveClockBetaEnabled: boolean
      /** Solo servidor: fetch métricas. */
      myStaffId: string
      contractHoursPerWeek: number | null
      vacationDaysPerYear: number | null
    }

export type DashboardBootstrapPayload =
  | { kind: 'no_business' }
  | {
      kind: 'ok'
      role: DashboardRole
      businessId: string
      pendingActions: PendingAction[]
      hasClock: boolean
      canSeeLiveClockPanel: boolean
      liveClockBetaEnabled: boolean
      ownerHome?: OwnerDashboardPayload
      staffHome?: StaffDashboardPayload
    }

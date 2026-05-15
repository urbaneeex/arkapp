'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEventHandler,
  type ReactElement,
} from 'react'
import { format, parseISO } from 'date-fns'
import { es as esLocale } from 'date-fns/locale'
import {
  AtSign,
  Ban,
  Calendar,
  Check,
  Flag,
  Loader2,
  Plus,
  Search,
  User,
  Wrench,
  X,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  kanbanPriorityFlagClass,
  kanbanPriorityLabel,
  type KanbanPriorityLevel,
} from '@/lib/work-items/kanbanPriority'
import {
  formatTaskRangeRelative,
  taskRangeHasOverduePart,
} from '@/lib/work-items/formatRelativeTaskRange'
import type { WorkItemCard, WorkBoardStaffOption } from '@/lib/work-items/types'
import {
  KanbanQuickDatePicker,
  combineDateAndOptionalTime,
  type KanbanDateChangeSource,
} from './KanbanQuickDatePicker'
import {
  KANBAN_COLUMN_TITLE_TYPO,
  KANBAN_QUICK_ADD_ROW_MUTED,
  KANBAN_QUICK_ADD_ROW_TAP,
} from './kanbanTypography'
import type { WorkBoardCardQuickEditContext, WorkBoardKanbanClientOption } from './workBoardCardFields'
import { WORK_BOARD_KANBAN_CHIP_CLASS } from './workBoardCardFields'
import { deriveAppointmentScope } from '@/lib/work-board/deriveAppointmentScope'

type QuickPriority = 'none' | 'urgent' | 'high' | 'normal' | 'low'

const PRIORITY_MENU: {
  id: Exclude<QuickPriority, 'none'>
  label: string
  flagClass: string
}[] = [
  { id: 'urgent', label: 'Urgente', flagClass: 'text-rose-400' },
  { id: 'high', label: 'Alta', flagClass: 'text-amber-400' },
  { id: 'normal', label: 'Normal', flagClass: 'text-sky-400' },
  { id: 'low', label: 'Baja', flagClass: 'text-zinc-500' },
]

function staffInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function staffAvatarBackground(color: string | null | undefined): string {
  if (!color?.trim()) return '#52525b'
  const c = color.trim()
  if (/^#[0-9a-f]{3,8}$/i.test(c)) return c
  if (/^[0-9a-f]{3,8}$/i.test(c)) return `#${c}`
  return '#52525b'
}

function staffIdsFromWorkItem(item: WorkItemCard): string[] {
  const m = item.metadata
  if (!m || typeof m !== 'object') return item.staff_id ? [item.staff_id] : []
  const raw = (m as Record<string, unknown>).kanban_assignees
  if (!Array.isArray(raw) || raw.length === 0) return item.staff_id ? [item.staff_id] : []
  const ids: string[] = []
  for (const entry of raw) {
    if (entry && typeof entry === 'object' && 'id' in entry) {
      const id = String((entry as { id: unknown }).id).trim()
      if (id) ids.push(id)
    }
  }
  return ids.length > 0 ? ids : item.staff_id ? [item.staff_id] : []
}

function teamIdsFromWorkItem(item: WorkItemCard): string[] {
  if (item.team_ids?.length) return [...item.team_ids]
  if (item.team_id) return [item.team_id]
  return []
}

/** Compara instantes de cita (ISO) para no guardar ni mostrar toast si no hubo cambio. */
function sameAppointmentTimes(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null
): boolean {
  const key = (iso: string | null) => {
    if (iso == null) return '∅'
    const t = new Date(iso).getTime()
    return Number.isNaN(t) ? `bad:${iso}` : String(t)
  }
  return key(aStart) === key(bStart) && key(aEnd) === key(bEnd)
}

function initDateFields(item: WorkItemCard) {
  let startDate = ''
  let startTime = ''
  let endLocal: string | null = null
  const m = item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
    ? (item.metadata as Record<string, unknown>)
    : {}

  if (item.start_time) {
    const s = parseISO(item.start_time)
    if (!Number.isNaN(s.getTime())) {
      startDate = format(s, 'yyyy-MM-dd')
      const hhmm = format(s, 'HH:mm')
      if (m.kanban_start_date_only === false) startTime = hhmm
      else if (m.kanban_start_date_only === true) startTime = ''
      else startTime = hhmm === '00:00' ? '' : hhmm
    }
  }
  if (item.end_time) {
    const e = parseISO(item.end_time)
    if (!Number.isNaN(e.getTime())) {
      endLocal = format(e, "yyyy-MM-dd'T'HH:mm")
    }
  }
  return { startDate, startTime, endLocal }
}

function inferEndTimeExplicit(item: WorkItemCard): boolean {
  const m = item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
    ? (item.metadata as Record<string, unknown>)
    : {}
  if (m.kanban_end_date_only === true) return false
  if (m.kanban_end_date_only === false) return true
  if (!item.end_time) return false
  const e = parseISO(item.end_time)
  if (Number.isNaN(e.getTime())) return false
  return format(e, 'HH:mm') !== '00:00'
}

function chipIconClass(compact?: boolean) {
  return cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')
}

function chipTextClass(compact?: boolean) {
  return cn('min-w-0 max-w-[140px] truncate leading-snug', compact ? 'text-xs' : 'text-sm')
}

export function WorkBoardCardInlineChips({
  item,
  quickEdit,
  compact,
  stopDrag,
  rangeOverdue,
  hasSchedule,
  rangeLabel,
  assignee,
  client,
  service,
  priority,
  priorityText,
}: {
  item: WorkItemCard
  quickEdit: WorkBoardCardQuickEditContext
  compact?: boolean
  stopDrag: PointerEventHandler
  rangeOverdue: boolean
  hasSchedule: boolean
  rangeLabel: string | null
  assignee: string | null
  client: string | null
  service: string | null
  priority: KanbanPriorityLevel | null
  priorityText: string | null
}) {
  const supabase = createClient()
  const { businessId, currentUserId, staffOptions, teams = [], services, clients, onUpdated } = quickEdit
  const [saving, setSaving] = useState(false)

  const datePopoverRef = useRef<HTMLDivElement>(null)
  const assignPopoverRef = useRef<HTMLDivElement>(null)
  const priorityPopoverRef = useRef<HTMLDivElement>(null)
  const clientPopoverRef = useRef<HTMLDivElement>(null)
  const servicePopoverRef = useRef<HTMLDivElement>(null)

  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endLocal, setEndLocal] = useState<string | null>(null)
  const [endTimeExplicit, setEndTimeExplicit] = useState(false)
  const dateDraftRef = useRef({
    startDate: '',
    startTime: '',
    endLocal: null as string | null,
    endTimeExplicit: false,
  })
  const dateTimesAtOpenRef = useRef({
    start: null as string | null,
    end: null as string | null,
    startDayOnly: false,
    endDayOnly: false,
  })
  const datePickerPrevOpenRef = useRef(false)
  const datePickerWasOpenRef = useRef(false)

  const persistDates = useCallback(async () => {
    const { startDate: sd, startTime: st, endLocal: el } = dateDraftRef.current
    let startIso: string | null = null
    let endIso: string | null = null

    if (sd.trim()) {
      const s = combineDateAndOptionalTime(sd, st)
      if (Number.isNaN(s.getTime())) {
        toast.error('Fecha de inicio no válida')
        return
      }
      startIso = s.toISOString()
    }

    if (el?.trim()) {
      const e = new Date(el)
      if (Number.isNaN(e.getTime())) {
        toast.error('Fecha de fin no válida')
        return
      }
      endIso = e.toISOString()
    }

    if (!sd.trim() && !el?.trim()) {
      startIso = null
      endIso = null
    }

    const draft = dateDraftRef.current
    const nextStartDayOnly = !!(startIso && !st.trim())
    const nextEndDayOnly = !!(endIso && !draft.endTimeExplicit)

    const before = dateTimesAtOpenRef.current
    if (
      sameAppointmentTimes(before.start, before.end, startIso, endIso) &&
      before.startDayOnly === nextStartDayOnly &&
      before.endDayOnly === nextEndDayOnly
    ) {
      return
    }
    setSaving(true)

    const base =
      item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
        ? { ...(item.metadata as Record<string, unknown>) }
        : {}

    if (startIso) {
      if (!st.trim()) base.kanban_start_date_only = true
      else delete base.kanban_start_date_only
    } else {
      delete base.kanban_start_date_only
    }

    if (endIso) {
      if (!draft.endTimeExplicit) base.kanban_end_date_only = true
      else delete base.kanban_end_date_only
    } else {
      delete base.kanban_end_date_only
    }

    const { error } = await supabase
      .from('appointments')
      .update({
        start_time: startIso,
        end_time: endIso,
        metadata: base,
      } as {
        start_time: string | null
        end_time: string | null
        metadata: Record<string, unknown>
      })
      .eq('id', item.id)
      .eq('business_id', businessId)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Fecha actualizada')
    onUpdated()
  }, [supabase, item.id, businessId, item.metadata, onUpdated])

  useLayoutEffect(() => {
    const opening = dateMenuOpen && !datePickerPrevOpenRef.current
    if (opening) {
      const init = initDateFields(item)
      const startDayOnlyOpen = !!(init.startDate.trim() && !init.startTime.trim())
      const endDayOnlyOpen = !!(init.endLocal?.trim() && !inferEndTimeExplicit(item))
      dateTimesAtOpenRef.current = {
        start: item.start_time,
        end: item.end_time,
        startDayOnly: startDayOnlyOpen,
        endDayOnly: endDayOnlyOpen,
      }
      const endEx = inferEndTimeExplicit(item)
      dateDraftRef.current = {
        startDate: init.startDate,
        startTime: init.startTime,
        endLocal: init.endLocal,
        endTimeExplicit: endEx,
      }
      setStartDate(init.startDate)
      setStartTime(init.startTime)
      setEndLocal(init.endLocal)
      setEndTimeExplicit(endEx)
    }
    datePickerPrevOpenRef.current = dateMenuOpen
  }, [dateMenuOpen, item.id, item.start_time, item.end_time, item.metadata])

  useLayoutEffect(() => {
    if (datePickerWasOpenRef.current && !dateMenuOpen) {
      void persistDates()
    }
    datePickerWasOpenRef.current = dateMenuOpen
  }, [dateMenuOpen, persistDates])

  const handleDateOpenChange = useCallback((next: boolean) => {
    setDateMenuOpen(next)
  }, [])

  const onDraftStartDateChange = useCallback((v: string) => {
    dateDraftRef.current = { ...dateDraftRef.current, startDate: v }
    setStartDate(v)
  }, [])

  const onDraftStartTimeChange = useCallback((v: string) => {
    dateDraftRef.current = { ...dateDraftRef.current, startTime: v }
    setStartTime(v)
  }, [])

  const onDraftEndChange = useCallback((v: string | null, source?: KanbanDateChangeSource) => {
    const nextExplicit =
      source === 'time-wheel'
        ? true
        : source === 'calendar-day' || source === 'clear'
          ? false
          : dateDraftRef.current.endTimeExplicit
    dateDraftRef.current = {
      ...dateDraftRef.current,
      endLocal: v,
      endTimeExplicit: nextExplicit,
    }
    setEndTimeExplicit(nextExplicit)
    setEndLocal(v)
  }, [])

  const dateTriggerSummary = useMemo(() => {
    const s = combineDateAndOptionalTime(startDate, startTime)
    const hasStart = startDate.trim().length > 0 && !Number.isNaN(s.getTime())
    const en = endLocal?.trim() ? new Date(endLocal) : null
    const hasEnd = en != null && !Number.isNaN(en.getTime())
    const endSummaryLabel = (d: Date) => {
      const t = d.getTime()
      if (Number.isNaN(t)) return ''
      const dayOnly =
        !endTimeExplicit &&
        d.getHours() === 0 &&
        d.getMinutes() === 0 &&
        d.getSeconds() === 0 &&
        d.getMilliseconds() === 0
      return dayOnly
        ? format(d, 'EEE d MMM', { locale: esLocale })
        : format(d, 'EEE d MMM, HH:mm', { locale: esLocale })
    }
    if (!hasStart && !hasEnd) return 'Añadir fecha'
    if (hasStart && !hasEnd) {
      return startTime.trim()
        ? format(s, 'EEE d MMM, HH:mm', { locale: esLocale })
        : format(s, 'EEE d MMM', { locale: esLocale })
    }
    if (!hasStart && hasEnd) return endSummaryLabel(en!)
    const startLabel = startTime.trim()
      ? format(s, 'EEE d MMM, HH:mm', { locale: esLocale })
      : format(s, 'EEE d MMM', { locale: esLocale })
    return `${startLabel} → ${endSummaryLabel(en!)}`
  }, [startDate, startTime, endLocal, endTimeExplicit])

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [staffIds, setStaffIds] = useState<string[]>(() => staffIdsFromWorkItem(item))
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(() => teamIdsFromWorkItem(item))
  const staffIdsRef = useRef(staffIds)
  staffIdsRef.current = staffIds
  const selectedTeamIdsRef = useRef(selectedTeamIds)
  selectedTeamIdsRef.current = selectedTeamIds
  const staffSnapshotOnOpen = useRef<string[]>([])
  const teamsSnapshotOnOpen = useRef<string[]>([])

  useEffect(() => {
    if (!assignOpen) return
    const ids = staffIdsFromWorkItem(item)
    const tids = teamIdsFromWorkItem(item)
    staffSnapshotOnOpen.current = [...ids]
    teamsSnapshotOnOpen.current = [...tids]
    setStaffIds(ids)
    setSelectedTeamIds(tids)
  }, [assignOpen, item])

  const persistAssignment = useCallback(async () => {
    const staffNext = staffIdsRef.current
    const teamsNext = selectedTeamIdsRef.current
    const prevStaff = staffSnapshotOnOpen.current.join('\0')
    const prevTeams = teamsSnapshotOnOpen.current.join('\0')
    if (staffNext.join('\0') === prevStaff && teamsNext.join('\0') === prevTeams) return

    const assignees = staffNext
      .map((id) => {
        const s = staffOptions.find((o) => o.id === id)
        return s ? { id: s.id, name: s.name } : { id, name: '?' }
      })
    const meta: Record<string, unknown> =
      item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
        ? { ...(item.metadata as Record<string, unknown>) }
        : {}
    if (staffNext.length > 0) meta.kanban_assignees = assignees
    else delete meta.kanban_assignees

    const scope = await deriveAppointmentScope({
      staffIds: staffNext,
      selectedTeamIds: teamsNext,
      teamsInBusiness: teams,
    })
    if ('error' in scope) {
      toast.error(scope.error)
      return
    }
    const { visibility: visibilityNext, team_id: appointmentTeamId, teamIdsForBridge } = scope

    setSaving(true)
    const { error } = await supabase
      .from('appointments')
      .update({
        staff_id: staffNext[0] ?? null,
        metadata: Object.keys(meta).length > 0 ? meta : null,
        visibility: visibilityNext,
        team_id: appointmentTeamId,
      })
      .eq('id', item.id)
      .eq('business_id', businessId)

    if (error) {
      setSaving(false)
      toast.error(error.message)
      return
    }

    const { error: delBridgeErr } = await supabase
      .from('appointment_teams')
      .delete()
      .eq('appointment_id', item.id)
    if (delBridgeErr) {
      setSaving(false)
      toast.error(delBridgeErr.message)
      return
    }

    const bridgeTeamIds =
      visibilityNext === 'team' && teamIdsForBridge.length > 0 ? teamIdsForBridge : []

    if (bridgeTeamIds.length > 0) {
      const { error: insErr } = await supabase.from('appointment_teams').insert(
        bridgeTeamIds.map((tid) => ({
          appointment_id: item.id,
          team_id: tid,
        }))
      )
      if (insErr) {
        setSaving(false)
        toast.error(insErr.message)
        return
      }
    }

    setSaving(false)
    toast.success('Asignación actualizada')
    onUpdated()
  }, [
    supabase,
    item.id,
    item.metadata,
    staffOptions,
    teams,
    businessId,
    onUpdated,
  ])

  const handleAssignOpenChange = useCallback(
    (next: boolean) => {
      if (!next && assignOpen) void persistAssignment()
      setAssignOpen(next)
      if (!next) setAssignSearch('')
    },
    [assignOpen, persistAssignment]
  )

  const filteredStaff = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    if (!q) return staffOptions
    return staffOptions.filter((s) => {
      if (s.name.toLowerCase().includes(q)) return true
      if (s.email?.toLowerCase().includes(q)) return true
      return false
    })
  }, [staffOptions, assignSearch])

  const filteredTeams = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((t) => t.name.toLowerCase().includes(q))
  }, [teams, assignSearch])

  const staffPickerOptions = useMemo(
    () => filteredStaff.filter((s) => !staffIds.includes(s.id)),
    [filteredStaff, staffIds]
  )

  const teamsPickerOptions = useMemo(
    () => filteredTeams.filter((t) => !selectedTeamIds.includes(t.id)),
    [filteredTeams, selectedTeamIds]
  )

  const assignChipSummary = useMemo(() => {
    const parts: string[] = []
    if (assignee?.trim()) parts.push(assignee.trim())
    const tls = item.teams_linked
    if (tls && tls.length > 0) {
      parts.push(tls.map((t) => t.name).join(', '))
    } else if (item.team_name?.trim()) {
      parts.push(item.team_name.trim())
    }
    return parts.length > 0 ? parts.join(' · ') : null
  }, [assignee, item.team_name, item.teams_linked])

  const selectedStaffOrderedDraft = useMemo(
    () =>
      staffIds
        .map((id) => staffOptions.find((s) => s.id === id))
        .filter((s): s is WorkBoardStaffOption => !!s),
    [staffIds, staffOptions]
  )

  const selectedTeamsOrderedDraft = useMemo(
    () =>
      selectedTeamIds
        .map((id) => teams.find((t) => t.id === id))
        .filter((t): t is (typeof teams)[number] => !!t),
    [selectedTeamIds, teams]
  )

  const assignPopoverDraftSummary = useMemo(() => {
    const parts: string[] = []
    if (selectedStaffOrderedDraft.length > 0) {
      parts.push(
        selectedStaffOrderedDraft.map((s) => (s.id === currentUserId ? 'Yo' : s.name)).join(', ')
      )
    }
    if (selectedTeamsOrderedDraft.length > 0) {
      parts.push(selectedTeamsOrderedDraft.map((t) => t.name.trim()).join(', '))
    }
    return parts.length > 0 ? parts.join(' · ') : null
  }, [selectedStaffOrderedDraft, selectedTeamsOrderedDraft, currentUserId])

  const assignChipDisplaySummary = assignOpen ? assignPopoverDraftSummary : assignChipSummary

  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false)
  const priorityValue = (priority ?? 'none') as QuickPriority

  const savePriority = async (p: QuickPriority) => {
    const meta: Record<string, unknown> =
      item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
        ? { ...(item.metadata as Record<string, unknown>) }
        : {}
    if (p === 'none') delete meta.kanban_priority
    else meta.kanban_priority = p
    setSaving(true)
    const { error } = await supabase
      .from('appointments')
      .update({ metadata: Object.keys(meta).length > 0 ? meta : null })
      .eq('id', item.id)
      .eq('business_id', businessId)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Prioridad actualizada')
    setPriorityMenuOpen(false)
    onUpdated()
  }

  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)
  const [clientMode, setClientMode] = useState<'search' | 'existing' | 'new'>('search')
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<WorkBoardKanbanClientOption[]>([])
  const [clientSearchLoading, setClientSearchLoading] = useState(false)
  const clientSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedClient, setSelectedClient] = useState<WorkBoardKanbanClientOption | null>(null)
  const [isEditingClient, setIsEditingClient] = useState(false)
  const [editClientPhone, setEditClientPhone] = useState('')
  const [editClientEmail, setEditClientEmail] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')

  const resetClientState = useCallback(() => {
    setClientMode('search')
    setClientQuery('')
    setClientResults([])
    setClientSearchLoading(false)
    setSelectedClient(null)
    setIsEditingClient(false)
    setEditClientPhone('')
    setEditClientEmail('')
    setNewClientName('')
    setNewClientPhone('')
    setNewClientEmail('')
  }, [])

  useEffect(() => {
    if (clientSearchDebounceRef.current) clearTimeout(clientSearchDebounceRef.current)
    const q = clientQuery.trim()
    if (!q) {
      setClientResults([])
      setClientSearchLoading(false)
      return
    }
    setClientSearchLoading(true)
    clientSearchDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, email')
        .eq('business_id', businessId)
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8)
      setClientResults((data ?? []) as WorkBoardKanbanClientOption[])
      setClientSearchLoading(false)
    }, 300)
    return () => {
      if (clientSearchDebounceRef.current) clearTimeout(clientSearchDebounceRef.current)
    }
  }, [clientQuery, businessId, supabase])

  useEffect(() => {
    if (!clientPopoverOpen) return
    resetClientState()
    if (item.client_id && item.client_name) {
      const fromList = clients.find((c) => c.id === item.client_id)
      setSelectedClient(
        fromList ?? {
          id: item.client_id,
          name: item.client_name,
          phone: null,
          email: null,
        }
      )
      setClientMode('existing')
    }
  }, [clientPopoverOpen, item.client_id, item.client_name, clients, resetClientState])

  const persistClientId = async (clientId: string | null) => {
    setSaving(true)
    const { error } = await supabase
      .from('appointments')
      .update({ client_id: clientId })
      .eq('id', item.id)
      .eq('business_id', businessId)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Cliente actualizado')
    setClientPopoverOpen(false)
    resetClientState()
    onUpdated()
  }

  const [servicePopoverOpen, setServicePopoverOpen] = useState(false)

  const persistService = async (svc: (typeof services)[0] | null) => {
    setSaving(true)
    const { error } = await supabase
      .from('appointments')
      .update({
        service_id: svc?.id ?? null,
        price_total: svc?.price ?? null,
      })
      .eq('id', item.id)
      .eq('business_id', businessId)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Servicio actualizado')
    setServicePopoverOpen(false)
    onUpdated()
  }

  const selectedServiceRow = services.find((s) => s.id === item.service_id) ?? null

  const dateChipTrigger: ReactElement = (
    <button
      type="button"
      data-kanban-chip
      disabled={saving}
      onPointerDown={stopDrag}
      className={cn(
        WORK_BOARD_KANBAN_CHIP_CLASS,
        rangeOverdue && hasSchedule && 'border-red-500/40 bg-red-950/20 text-red-200'
      )}
      title={
        hasSchedule
          ? `Inicio: ${item.start_time}\nFin: ${item.end_time}`
          : 'Añadir o editar fecha'
      }
      aria-label={rangeLabel ?? 'Fecha: añadir o editar'}
    >
      <Calendar
        className={cn(
          chipIconClass(compact),
          rangeOverdue && hasSchedule ? 'text-red-400' : 'text-zinc-400'
        )}
        aria-hidden
      />
      {rangeLabel ? (
        <span
          className={cn(
            chipTextClass(compact),
            'tabular-nums',
            rangeOverdue ? 'text-red-200' : 'text-emerald-400/95'
          )}
        >
          {rangeLabel}
        </span>
      ) : null}
    </button>
  )

  return (
    <div className={cn('mt-2.5 flex flex-wrap items-center', compact ? 'gap-1.5' : 'gap-2')}>
      <KanbanQuickDatePicker
        open={dateMenuOpen}
        onOpenChange={handleDateOpenChange}
        popoverModal
        triggerSummary={dateTriggerSummary}
        contentRef={datePopoverRef}
        startDate={startDate}
        startTime={startTime}
        onStartDateChange={onDraftStartDateChange}
        onStartTimeChange={onDraftStartTimeChange}
        endLocal={endLocal}
        onEndChange={onDraftEndChange}
        disabled={saving}
        popoverSide="right"
        trigger={dateChipTrigger}
      />

      {staffOptions.length > 0 || teams.length > 0 ? (
        <Popover open={assignOpen} onOpenChange={handleAssignOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-kanban-chip
              disabled={saving}
              onPointerDown={stopDrag}
              className={cn(WORK_BOARD_KANBAN_CHIP_CLASS, !assignChipDisplaySummary && 'px-2')}
              title={
                assignChipDisplaySummary ? `Asignación: ${assignChipDisplaySummary}` : 'Asignar empleado o equipo'
              }
              aria-label={assignChipDisplaySummary ?? 'Asignar empleado o equipo'}
            >
              <AtSign className={cn(chipIconClass(compact), 'text-zinc-400')} aria-hidden />
              {assignChipDisplaySummary ? (
                <span className={chipTextClass(compact)}>{assignChipDisplaySummary}</span>
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent
            ref={assignPopoverRef}
            align="start"
            side="bottom"
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              'w-[min(280px,calc(100vw-2rem))] max-w-[280px] border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl dark:bg-zinc-900',
              KANBAN_COLUMN_TITLE_TYPO
            )}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 px-2 py-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <input
                type="search"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="Buscar persona o equipo…"
                className="min-w-0 flex-1 border-0 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-500"
                autoFocus
              />
            </div>
            <div className="border-b border-zinc-800 px-3 py-2.5">
              <p
                className={cn(
                  KANBAN_QUICK_ADD_ROW_MUTED,
                  'text-[11px] uppercase tracking-wide text-zinc-500'
                )}
              >
                Asignación
              </p>
              <div className="mt-2 rounded-lg border border-zinc-800/90 bg-zinc-950/70 px-2 py-2">
                {selectedStaffOrderedDraft.length === 0 && selectedTeamsOrderedDraft.length === 0 ? (
                  <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-1 py-0.5 text-xs text-zinc-500')}>
                    Sin asignar
                  </p>
                ) : (
                  <ul className="list-none space-y-0.5 p-0">
                    {selectedStaffOrderedDraft.map((s) => {
                      const isMe = s.id === currentUserId
                      return (
                        <li key={`chip-as-p-${s.id}`} className="list-none">
                          <button
                            type="button"
                            disabled={saving}
                            className={cn(
                              KANBAN_COLUMN_TITLE_TYPO,
                              'flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-zinc-800/55 disabled:opacity-50'
                            )}
                            aria-label={`Quitar a ${isMe ? 'Yo' : s.name} de la asignación`}
                            onClick={() =>
                              setStaffIds((prev) => prev.filter((id) => id !== s.id))
                            }
                          >
                            <span
                              className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-inner"
                              style={{ backgroundColor: staffAvatarBackground(s.color) }}
                            >
                              {staffInitials(s.name)}
                              {isMe ? (
                                <span
                                  className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-zinc-900"
                                  aria-hidden
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                              {isMe ? 'Yo' : s.name}
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              Persona
                            </span>
                            <X className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                    {selectedTeamsOrderedDraft.map((t) => (
                      <li key={`chip-as-t-${t.id}`} className="list-none">
                        <button
                          type="button"
                          disabled={saving}
                          className={cn(
                            KANBAN_COLUMN_TITLE_TYPO,
                            'flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-zinc-800/55 disabled:opacity-50'
                          )}
                          aria-label={`Quitar equipo ${t.name} de la asignación`}
                          onClick={() =>
                            setSelectedTeamIds((prev) => prev.filter((id) => id !== t.id))
                          }
                        >
                          <span
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-inner"
                            style={{ backgroundColor: staffAvatarBackground(t.color) }}
                          >
                            {staffInitials(t.name)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{t.name}</span>
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Equipo
                          </span>
                          <X className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {staffOptions.length > 0 ? (
                <>
                  <p
                    className={cn(
                      KANBAN_QUICK_ADD_ROW_MUTED,
                      'px-3 pb-0.5 pt-2 text-[11px] uppercase tracking-wide'
                    )}
                  >
                    Personas
                  </p>
                  {filteredStaff.length === 0 ? (
                    <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-2 text-xs')}>
                      Sin coincidencias.
                    </p>
                  ) : staffPickerOptions.length === 0 ? (
                    <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-2 text-xs')}>
                      Ya están en asignación.
                    </p>
                  ) : (
                    staffPickerOptions.map((s) => {
                      const isMe = s.id === currentUserId
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={cn(
                            KANBAN_COLUMN_TITLE_TYPO,
                            'flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-zinc-800/90'
                          )}
                          onClick={() =>
                            setStaffIds((prev) => (prev.includes(s.id) ? prev : [...prev, s.id]))
                          }
                        >
                          <span
                            className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-inner"
                            style={{ backgroundColor: staffAvatarBackground(s.color) }}
                          >
                            {staffInitials(s.name)}
                            {isMe ? (
                              <span
                                className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-zinc-900"
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-zinc-100">
                            {isMe ? 'Yo' : s.name}
                          </span>
                          <Plus className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                        </button>
                      )
                    })
                  )}
                </>
              ) : null}
              {teams.length > 0 ? (
                <>
                  {staffOptions.length > 0 ? (
                    <div className="mx-2 border-t border-zinc-800/80" aria-hidden />
                  ) : null}
                  <p
                    className={cn(
                      KANBAN_QUICK_ADD_ROW_MUTED,
                      'px-3 pb-0.5 pt-2 text-[11px] uppercase tracking-wide'
                    )}
                  >
                    Equipo
                  </p>
                  {filteredTeams.length === 0 ? (
                    <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-1 text-xs')}>
                      Sin coincidencias.
                    </p>
                  ) : teamsPickerOptions.length === 0 ? (
                    <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-1 text-xs')}>
                      Ya están en asignación.
                    </p>
                  ) : (
                    teamsPickerOptions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={saving}
                        className={cn(
                          KANBAN_COLUMN_TITLE_TYPO,
                          'flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-zinc-800/90'
                        )}
                        onClick={() =>
                          setSelectedTeamIds((prev) =>
                            prev.includes(t.id) ? prev : [...prev, t.id]
                          )
                        }
                      >
                        <span
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-inner"
                          style={{ backgroundColor: staffAvatarBackground(t.color) }}
                        >
                          {staffInitials(t.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-zinc-100">{t.name}</span>
                        <Plus className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                      </button>
                    ))
                  )}
                </>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <span
          className={cn(
            WORK_BOARD_KANBAN_CHIP_CLASS,
            KANBAN_QUICK_ADD_ROW_MUTED,
            'cursor-not-allowed px-2 opacity-60'
          )}
          title="Sin personas ni equipos disponibles"
          aria-label="Sin opciones de asignación"
        >
          <AtSign className={cn(chipIconClass(compact), 'text-zinc-400')} aria-hidden />
        </span>
      )}

      <Popover open={priorityMenuOpen} onOpenChange={setPriorityMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-kanban-chip
            disabled={saving}
            onPointerDown={stopDrag}
            className={cn(WORK_BOARD_KANBAN_CHIP_CLASS, !priorityText && 'px-2')}
            title={priorityText ?? 'Añadir prioridad'}
            aria-label={priorityText ?? 'Prioridad: añadir'}
          >
            <Flag
              className={cn(
                chipIconClass(compact),
                priority ? kanbanPriorityFlagClass(priority) : 'text-zinc-400'
              )}
              aria-hidden
            />
            {priorityText ? <span className={chipTextClass(compact)}>{priorityText}</span> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          ref={priorityPopoverRef}
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'w-[min(220px,calc(100vw-2rem))] max-w-[240px] border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl dark:bg-zinc-900',
            KANBAN_COLUMN_TITLE_TYPO
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <p
            className={cn(
              KANBAN_QUICK_ADD_ROW_MUTED,
              'px-3 pb-2 pt-2.5 text-xs uppercase tracking-wide'
            )}
          >
            Prioridad
          </p>
          <div className="px-1 pb-1">
            {PRIORITY_MENU.map((row) => {
              const selected = priorityValue === row.id
              return (
                <button
                  key={row.id}
                  type="button"
                  className={cn(
                    KANBAN_COLUMN_TITLE_TYPO,
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-zinc-800/90',
                    selected && 'bg-zinc-800/70'
                  )}
                  onClick={() => void savePriority(row.id)}
                >
                  <Flag className={cn('h-4 w-4 shrink-0', row.flagClass)} aria-hidden />
                  <span>{row.label}</span>
                </button>
              )
            })}
          </div>
          <div className="border-t border-zinc-800/90 px-1 pb-1 pt-0.5">
            <button
              type="button"
              className={cn(
                KANBAN_COLUMN_TITLE_TYPO,
                'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-zinc-300 hover:bg-zinc-800/90'
              )}
              onClick={() => void savePriority('none')}
            >
              <Ban className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <span>Limpiar</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={clientPopoverOpen}
        onOpenChange={(next) => {
          setClientPopoverOpen(next)
          if (!next) resetClientState()
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            data-kanban-chip
            disabled={saving}
            onPointerDown={stopDrag}
            className={cn(WORK_BOARD_KANBAN_CHIP_CLASS, !client && 'px-2')}
            title={client ? `Cliente: ${client}` : 'Añadir cliente'}
            aria-label={client ?? 'Cliente: añadir'}
          >
            <User className={cn(chipIconClass(compact), 'text-zinc-400')} aria-hidden />
            {client ? <span className={chipTextClass(compact)}>{client}</span> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          ref={clientPopoverRef}
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'w-[min(300px,calc(100vw-2rem))] max-w-[300px] border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl dark:bg-zinc-900',
            KANBAN_COLUMN_TITLE_TYPO
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {clientMode === 'existing' && selectedClient ? (
            <div className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-zinc-100">{selectedClient.name}</p>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditClientPhone(selectedClient.phone ?? '')
                      setEditClientEmail(selectedClient.email ?? '')
                      setIsEditingClient(true)
                    }}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                    title="Editar datos"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null)
                      setClientMode('search')
                      setClientQuery('')
                    }}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                    title="Cambiar cliente"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {isEditingClient ? (
                <div className="space-y-2">
                  <Input
                    value={editClientPhone}
                    onChange={(e) => setEditClientPhone(e.target.value)}
                    placeholder="Teléfono"
                    className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                  />
                  <Input
                    value={editClientEmail}
                    onChange={(e) => setEditClientEmail(e.target.value)}
                    placeholder="Email"
                    className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full text-xs"
                    onClick={async () => {
                      await supabase
                        .from('clients')
                        .update({ phone: editClientPhone || null, email: editClientEmail || null })
                        .eq('id', selectedClient.id)
                        .eq('business_id', businessId)
                      setSelectedClient({
                        ...selectedClient,
                        phone: editClientPhone,
                        email: editClientEmail,
                      })
                      setIsEditingClient(false)
                      toast.success('Cliente actualizado')
                    }}
                  >
                    Guardar datos del cliente
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedClient.phone && <p className="text-xs text-zinc-400">{selectedClient.phone}</p>}
                  {selectedClient.email && (
                    <p className="truncate text-xs text-zinc-400">{selectedClient.email}</p>
                  )}
                  {!selectedClient.phone && !selectedClient.email && (
                    <p className="text-xs text-zinc-600">Sin datos de contacto</p>
                  )}
                  {item.client_id !== selectedClient.id ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() => void persistClientId(selectedClient.id)}
                    >
                      Asignar a la tarea
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
                    onClick={() => void persistClientId(null)}
                  >
                    Quitar cliente de la tarea
                  </button>
                  <button
                    type="button"
                    className="w-full text-center text-xs text-brand hover:underline"
                    onClick={() => {
                      setSelectedClient(null)
                      setClientMode('search')
                      setClientQuery('')
                    }}
                  >
                    Elegir otro cliente
                  </button>
                </div>
              )}
            </div>
          ) : clientMode === 'new' ? (
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'text-[11px] uppercase tracking-wide')}>
                  Nuevo cliente
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setClientMode('search')
                    setNewClientName('')
                    setNewClientPhone('')
                    setNewClientEmail('')
                  }}
                  className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nombre *"
                className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                autoFocus
              />
              <Input
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="Teléfono"
                className="h-8 border-zinc-700 bg-zinc-800 text-sm"
              />
              <Input
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="Email"
                className="h-8 border-zinc-700 bg-zinc-800 text-sm"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 w-full text-xs"
                disabled={!newClientName.trim()}
                onClick={async () => {
                  const { data: newCli, error } = await supabase
                    .from('clients')
                    .insert({
                      business_id: businessId,
                      name: newClientName.trim(),
                      phone: newClientPhone || null,
                      email: newClientEmail || null,
                    })
                    .select('id')
                    .maybeSingle()
                  if (error) {
                    toast.error(error.message)
                    return
                  }
                  if (newCli?.id) await persistClientId(newCli.id)
                }}
              >
                Crear y asignar
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 border-b border-zinc-800 px-2 py-2">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                <input
                  type="search"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  placeholder="Nombre o teléfono…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-500"
                  autoFocus
                />
                {clientSearchLoading && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-500" />
                )}
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {!clientQuery.trim() && (
                  <p className="px-3 py-2 text-xs text-zinc-600">Escribe para buscar…</p>
                )}
                {clientQuery.trim().length >= 2 &&
                  !clientSearchLoading &&
                  clientResults.length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-500">Sin resultados</p>
                  )}
                {clientResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      KANBAN_COLUMN_TITLE_TYPO,
                      'flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-800/90'
                    )}
                    onClick={() => void persistClientId(c.id)}
                  >
                    <span className="text-sm font-medium text-zinc-100">{c.name}</span>
                    {c.phone && <span className="text-xs text-zinc-500">{c.phone}</span>}
                  </button>
                ))}
                {clientQuery.trim().length >= 2 &&
                  !clientResults.some(
                    (r) => r.name.toLowerCase() === clientQuery.trim().toLowerCase()
                  ) && (
                    <button
                      type="button"
                      className={cn(
                        KANBAN_COLUMN_TITLE_TYPO,
                        'flex w-full items-center gap-2 border-t border-zinc-800 px-3 py-2 text-left text-brand hover:bg-brand/10'
                      )}
                      onClick={() => {
                        setNewClientName(clientQuery.trim())
                        setClientMode('new')
                        setClientQuery('')
                      }}
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      Crear &ldquo;{clientQuery.trim()}&rdquo;
                    </button>
                  )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {services.length > 0 && (
        <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-kanban-chip
              disabled={saving}
              onPointerDown={stopDrag}
              className={cn(WORK_BOARD_KANBAN_CHIP_CLASS, !service && 'px-2')}
              title={service ? `Servicio: ${service}` : 'Añadir servicio'}
              aria-label={service ?? 'Servicio: añadir'}
            >
              <Wrench className={cn(chipIconClass(compact), 'text-zinc-400')} aria-hidden />
              {service ? <span className={chipTextClass(compact)}>{service}</span> : null}
            </button>
          </PopoverTrigger>
          <PopoverContent
            ref={servicePopoverRef}
            align="start"
            side="bottom"
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              'w-[min(260px,calc(100vw-2rem))] max-w-[260px] border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl dark:bg-zinc-900',
              KANBAN_COLUMN_TITLE_TYPO
            )}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <p
              className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 pb-1 pt-2.5 text-[11px] uppercase tracking-wide')}
            >
              Servicio
            </p>
            <div className="max-h-56 overflow-y-auto pb-1">
              <button
                type="button"
                className={cn(
                  KANBAN_COLUMN_TITLE_TYPO,
                  'flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/90',
                  !selectedServiceRow && 'bg-zinc-800/60'
                )}
                onClick={() => void persistService(null)}
              >
                <Ban className="h-4 w-4 shrink-0 text-zinc-500" />
                <span className="text-zinc-400">Sin servicio</span>
              </button>
              {services.map((svc) => {
                const isSel = selectedServiceRow?.id === svc.id
                return (
                  <button
                    key={svc.id}
                    type="button"
                    className={cn(
                      KANBAN_COLUMN_TITLE_TYPO,
                      'flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-zinc-800/90',
                      isSel && 'bg-zinc-800/60'
                    )}
                    onClick={() => void persistService(svc)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-100">{svc.name}</p>
                      <p className="text-xs text-zinc-500">
                        {svc.duration} min{svc.price > 0 ? ` · ${svc.price}€` : ''}
                      </p>
                    </div>
                    {isSel && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClockInWidget } from '@/components/clock/ClockInWidget'
import { MyTimeLog } from './MyTimeLog'
import { MyRequests } from './MyRequests'
import { MyScheduleView } from './MyScheduleView'
import { TeamRequests } from './TeamRequests'
import { MyDocuments } from './MyDocuments'
import { Clock, List, CalendarDays, FileText, Users, FolderOpen } from 'lucide-react'

type ClockInMethod = 'manual' | 'qr' | 'gps'

type Props = {
  staffId: string
  staffName: string
  businessId: string
  businessName: string
  clockInMethod: ClockInMethod
  geofenceRadius: number
  openEntry: { id: string; clock_in: string; source: string } | null
  canManageAbsences: boolean
  contractHoursPerWeek?: number | null
  initialTab?: string
}

export function EmployeePortal({
  staffId,
  staffName,
  businessId,
  businessName,
  clockInMethod,
  geofenceRadius,
  openEntry,
  canManageAbsences,
  contractHoursPerWeek,
  initialTab,
}: Props) {
  const searchParams = useSearchParams()
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingDocCount, setPendingDocCount] = useState(0)
  const [activeTab, setActiveTab] = useState(
    () => initialTab ?? searchParams.get('tab') ?? 'fichar'
  )

  useEffect(() => {
    const tab = initialTab ?? searchParams.get('tab')
    if (tab) setActiveTab(tab)
  }, [initialTab, searchParams])

  useEffect(() => {
    fetch(`/api/staff/signatures?business_id=${businessId}&staff_id=${staffId}&status=pending`)
      .then((r) => r.json())
      .then((j) => setPendingDocCount((j.data ?? []).length))
      .catch(() => {})
  }, [businessId, staffId])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex w-full min-h-0 flex-1 flex-col">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-zinc-100">Jornada</h1>
      </header>

      <TabsList className="flex h-auto w-full cursor-default flex-row flex-wrap justify-start gap-2 rounded-lg bg-zinc-800 p-1 text-zinc-400">
        <TabsTrigger value="fichar" className="gap-1.5 max-sm:px-2 max-sm:text-xs">
          <Clock className="h-4 w-4 shrink-0" />
          Fichar
        </TabsTrigger>

        <TabsTrigger value="fichajes" className="gap-1.5 max-sm:px-2 max-sm:text-xs">
          <List className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Mis fichajes</span>
          <span className="sm:hidden">Fichajes</span>
        </TabsTrigger>

        <TabsTrigger value="solicitudes" className="gap-1.5 max-sm:px-2 max-sm:text-xs">
          <FileText className="h-4 w-4 shrink-0" />
          Solicitudes
        </TabsTrigger>

        <TabsTrigger value="horario" className="gap-1.5 max-sm:px-2 max-sm:text-xs">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Mi horario</span>
          <span className="sm:hidden">Horario</span>
        </TabsTrigger>

        <TabsTrigger value="documentos" className="relative gap-1.5 max-sm:px-2 max-sm:text-xs">
          <FolderOpen className="h-4 w-4 shrink-0" />
          Documentos
          {pendingDocCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
              {pendingDocCount > 9 ? '9+' : pendingDocCount}
            </span>
          )}
        </TabsTrigger>

        {canManageAbsences && (
          <TabsTrigger value="aprobaciones" className="relative gap-1.5 max-sm:px-2 max-sm:text-xs">
            <Users className="h-4 w-4 shrink-0" />
            Aprobaciones
            {pendingCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="fichar" className="mt-6">
        <div className="mx-auto max-w-md">
          <ClockInWidget
            userName={staffName}
            businessName={businessName}
            clockInMethod={clockInMethod}
            geofenceRadius={geofenceRadius}
            openEntry={openEntry}
          />
        </div>
      </TabsContent>

      <TabsContent value="fichajes" className="mt-6">
        <MyTimeLog staffId={staffId} businessId={businessId} contractHoursPerWeek={contractHoursPerWeek} />
      </TabsContent>

      <TabsContent value="solicitudes" className="mt-6">
        <MyRequests staffId={staffId} businessId={businessId} />
      </TabsContent>

      <TabsContent value="horario" className="mt-6">
        <MyScheduleView staffId={staffId} businessId={businessId} />
      </TabsContent>

      <TabsContent value="documentos" className="mt-6">
        <MyDocuments staffId={staffId} businessId={businessId} />
      </TabsContent>

      {canManageAbsences && (
        <TabsContent value="aprobaciones" className="mt-6">
          <TeamRequests businessId={businessId} onCountChange={setPendingCount} />
        </TabsContent>
      )}
    </Tabs>
  )
}

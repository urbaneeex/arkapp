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
import { cn } from '@/lib/utils'

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
}: Props) {
  const searchParams = useSearchParams()
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingDocCount, setPendingDocCount] = useState(0)
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? 'fichar')

  // Jump to tab when ?tab= searchParam changes (e.g. navigating from dashboard)
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) setActiveTab(tab)
  }, [searchParams])

  useEffect(() => {
    fetch(`/api/staff/signatures?business_id=${businessId}&staff_id=${staffId}&status=pending`)
      .then(r => r.json())
      .then(j => setPendingDocCount((j.data ?? []).length))
      .catch(() => {})
  }, [businessId, staffId])

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100">Mi Jornada</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Hola, {staffName}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn(
          'w-full h-auto bg-zinc-900 border border-zinc-800 p-1 rounded-xl',
          'grid gap-1',
          canManageAbsences ? 'grid-cols-6' : 'grid-cols-5'
        )}>
          <TabsTrigger
            value="fichar"
            className="flex flex-col items-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-medium rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400"
          >
            <Clock className="h-4 w-4" />
            <span className="hidden sm:block">Fichar</span>
          </TabsTrigger>

          <TabsTrigger
            value="fichajes"
            className="flex flex-col items-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-medium rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:block">Mis fichajes</span>
          </TabsTrigger>

          <TabsTrigger
            value="solicitudes"
            className="flex flex-col items-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-medium rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:block">Solicitudes</span>
          </TabsTrigger>

          <TabsTrigger
            value="horario"
            className="flex flex-col items-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-medium rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:block">Mi horario</span>
          </TabsTrigger>

          <TabsTrigger
            value="documentos"
            className="flex flex-col items-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-medium rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400 relative"
          >
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:block">Documentos</span>
            {pendingDocCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingDocCount > 9 ? '9+' : pendingDocCount}
              </span>
            )}
          </TabsTrigger>

          {canManageAbsences && (
            <TabsTrigger
              value="aprobaciones"
              className="flex flex-col items-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-medium rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400 relative"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:block">Aprobaciones</span>
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="fichar">
            <div className="max-w-md mx-auto">
              <ClockInWidget
                userName={staffName}
                businessName={businessName}
                clockInMethod={clockInMethod}
                geofenceRadius={geofenceRadius}
                openEntry={openEntry}
              />
            </div>
          </TabsContent>

          <TabsContent value="fichajes">
            <MyTimeLog staffId={staffId} businessId={businessId} contractHoursPerWeek={contractHoursPerWeek} />
          </TabsContent>

          <TabsContent value="solicitudes">
            <MyRequests staffId={staffId} businessId={businessId} />
          </TabsContent>

          <TabsContent value="horario">
            <MyScheduleView staffId={staffId} businessId={businessId} />
          </TabsContent>

          <TabsContent value="documentos">
            <MyDocuments
              staffId={staffId}
              businessId={businessId}
            />
          </TabsContent>

          {canManageAbsences && (
            <TabsContent value="aprobaciones">
              <TeamRequests
                businessId={businessId}
                onCountChange={setPendingCount}
              />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  )
}

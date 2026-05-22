'use client'

import { useState } from 'react'
import { DashboardProgressRow } from '@/components/dashboard/blocks/DashboardProgressRow'
import type { OwnerWorkloadRow } from '@/lib/dashboard/dashboardTypes'

const PREVIEW_COUNT = 3
export function DashboardTeamWorkloadList({
  workload,
  notClockedStaffIds,
  workloadBarMax,
}: {
  workload: OwnerWorkloadRow[]
  notClockedStaffIds: string[]
  workloadBarMax: number
}) {
  const [expanded, setExpanded] = useState(false)
  const notClockedSet = new Set(notClockedStaffIds)
  const hasMore = workload.length > PREVIEW_COUNT
  const visible = expanded ? workload : workload.slice(0, PREVIEW_COUNT)

  return (
    <div className="space-y-0.5">
      {visible.map((w) => (
        <DashboardProgressRow
          key={w.staffId}
          name={w.name}
          activeCount={w.activeCount}
          load={w.load}
          notClockedIn={notClockedSet.has(w.staffId)}
          maxActive={workloadBarMax}
        />
      ))}
      {hasMore && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 w-full pt-1 text-left text-[11px] font-medium text-brand hover:underline"
        >
          Ver más empleados
        </button>
      ) : null}
    </div>
  )
}

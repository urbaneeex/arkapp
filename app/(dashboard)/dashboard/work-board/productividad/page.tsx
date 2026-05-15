import type { Metadata } from 'next'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { OwnerProductivityGate } from '@/components/work-board/OwnerProductivityDashboard'

export const metadata: Metadata = {
  title: 'Productividad',
}

export default function WorkBoardProductividadPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RequirePermission permission="tasks_metrics_view">
        <OwnerProductivityGate />
      </RequirePermission>
    </div>
  )
}

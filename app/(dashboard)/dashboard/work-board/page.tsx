import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WorkBoardKanbanPageSkeleton } from '@/components/work-board/WorkBoardKanbanPageSkeleton'
import { WorkBoardDataSection } from './WorkBoardDataSection'

export const metadata: Metadata = {
  title: 'Tablero',
}

export default function WorkBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string; period?: string; scope?: string }>
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<WorkBoardKanbanPageSkeleton />}>
        <WorkBoardDataSection searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

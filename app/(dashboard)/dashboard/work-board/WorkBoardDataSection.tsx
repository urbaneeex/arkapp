import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { loadWorkBoardBootstrap, type WorkBoardSearchParams } from '@/lib/work-board/loadWorkBoardBootstrap'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'
import { WorkBoardQueryBridge } from '@/components/work-board/WorkBoardQueryBridge'

export async function WorkBoardDataSection({
  searchParams,
}: {
  searchParams: Promise<WorkBoardSearchParams>
}) {
  const sp = await searchParams
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
      },
    },
  })
  const data = await loadWorkBoardBootstrap(sp)
  qc.setQueryData(workBoardKeys.bootstrap(sp), data)

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <WorkBoardQueryBridge searchParams={sp} />
    </HydrationBoundary>
  )
}

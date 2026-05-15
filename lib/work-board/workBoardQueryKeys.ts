import type { WorkBoardSearchParams } from '@/lib/work-board/loadWorkBoardBootstrap'

export const workBoardKeys = {
  all: ['work-board'] as const,
  bootstrap: (sp: WorkBoardSearchParams) =>
    ['work-board', 'bootstrap', sp.view ?? '', sp.period ?? '', sp.new ?? ''] as const,
}

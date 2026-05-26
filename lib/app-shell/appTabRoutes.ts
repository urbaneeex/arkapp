import type { WorkBoardSearchParams } from '@/lib/work-board/loadWorkBoardBootstrap'

export type AppTabId = 'home' | 'workBoard' | 'fichar'

export type AppTabShellState = {
  tab: AppTabId
  workBoardParams: WorkBoardSearchParams
  ficharTab: string | null
}

export const DEFAULT_WORK_BOARD_PARAMS: WorkBoardSearchParams = {}

export const WORK_BOARD_NEW_TASK_PARAMS: WorkBoardSearchParams = {
  view: 'calendar',
  period: 'week',
  new: '1',
}


export function isAppShellRoute(pathname: string): boolean {
  if (pathname === '/dashboard') return true
  if (pathname === '/dashboard/fichar' || pathname.startsWith('/dashboard/fichar/')) return true
  if (pathname === '/dashboard/work-board') return true
  return false
}

export function isAppShellTabHref(href: string): AppTabId | null {
  const [path] = href.split('?')
  if (path === '/dashboard') return 'home'
  if (path === '/dashboard/fichar') return 'fichar'
  if (path === '/dashboard/work-board') return 'workBoard'
  return null
}

export function parseAppTabFromLocation(
  pathname: string,
  searchParams: URLSearchParams
): AppTabShellState {
  if (pathname === '/dashboard/fichar' || pathname.startsWith('/dashboard/fichar/')) {
    return {
      tab: 'fichar',
      workBoardParams: DEFAULT_WORK_BOARD_PARAMS,
      ficharTab: searchParams.get('tab'),
    }
  }

  if (pathname === '/dashboard/work-board') {
    return {
      tab: 'workBoard',
      workBoardParams: {
        view: searchParams.get('view') ?? undefined,
        new: searchParams.get('new') ?? undefined,
        period: searchParams.get('period') ?? undefined,
      },
      ficharTab: null,
    }
  }

  return {
    tab: 'home',
    workBoardParams: DEFAULT_WORK_BOARD_PARAMS,
    ficharTab: null,
  }
}

export function buildAppTabUrl(
  tab: AppTabId,
  opts?: { workBoardParams?: WorkBoardSearchParams; ficharTab?: string | null }
): string {
  if (tab === 'home') return '/dashboard'

  if (tab === 'fichar') {
    const tabParam = opts?.ficharTab
    return tabParam ? `/dashboard/fichar?tab=${encodeURIComponent(tabParam)}` : '/dashboard/fichar'
  }

  const sp = opts?.workBoardParams ?? DEFAULT_WORK_BOARD_PARAMS
  const q = new URLSearchParams()
  if (sp.view) q.set('view', sp.view)
  if (sp.new) q.set('new', sp.new)
  if (sp.period) q.set('period', sp.period)
  const qs = q.toString()
  return qs ? `/dashboard/work-board?${qs}` : '/dashboard/work-board'
}

export function workBoardBootstrapUrl(sp: WorkBoardSearchParams): string {
  const q = new URLSearchParams()
  if (sp.view) q.set('view', sp.view)
  if (sp.new) q.set('new', sp.new)
  if (sp.period) q.set('period', sp.period)
  const s = q.toString()
  return s ? `/api/work-board/bootstrap?${s}` : '/api/work-board/bootstrap'
}

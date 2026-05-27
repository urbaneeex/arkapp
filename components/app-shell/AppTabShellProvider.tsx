'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  type AppTabId,
  buildAppTabUrl,
  DEFAULT_WORK_BOARD_PARAMS,
  isAppShellRoute,
  parseAppTabFromLocation,
  workBoardBootstrapUrl,
} from '@/lib/app-shell/appTabRoutes'
import type { WorkBoardSearchParams } from '@/lib/work-board/loadWorkBoardBootstrap'
import type { WorkBoardBootstrapPayload } from '@/lib/work-board/loadWorkBoardBootstrap'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'
import { prefetchAppTabQueries } from '@/lib/app-shell/prefetchAppTabQueries'
import { AppNewTaskDiscardDialog } from '@/components/app-shell/AppNewTaskDiscardDialog'
import { useCompactAppNav } from '@/hooks/useCompactAppNav'
import type { AccountMenuUser } from '@/components/layout/AccountMenuActions'

type NavigateOpts = {
  workBoardParams?: WorkBoardSearchParams
  ficharTab?: string | null
}

type PendingLeaveAction =
  | { kind: 'tab'; tab: AppTabId; opts?: NavigateOpts }
  | { kind: 'fn'; fn: () => void }

type ShellOverride = {
  tab: AppTabId
  workBoardParams: WorkBoardSearchParams
  ficharTab: string | null
}

type AppTabShellContextValue = {
  displayName: string
  shellVisible: boolean
  activeTab: AppTabId
  workBoardParams: WorkBoardSearchParams
  ficharTab: string | null
  mountedTabs: Set<AppTabId>
  isNewTaskQuickAdd: boolean
  newTaskDraftDirty: boolean
  setNewTaskDraftDirty: (dirty: boolean) => void
  navigateAppTab: (tab: AppTabId, opts?: NavigateOpts) => void
  requestLeaveNewTask: (action: PendingLeaveAction) => void
  setFicharTab: (tab: string | null) => void
  setWorkBoardParams: (params: WorkBoardSearchParams) => void
  isAppTabActive: (tab: AppTabId) => boolean
  accountUser: AccountMenuUser | null
  businessName: string
}

const AppTabShellContext = createContext<AppTabShellContextValue | null>(null)

async function fetchWorkBoardBootstrap(sp: WorkBoardSearchParams): Promise<WorkBoardBootstrapPayload> {
  const res = await fetch(workBoardBootstrapUrl(sp))
  if (!res.ok) throw new Error('work-board bootstrap')
  return res.json()
}

export function AppTabShellProvider({
  children,
  displayName,
  accountUser,
  businessName = '',
}: {
  children: ReactNode
  displayName: string
  accountUser: AccountMenuUser | null
  businessName?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const compactAppNav = useCompactAppNav()

  const routeShell = isAppShellRoute(pathname)
  const parsedFromUrl = useMemo(
    () => parseAppTabFromLocation(pathname, searchParams),
    [pathname, searchParams]
  )

  const [shellOverride, setShellOverride] = useState<ShellOverride | null>(null)
  const [mountedTabs, setMountedTabs] = useState<Set<AppTabId>>(() => new Set())
  const [newTaskDraftDirty, setNewTaskDraftDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [pendingLeave, setPendingLeave] = useState<PendingLeaveAction | null>(null)

  const shellVisible = isAppShellRoute(pathname)

  const activeTab = shellOverride?.tab ?? parsedFromUrl.tab
  const workBoardParams = shellOverride?.workBoardParams ?? parsedFromUrl.workBoardParams
  const ficharTab = shellOverride?.ficharTab ?? parsedFromUrl.ficharTab
  const isNewTaskQuickAdd = activeTab === 'workBoard' && workBoardParams.new === '1'

  useEffect(() => {
    if (!isAppShellRoute(pathname)) {
      setShellOverride(null)
      return
    }
    if (routeShell) {
      setShellOverride(null)
    }
  }, [routeShell, pathname])

  useEffect(() => {
    if (!shellVisible) return
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [shellVisible, activeTab])

  useEffect(() => {
    const onPopState = () => {
      setShellOverride(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const syncUrl = useCallback(
    (tab: AppTabId, opts?: NavigateOpts) => {
      const url = buildAppTabUrl(tab, {
        workBoardParams: opts?.workBoardParams,
        ficharTab: opts?.ficharTab,
      })
      router.replace(url, { scroll: false })
    },
    [router]
  )

  const performNavigateAppTab = useCallback(
    (tab: AppTabId, opts?: NavigateOpts) => {
      const nextWorkBoard = opts?.workBoardParams ?? DEFAULT_WORK_BOARD_PARAMS
      const nextFicharTab =
        opts?.ficharTab !== undefined ? opts.ficharTab : tab === 'fichar' ? ficharTab : null

      setMountedTabs((prev) => {
        const next = new Set(prev)
        next.add(tab)
        return next
      })

      syncUrl(tab, { workBoardParams: nextWorkBoard, ficharTab: nextFicharTab })
      prefetchAppTabQueries(queryClient, tab)

      if (tab === 'workBoard') {
        void queryClient.prefetchQuery({
          queryKey: workBoardKeys.bootstrap(nextWorkBoard),
          queryFn: () => fetchWorkBoardBootstrap(nextWorkBoard),
          staleTime: 60_000,
        })
      }
    },
    [ficharTab, queryClient, syncUrl]
  )

  const shouldGuardNewTaskLeave = useCallback(
    (action: PendingLeaveAction) => {
      if (!compactAppNav || !isNewTaskQuickAdd || !newTaskDraftDirty) return false
      if (action.kind === 'tab') {
        if (action.tab === 'workBoard' && action.opts?.workBoardParams?.new === '1') return false
        return true
      }
      return true
    },
    [compactAppNav, isNewTaskQuickAdd, newTaskDraftDirty]
  )

  const commitPendingLeave = useCallback(() => {
    const action = pendingLeave
    setDiscardOpen(false)
    setPendingLeave(null)
    setNewTaskDraftDirty(false)
    if (!action) return
    if (action.kind === 'fn') action.fn()
    else performNavigateAppTab(action.tab, action.opts)
  }, [pendingLeave, performNavigateAppTab])

  const requestLeaveNewTask = useCallback(
    (action: PendingLeaveAction) => {
      if (shouldGuardNewTaskLeave(action)) {
        setPendingLeave(action)
        setDiscardOpen(true)
        return
      }
      setNewTaskDraftDirty(false)
      if (action.kind === 'fn') action.fn()
      else performNavigateAppTab(action.tab, action.opts)
    },
    [shouldGuardNewTaskLeave, performNavigateAppTab]
  )

  const navigateAppTab = useCallback(
    (tab: AppTabId, opts?: NavigateOpts) => {
      requestLeaveNewTask({ kind: 'tab', tab, opts })
    },
    [requestLeaveNewTask]
  )

  const setFicharTab = useCallback(
    (tab: string | null) => {
      if (activeTab !== 'fichar') return
      syncUrl('fichar', { ficharTab: tab })
    },
    [activeTab, syncUrl]
  )

  const setWorkBoardParams = useCallback(
    (params: WorkBoardSearchParams) => {
      if (activeTab !== 'workBoard') return
      const apply = () => {
        syncUrl('workBoard', { workBoardParams: params })
        void queryClient.prefetchQuery({
          queryKey: workBoardKeys.bootstrap(params),
          queryFn: () => fetchWorkBoardBootstrap(params),
          staleTime: 60_000,
        })
      }
      if (
        compactAppNav &&
        isNewTaskQuickAdd &&
        params.new !== '1' &&
        newTaskDraftDirty
      ) {
        setPendingLeave({ kind: 'fn', fn: apply })
        setDiscardOpen(true)
        return
      }
      if (isNewTaskQuickAdd && params.new !== '1') setNewTaskDraftDirty(false)
      apply()
    },
    [
      activeTab,
      compactAppNav,
      isNewTaskQuickAdd,
      newTaskDraftDirty,
      queryClient,
      syncUrl,
    ]
  )

  const isAppTabActive = useCallback(
    (tab: AppTabId) => shellVisible && activeTab === tab,
    [activeTab, shellVisible]
  )

  const value = useMemo(
    () => ({
      displayName,
      shellVisible,
      activeTab,
      workBoardParams,
      ficharTab,
      mountedTabs,
      isNewTaskQuickAdd,
      newTaskDraftDirty,
      setNewTaskDraftDirty,
      navigateAppTab,
      requestLeaveNewTask,
      setFicharTab,
      setWorkBoardParams,
      isAppTabActive,
      accountUser,
      businessName,
    }),
    [
      displayName,
      shellVisible,
      activeTab,
      workBoardParams,
      ficharTab,
      mountedTabs,
      isNewTaskQuickAdd,
      newTaskDraftDirty,
      navigateAppTab,
      requestLeaveNewTask,
      setFicharTab,
      setWorkBoardParams,
      isAppTabActive,
      accountUser,
      businessName,
    ]
  )

  return (
    <AppTabShellContext.Provider value={value}>
      {children}
      <AppNewTaskDiscardDialog
        open={discardOpen}
        onCancel={() => {
          setDiscardOpen(false)
          setPendingLeave(null)
        }}
        onDiscard={commitPendingLeave}
      />
    </AppTabShellContext.Provider>
  )
}

export function useAppTabShell() {
  const ctx = useContext(AppTabShellContext)
  if (!ctx) {
    throw new Error('useAppTabShell must be used within AppTabShellProvider')
  }
  return ctx
}

export function useAppTabShellOptional() {
  return useContext(AppTabShellContext)
}

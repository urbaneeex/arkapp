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
import { usePathname, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { WorkBoardSearchParams } from '@/lib/work-board/loadWorkBoardBootstrap'
import type { DashboardBootstrapPayload } from '@/lib/dashboard/dashboardTypes'
import type { WorkBoardBootstrapPayload } from '@/lib/work-board/loadWorkBoardBootstrap'
import type { FicharBootstrapPayload } from '@/lib/fichar/loadFicharBootstrap'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'
import { ficharKeys } from '@/lib/fichar/ficharQueryKeys'
import {
  type AppTabId,
  buildAppTabUrl,
  DEFAULT_WORK_BOARD_PARAMS,
  isAppShellRoute,
  parseAppTabFromLocation,
  workBoardBootstrapUrl,
} from '@/lib/app-shell/appTabRoutes'

type NavigateOpts = {
  workBoardParams?: WorkBoardSearchParams
  ficharTab?: string | null
}

type AppTabShellContextValue = {
  displayName: string
  shellVisible: boolean
  activeTab: AppTabId
  workBoardParams: WorkBoardSearchParams
  ficharTab: string | null
  mountedTabs: Set<AppTabId>
  navigateAppTab: (tab: AppTabId, opts?: NavigateOpts) => void
  setFicharTab: (tab: string | null) => void
  setWorkBoardParams: (params: WorkBoardSearchParams) => void
  isAppTabActive: (tab: AppTabId) => boolean
}

const AppTabShellContext = createContext<AppTabShellContextValue | null>(null)

async function fetchDashboardBootstrap(): Promise<DashboardBootstrapPayload> {
  const res = await fetch('/api/dashboard/bootstrap')
  if (!res.ok) throw new Error('dashboard bootstrap')
  return res.json()
}

async function fetchFicharBootstrap(): Promise<FicharBootstrapPayload> {
  const res = await fetch('/api/fichar/bootstrap')
  if (!res.ok) throw new Error('fichar bootstrap')
  return res.json()
}

async function fetchWorkBoardBootstrap(sp: WorkBoardSearchParams): Promise<WorkBoardBootstrapPayload> {
  const res = await fetch(workBoardBootstrapUrl(sp))
  if (!res.ok) throw new Error('work-board bootstrap')
  return res.json()
}

type ShellOverride = {
  tab: AppTabId
  workBoardParams: WorkBoardSearchParams
  ficharTab: string | null
}

export function AppTabShellProvider({
  children,
  displayName,
}: {
  children: ReactNode
  displayName: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const routeShell = isAppShellRoute(pathname)
  const parsedFromUrl = useMemo(
    () => parseAppTabFromLocation(pathname, searchParams),
    [pathname, searchParams]
  )

  const [shellOverride, setShellOverride] = useState<ShellOverride | null>(null)
  const [mountedTabs, setMountedTabs] = useState<Set<AppTabId>>(() => new Set())

  const shellVisible = routeShell || shellOverride !== null

  const activeTab = shellOverride?.tab ?? parsedFromUrl.tab
  const workBoardParams = shellOverride?.workBoardParams ?? parsedFromUrl.workBoardParams
  const ficharTab = shellOverride?.ficharTab ?? parsedFromUrl.ficharTab

  useEffect(() => {
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

  useEffect(() => {
    const prefetch = () => {
      void queryClient.prefetchQuery({
        queryKey: dashboardKeys.bootstrap(),
        queryFn: fetchDashboardBootstrap,
        staleTime: 60_000,
      })
      void queryClient.prefetchQuery({
        queryKey: ficharKeys.bootstrap(),
        queryFn: fetchFicharBootstrap,
        staleTime: 60_000,
      })
      void queryClient.prefetchQuery({
        queryKey: workBoardKeys.bootstrap(DEFAULT_WORK_BOARD_PARAMS),
        queryFn: () => fetchWorkBoardBootstrap(DEFAULT_WORK_BOARD_PARAMS),
        staleTime: 60_000,
      })
    }
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(prefetch)
      return () => cancelIdleCallback(id)
    }
    const t = window.setTimeout(prefetch, 0)
    return () => window.clearTimeout(t)
  }, [queryClient])

  const syncUrl = useCallback((tab: AppTabId, opts?: NavigateOpts) => {
    const url = buildAppTabUrl(tab, {
      workBoardParams: opts?.workBoardParams,
      ficharTab: opts?.ficharTab,
    })
    window.history.replaceState(window.history.state, '', url)
  }, [])

  const navigateAppTab = useCallback(
    (tab: AppTabId, opts?: NavigateOpts) => {
      const nextWorkBoard = opts?.workBoardParams ?? (tab === 'workBoard' ? workBoardParams : DEFAULT_WORK_BOARD_PARAMS)
      const nextFicharTab = opts?.ficharTab !== undefined ? opts.ficharTab : tab === 'fichar' ? ficharTab : null

      setShellOverride({
        tab,
        workBoardParams: tab === 'workBoard' ? nextWorkBoard : DEFAULT_WORK_BOARD_PARAMS,
        ficharTab: tab === 'fichar' ? nextFicharTab : null,
      })

      setMountedTabs((prev) => {
        const next = new Set(prev)
        next.add(tab)
        return next
      })

      syncUrl(tab, { workBoardParams: nextWorkBoard, ficharTab: nextFicharTab })

      if (tab === 'workBoard') {
        void queryClient.prefetchQuery({
          queryKey: workBoardKeys.bootstrap(nextWorkBoard),
          queryFn: () => fetchWorkBoardBootstrap(nextWorkBoard),
          staleTime: 60_000,
        })
      }
    },
    [ficharTab, queryClient, syncUrl, workBoardParams]
  )

  const setFicharTab = useCallback(
    (tab: string | null) => {
      if (activeTab !== 'fichar') return
      setShellOverride({
        tab: 'fichar',
        workBoardParams: DEFAULT_WORK_BOARD_PARAMS,
        ficharTab: tab,
      })
      syncUrl('fichar', { ficharTab: tab })
    },
    [activeTab, syncUrl]
  )

  const setWorkBoardParams = useCallback(
    (params: WorkBoardSearchParams) => {
      if (activeTab !== 'workBoard') return
      setShellOverride({
        tab: 'workBoard',
        workBoardParams: params,
        ficharTab: null,
      })
      syncUrl('workBoard', { workBoardParams: params })
      void queryClient.prefetchQuery({
        queryKey: workBoardKeys.bootstrap(params),
        queryFn: () => fetchWorkBoardBootstrap(params),
        staleTime: 60_000,
      })
    },
    [activeTab, queryClient, syncUrl]
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
      navigateAppTab,
      setFicharTab,
      setWorkBoardParams,
      isAppTabActive,
    }),
    [
      displayName,
      shellVisible,
      activeTab,
      workBoardParams,
      ficharTab,
      mountedTabs,
      navigateAppTab,
      setFicharTab,
      setWorkBoardParams,
      isAppTabActive,
    ]
  )

  return <AppTabShellContext.Provider value={value}>{children}</AppTabShellContext.Provider>
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

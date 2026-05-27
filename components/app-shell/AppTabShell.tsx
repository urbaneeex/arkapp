'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { AppAccountPanel } from '@/components/app-shell/panels/AppAccountPanel'

const AppWorkBoardPanel = dynamic(
  () => import('@/components/app-shell/panels/AppWorkBoardPanel').then((m) => m.AppWorkBoardPanel),
  { ssr: false }
)
const AppFicharPanel = dynamic(
  () => import('@/components/app-shell/panels/AppFicharPanel').then((m) => m.AppFicharPanel),
  { ssr: false }
)

export function AppTabShell({ homeSlot }: { homeSlot?: React.ReactNode }) {
  const { activeTab, mountedTabs, accountUser } = useAppTabShell()

  return (
    <div
      className={cn(
        activeTab === 'workBoard' || activeTab === 'fichar'
          ? 'flex h-full min-h-0 flex-col'
          : undefined
      )}
    >
      <div
        className={cn(activeTab === 'home' ? 'block' : 'hidden')}
        aria-hidden={activeTab !== 'home'}
      >
        {mountedTabs.has('home') || activeTab === 'home' ? homeSlot : null}
      </div>
      <div
        className={cn(activeTab === 'workBoard' ? 'flex min-h-0 flex-1 flex-col' : 'hidden')}
        aria-hidden={activeTab !== 'workBoard'}
      >
        {mountedTabs.has('workBoard') || activeTab === 'workBoard' ? <AppWorkBoardPanel /> : null}
      </div>
      <div
        className={cn(activeTab === 'fichar' ? 'block' : 'hidden')}
        aria-hidden={activeTab !== 'fichar'}
      >
        {mountedTabs.has('fichar') || activeTab === 'fichar' ? <AppFicharPanel /> : null}
      </div>
      <div
        className={cn(activeTab === 'account' ? 'block' : 'hidden')}
        aria-hidden={activeTab !== 'account'}
      >
        {accountUser && (mountedTabs.has('account') || activeTab === 'account') ? (
          <AppAccountPanel user={accountUser} />
        ) : null}
      </div>
    </div>
  )
}

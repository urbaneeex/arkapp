'use client'

import { cn } from '@/lib/utils'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { AppHomePanel } from '@/components/app-shell/panels/AppHomePanel'
import { AppWorkBoardPanel } from '@/components/app-shell/panels/AppWorkBoardPanel'
import { AppFicharPanel } from '@/components/app-shell/panels/AppFicharPanel'

export function AppTabShell() {
  const { activeTab, mountedTabs } = useAppTabShell()

  return (
    <div className="min-h-0 flex-1">
      <div
        className={cn(activeTab === 'home' ? 'block' : 'hidden')}
        aria-hidden={activeTab !== 'home'}
      >
        {mountedTabs.has('home') || activeTab === 'home' ? <AppHomePanel /> : null}
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
    </div>
  )
}

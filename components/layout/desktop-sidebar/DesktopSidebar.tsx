'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  DESKTOP_SIDEBAR_NAV,
  DESKTOP_SIDEBAR_WIDTH_PX,
  filterSidebarNavItems,
} from '@/lib/navigation/desktopSidebarNav'
import { usePermissions } from '@/hooks/usePermissions'
import { useSidebarNavStack } from '@/hooks/useSidebarNavStack'
import { useAppTabShellOptional } from '@/components/app-shell/AppTabShellProvider'
import { SidebarBusinessHeader } from './SidebarBusinessHeader'
import { SidebarNavPanel } from './SidebarNavPanel'
import { SidebarUserFooter } from './SidebarUserFooter'

export function DesktopSidebar() {
  const { hasPermission, loading, isOwner } = usePermissions()
  const shell = useAppTabShellOptional()
  const { activeGroupId, openGroup, closeGroup } = useSidebarNavStack()

  const items = useMemo(
    () => filterSidebarNavItems(DESKTOP_SIDEBAR_NAV, { hasPermission, isOwner, loading }),
    [hasPermission, isOwner, loading]
  )

  const user = shell?.accountUser

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-zinc-800 bg-zinc-950 lg:flex'
      )}
      style={{ width: DESKTOP_SIDEBAR_WIDTH_PX }}
    >
      <div className="shrink-0 border-b border-zinc-800 px-3 py-3">
        <SidebarBusinessHeader />
      </div>

      <SidebarNavPanel
        items={items}
        activeGroupId={activeGroupId}
        onOpenGroup={openGroup}
        onCloseGroup={closeGroup}
      />

      {user ? <SidebarUserFooter user={user} /> : null}
    </aside>
  )
}

'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SidebarNavGroup, SidebarNavItem, SidebarNavLeaf } from '@/lib/navigation/desktopSidebarNav'
import { sidebarItemIsActive, sidebarLeafIsActive } from '@/lib/navigation/desktopSidebarNav'
import type { AppTabId } from '@/lib/app-shell/appTabRoutes'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { prefetchAppTabQueries } from '@/lib/app-shell/prefetchAppTabQueries'
import { useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const navIconClass = 'h-[18px] w-[18px] shrink-0'

const rowClass = (active: boolean) =>
  cn(
    'flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-zinc-800/80 text-zinc-100'
      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
  )

function SidebarNavDivider() {
  return <div role="separator" className="my-2 border-t border-zinc-800" aria-hidden />
}

function SidebarNavRowButton({
  label,
  icon: Icon,
  active,
  onClick,
  showChevron,
}: {
  label: string
  icon: SidebarNavLeaf['icon']
  active: boolean
  onClick: () => void
  showChevron?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={rowClass(active)}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={cn(navIconClass, active && 'text-brand')} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {showChevron ? <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-zinc-500" aria-hidden /> : null}
    </button>
  )
}

function navigateSidebarLeaf(
  leaf: SidebarNavLeaf,
  navigateAppTab: ReturnType<typeof useAppTabShell>['navigateAppTab'],
  router: ReturnType<typeof useRouter>,
  queryClient: ReturnType<typeof useQueryClient>
) {
  if (leaf.appTab === 'fichar') {
    void prefetchAppTabQueries(queryClient, 'fichar')
    navigateAppTab('fichar', { ficharTab: leaf.defaultTab ?? 'fichar' })
    return
  }
  if (leaf.appTab) {
    void prefetchAppTabQueries(queryClient, leaf.appTab)
    navigateAppTab(leaf.appTab)
    return
  }
  router.push(leaf.href)
}

function SidebarNavLeafLink({
  leaf,
  active,
}: {
  leaf: SidebarNavLeaf
  active: boolean
}) {
  const queryClient = useQueryClient()
  const { navigateAppTab, isAppTabActive } = useAppTabShell()

  if (leaf.appTab) {
    const tab = leaf.appTab
    const shellActive = isAppTabActive(tab)
    const isActive =
      tab === 'fichar' && leaf.defaultTab ? shellActive && active : shellActive

    return (
      <button
        type="button"
        onPointerDown={() => prefetchAppTabQueries(queryClient, tab)}
        onClick={() => {
          if (tab === 'fichar' && leaf.defaultTab) {
            navigateAppTab('fichar', { ficharTab: leaf.defaultTab })
            return
          }
          navigateAppTab(tab)
        }}
        className={rowClass(isActive)}
        aria-current={isActive ? 'page' : undefined}
      >
        <leaf.icon className={cn(navIconClass, isActive && 'text-brand')} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{leaf.label}</span>
      </button>
    )
  }

  return (
    <Link href={leaf.href} className={rowClass(active)} aria-current={active ? 'page' : undefined}>
      <leaf.icon className={cn(navIconClass, active && 'text-brand')} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{leaf.label}</span>
    </Link>
  )
}

export function SidebarNavPanel({
  items,
  activeGroupId,
  onOpenGroup,
  onCloseGroup,
}: {
  items: SidebarNavItem[]
  activeGroupId: string | null
  onOpenGroup: (groupId: string) => void
  onCloseGroup: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { navigateAppTab, isAppTabActive } = useAppTabShell()

  const handleGroupOpen = (group: SidebarNavGroup) => {
    onOpenGroup(group.id)
    const firstChild = group.children[0]
    if (firstChild) {
      navigateSidebarLeaf(firstChild, navigateAppTab, router, queryClient)
    }
  }

  const activeGroup = activeGroupId
    ? items.find((item): item is SidebarNavGroup => item.kind === 'group' && item.id === activeGroupId)
    : null

  if (activeGroup) {
    return (
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2" aria-label={activeGroup.label}>
        <button
          type="button"
          onClick={onCloseGroup}
          className="mb-2 grid w-full grid-cols-[2rem_1fr_2rem] items-center rounded-lg px-1 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200"
          aria-label={`Volver al menú: ${activeGroup.label}`}
        >
          <ChevronLeft className="mx-auto h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate text-center text-sm font-medium text-zinc-100">
            {activeGroup.label}
          </span>
          <span aria-hidden />
        </button>
        {activeGroup.children.map((child) => {
          const active = sidebarLeafIsActive(pathname, searchParams, child)
          if (child.appTab === 'fichar') {
            return (
              <button
                key={child.id}
                type="button"
                onPointerDown={() => prefetchAppTabQueries(queryClient, 'fichar')}
                onClick={() =>
                  navigateAppTab('fichar', { ficharTab: child.defaultTab ?? 'fichar' })
                }
                className={rowClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <child.icon className={cn(navIconClass, active && 'text-brand')} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-left">{child.label}</span>
              </button>
            )
          }
          return <SidebarNavLeafLink key={child.id} leaf={child} active={active} />
        })}
      </nav>
    )
  }

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2" aria-label="Principal">
      {items.map((item) => {
        const divider = item.dividerAfter ? <SidebarNavDivider /> : null

        if (item.kind === 'group') {
          const active = sidebarItemIsActive(pathname, searchParams, item)
          return (
            <Fragment key={item.id}>
              <SidebarNavRowButton
                label={item.label}
                icon={item.icon}
                active={active}
                showChevron
                onClick={() => handleGroupOpen(item)}
              />
              {divider}
            </Fragment>
          )
        }

        const active = item.appTab
          ? isAppTabActive(item.appTab)
          : sidebarItemIsActive(pathname, searchParams, item)

        if (item.appTab) {
          const tab = item.appTab as AppTabId
          return (
            <Fragment key={item.id}>
              <button
                type="button"
                onPointerDown={() => prefetchAppTabQueries(queryClient, tab)}
                onClick={() => navigateAppTab(tab)}
                className={rowClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className={cn(navIconClass, active && 'text-brand')} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
              </button>
              {divider}
            </Fragment>
          )
        }

        return (
          <Fragment key={item.id}>
            <SidebarNavLeafLink leaf={item} active={active} />
            {divider}
          </Fragment>
        )
      })}
    </nav>
  )
}

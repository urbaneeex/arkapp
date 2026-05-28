'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { sidebarGroupIdForPath } from '@/lib/navigation/desktopSidebarNav'

export function useSidebarNavStack() {
  const pathname = usePathname()
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() =>
    sidebarGroupIdForPath(pathname)
  )
  const userCollapsedRef = useRef(false)
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      userCollapsedRef.current = false
      prevPathRef.current = pathname
    }

    const group = sidebarGroupIdForPath(pathname)
    if (group && !userCollapsedRef.current) {
      setActiveGroupId(group)
    }
  }, [pathname])

  const openGroup = useCallback((groupId: string) => {
    userCollapsedRef.current = false
    setActiveGroupId(groupId)
  }, [])

  const closeGroup = useCallback(() => {
    userCollapsedRef.current = true
    setActiveGroupId(null)
  }, [])

  return { activeGroupId, openGroup, closeGroup }
}

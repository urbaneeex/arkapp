import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const SIDEBAR_STORAGE = 'sidebar-collapsed'

type SidebarStore = {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  toggle: () => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: SIDEBAR_STORAGE }
  )
)

import { create } from 'zustand'

export type BusinessSidebar = {
  name: string
  logo_url: string | null
  plan: string | null
} | null

type BusinessStore = {
  business: BusinessSidebar
  setBusiness: (b: BusinessSidebar) => void
}

export const useBusinessStore = create<BusinessStore>((set) => ({
  business: null,
  setBusiness: (business) => set({ business }),
}))

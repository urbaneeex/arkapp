'use client'

import { useEffect } from 'react'
import { useBusinessStore, type BusinessSidebar } from '@/stores/business'

export function BusinessStoreHydrator({ business }: { business: BusinessSidebar }) {
  const setBusiness = useBusinessStore((s) => s.setBusiness)
  useEffect(() => {
    if (business) setBusiness(business)
  }, [business, setBusiness])
  return null
}

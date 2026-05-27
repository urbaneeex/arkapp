'use client'

import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCompactAppNav } from '@/hooks/useCompactAppNav'
import { MobileStackHeader } from '@/components/layout/MobileStackHeader'
import {
  getMobileOverflowItemForPath,
  hrefWithStackAccount,
} from '@/lib/app-shell/mobileOverflowNav'

export function MobileStackLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const compact = useCompactAppNav()
  const stackAccount = searchParams.get('stack') === 'account'
  const section = getMobileOverflowItemForPath(pathname)

  if (!compact || !stackAccount || !section) {
    return children
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MobileStackHeader
        title={section.label}
        onBack={() => router.push(hrefWithStackAccount('/dashboard?panel=account'))}
      />
      <div
        className={[
          'min-h-0 flex-1',
          '[&_h1.font-display]:sr-only',
          '[&>div>header]:hidden',
          '[&>div>div>header]:hidden',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}

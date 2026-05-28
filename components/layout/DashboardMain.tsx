'use client'

import { usePathname } from 'next/navigation'
import { AppTabShell } from '@/components/app-shell/AppTabShell'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { MobileStackLayout } from '@/components/layout/MobileStackLayout'

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const { shellVisible } = useAppTabShell()
  const pathname = usePathname()
  const isDashboardHome = pathname === '/dashboard'

  return (
    <main className="min-h-0 flex-1 overflow-hidden bg-[#0d0d0d] pb-0 lg:ml-[240px]">
      <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 lg:px-8 lg:pb-0 lg:pt-6">
        {shellVisible ? (
          <AppTabShell homeSlot={isDashboardHome ? children : null} />
        ) : (
          <MobileStackLayout>{children}</MobileStackLayout>
        )}
      </div>
    </main>
  )
}

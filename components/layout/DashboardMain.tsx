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
    <main className="flex-1 min-h-0 overflow-hidden pb-0 transition-[padding] duration-200 ease-out bg-zinc-100 dark:bg-[#0d0d0d] lg:pl-[4.5rem]">
      <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-0 lg:pt-6">
        {shellVisible ? (
          <AppTabShell homeSlot={isDashboardHome ? children : null} />
        ) : (
          <MobileStackLayout>{children}</MobileStackLayout>
        )}
      </div>
    </main>
  )
}

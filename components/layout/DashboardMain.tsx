'use client'

export function DashboardMain({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 min-h-0 overflow-hidden pb-0 transition-[padding] duration-200 ease-out bg-zinc-100 dark:bg-[#0d0d0d] lg:pl-[4.5rem]">
      <div className="h-full min-h-0 flex flex-col overflow-auto px-4 pb-24 pt-2 lg:px-8 lg:pb-0 lg:pt-6">
        {children}
      </div>
    </main>
  )
}

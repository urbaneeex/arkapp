import type { ReactNode } from 'react'

export default function BookLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased">
      <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
    </div>
  )
}

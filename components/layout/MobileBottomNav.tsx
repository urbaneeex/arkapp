'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, LayoutGrid, CirclePlus, Briefcase, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/work-board', label: 'Tablero', icon: LayoutGrid },
  { href: '/dashboard/calendar', label: 'Agenda', icon: CalendarDays },
  { href: '/dashboard/calendar?new=1', label: 'Nueva cita', icon: CirclePlus, featured: true },
  { href: '/dashboard/services', label: 'Servicios', icon: Briefcase },
  { href: '/dashboard/settings', label: 'Cuenta', icon: UserCircle },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    const path = href.split('?')[0]
    return pathname === path || (path !== '/dashboard' && pathname.startsWith(path))
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-6 items-end px-0.5 pt-1 gap-0">
        {items.map(({ href, label, icon: Icon, featured }) => {
          const active = isActive(href)
          if (featured) {
            return (
              <li key={href} className="flex justify-center -mt-4">
                <Link
                  href={href}
                  aria-label={label}
                  className="flex flex-col items-center gap-1 rounded-xl px-2 pb-2 pt-1 text-[11px] font-medium text-brand/80"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/35">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span>{label}</span>
                </Link>
              </li>
            )
          }
          return (
            <li key={href} className="flex justify-center">
              <Link
                href={href}
                aria-label={label}
                className={cn(
                  'flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-brand' : 'text-zinc-400'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'text-brand')} />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

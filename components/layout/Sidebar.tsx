'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Scissors,
  UserCircle,
  Calendar,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/appointments', label: 'Citas', icon: Calendar },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users },
  { href: '/dashboard/services', label: 'Servicios', icon: Scissors },
  { href: '/dashboard/staff', label: 'Empleados', icon: UserCircle },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir menú"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full pt-16 lg:pt-6 pb-4">
          <div className="px-4 py-2 border-b border-gray-100">
            <Link href="/dashboard" className="font-semibold text-gray-900 text-lg">
              Citas CRM
            </Link>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#2563eb] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="px-3 pt-4 border-t border-gray-100">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </>
  )
}

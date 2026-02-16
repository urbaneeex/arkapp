'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  UserCircle,
  Calendar,
  Settings,
  BarChart3,
  DollarSign,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const mainNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/calendar', label: 'Calendario', icon: Calendar },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users },
  { href: '/dashboard/services', label: 'Servicios', icon: Briefcase },
  { href: '/dashboard/staff', label: 'Equipo', icon: UserCircle },
  { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3 },
  { href: '/dashboard/finances', label: 'Finanzas', icon: DollarSign },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [business, setBusiness] = useState<{
    name: string
    logo_url: string | null
    plan: string | null
  } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('businesses')
        .select('name, logo_url, plan')
        .eq('owner_uid', user.id)
        .single()
      setBusiness(data ?? null)
    }
    load()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const planLabel = business?.plan === 'pro' ? 'Pro' : 'Free'

  return (
    <>
      <button
        type="button"
        className="cursor-pointer lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm"
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
          {/* Branding */}
          <div className="p-6 border-b border-gray-200">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 cursor-pointer"
            >
              {business?.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <Avatar
                  name={business?.name ?? 'N'}
                  size="md"
                  className="h-10 w-10 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">
                  {business?.name ?? 'CitasPro'}
                </p>
                <Badge
                  variant={business?.plan === 'pro' ? 'default' : 'secondary'}
                  className="mt-1 text-[10px] px-1.5 py-0"
                >
                  {planLabel}
                </Badge>
              </div>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {mainNavItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href ||
                (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'cursor-pointer flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
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

          <div className="px-3 pt-4 border-t border-gray-200 space-y-1">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className={cn(
                'cursor-pointer flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                pathname.startsWith('/dashboard/settings')
                  ? 'bg-[#2563eb] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Settings className="w-5 h-5 shrink-0" />
              Configuración
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700 cursor-pointer"
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
          className="cursor-pointer fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </>
  )
}

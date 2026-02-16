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
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useBusinessStore } from '@/stores/business'
import { useSidebarStore } from '@/stores/sidebar'
import { Tooltip } from '@/components/ui/tooltip'

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
  const [user, setUser] = useState<{
    email: string
    name?: string
  } | null>(null)
  const business = useBusinessStore((s) => s.business)
  const setBusiness = useBusinessStore((s) => s.setBusiness)
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggle)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) return
      
      setUser({
        email: authUser.email || '',
        name: authUser.user_metadata?.name || authUser.user_metadata?.full_name,
      })

      const { data } = await supabase
        .from('businesses')
        .select('name, logo_url, plan')
        .eq('owner_uid', authUser.id)
        .single()
      setBusiness(data ?? null)
    }
    load()
  }, [supabase, setBusiness])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const planLabel = business?.plan === 'pro' ? 'Pro' : 'Free'
  const isCollapsed = collapsed

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
          'fixed top-0 left-0 z-40 h-full bg-white border-r border-gray-200 transform transition-[width,transform] duration-200 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          'w-64',
          'lg:w-64',
          isCollapsed && 'lg:w-[4.5rem]'
        )}
      >
        {/* Botón anclado al borde derecho del sidebar */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            'hidden lg:flex absolute z-50 top-6 right-0 w-6 h-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer',
            'translate-x-1/2'
          )}
          aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
          title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>

        <div className="flex flex-col h-full pt-16 lg:pt-4 pb-4">
          {/* Branding */}
          <div className="border-b border-gray-200 pb-4">
            <div className={cn('flex items-center', isCollapsed ? 'justify-center px-2' : 'px-4')}>
              {isCollapsed ? (
                <Tooltip content={business?.name ?? 'CitasPro'} className="w-full flex justify-center items-center">
                  <Link
                    href="/dashboard"
                    className="flex cursor-pointer w-full justify-center items-center"
                    aria-label={business?.name ?? 'CitasPro'}
                  >
                    {business?.logo_url ? (
                      <img
                        src={business.logo_url}
                        alt={business.name}
                        className="h-10 w-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <Avatar
                        name={business?.name ?? 'N'}
                        size="md"
                        className="h-10 w-10 shrink-0"
                      />
                    )}
                  </Link>
                </Tooltip>
              ) : (
                <Link
                  href="/dashboard"
                  className="flex cursor-pointer w-full items-center gap-3"
                >
                  {business?.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="h-10 w-10 rounded-full object-cover shrink-0"
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
              )}
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {mainNavItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href ||
                (href !== '/dashboard' && pathname.startsWith(href))
              const linkEl = (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-label={label}
                  className={cn(
                    'cursor-pointer flex items-center justify-center rounded-lg text-sm font-medium transition-colors min-h-[2.25rem]',
                    isCollapsed ? 'px-2 py-2.5' : 'justify-start gap-3 px-3 py-2.5',
                    isActive
                      ? 'bg-[#2563eb] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span>{label}</span>}
                </Link>
              )
              return isCollapsed ? (
                <Tooltip key={href} content={label} className="w-full flex items-center justify-center">
                  {linkEl}
                </Tooltip>
              ) : (
                linkEl
              )
            })}
          </nav>

          <div
            className={cn(
              'pt-4 pb-4 space-y-1 flex flex-col items-stretch',
              'px-3'
            )}
          >
            {isCollapsed ? (
              <Tooltip content="Configuración" className="w-full flex items-center justify-center">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setOpen(false)}
                  aria-label="Configuración"
                  className={cn(
                    'cursor-pointer flex items-center justify-center rounded-lg text-sm font-medium transition-colors min-h-[2.25rem]',
                    'px-2 py-2.5',
                    pathname.startsWith('/dashboard/settings')
                      ? 'bg-[#2563eb] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Settings className="w-5 h-5 shrink-0" />
                </Link>
              </Tooltip>
            ) : (
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
                <span>Configuración</span>
              </Link>
            )}
          </div>

          {/* Usuario activo abajo: solo avatar cuando contraído; con cerrar sesión solo cuando expandido */}
          <div
            className={cn(
              'mt-auto pt-4 border-t border-gray-200',
              isCollapsed ? 'px-2' : 'px-3'
            )}
          >
            {user && (
              <div
                className={cn(
                  'flex items-center',
                  isCollapsed ? 'justify-center w-full' : 'gap-3'
                )}
              >
                {isCollapsed ? (
                  <Tooltip content={user.name || user.email} className="w-full flex justify-center items-center">
                    <span className="flex items-center justify-center">
                      <Avatar
                        name={user.name || user.email}
                        size="md"
                        className="h-10 w-10 shrink-0"
                      />
                    </span>
                  </Tooltip>
                ) : (
                  <>
                    <Avatar
                      name={user.name || user.email}
                      size="md"
                      className="h-10 w-10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user.name || user.email.split('@')[0]}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="cursor-pointer text-gray-500 hover:text-gray-700 hover:bg-gray-100 shrink-0 rounded-lg transition-colors w-8 h-8 flex items-center justify-center"
                      onClick={handleLogout}
                      aria-label="Cerrar sesión"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
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

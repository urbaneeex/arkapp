'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar } from '@/components/ui/avatar'
import { LogOut, User, Globe, Moon, Sun } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

type UserMenuProps = {
  user: {
    email: string
    name?: string
  }
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const supabase = createClient()

  const handleLogout = async () => {
    setOpen(false)
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  const displayName = user.name || user.email?.split('@')[0] || 'Usuario'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-950 hover:ring-zinc-600 transition-shadow"
          aria-label="Abrir menú de usuario"
        >
          <Avatar
            name={displayName}
            size="md"
            className="h-10 w-10 shrink-0"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0 shadow-2xl shadow-black/20 dark:shadow-black/40 overflow-hidden"
      >
        {/* Header: foto, nombre, email */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left gap-4">
            <Avatar
              name={displayName}
              size="lg"
              className="h-14 w-14 shrink-0 ring-2 ring-zinc-300 dark:ring-zinc-700"
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-base">
                {displayName}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="py-2">
          <button
            type="button"
            onClick={handleThemeToggle}
            className="cursor-pointer w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              ) : (
                <Sun className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              )}
              {theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
            </span>
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-md',
                theme === 'dark' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-400'
              )}
            >
              {theme === 'dark' ? 'On' : 'Off'}
            </span>
          </button>
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            Mi perfil
          </Link>
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
            <Globe className="h-4 w-4 text-zinc-500 shrink-0" />
            <span>Idioma: Español 🇪🇸</span>
          </div>
        </div>

        {/* Pie: cerrar sesión */}
        <div className="border-t border-zinc-800 p-2">
          <button
            type="button"
            onClick={handleLogout}
            className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-zinc-100 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

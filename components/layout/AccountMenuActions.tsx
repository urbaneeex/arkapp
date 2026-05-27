'use client'

import Link from 'next/link'
import { Globe, LogOut, Moon, Sun, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'

export type AccountMenuUser = {
  email: string
  name?: string
}

export function AccountMenuUserHeader({
  user,
  businessName,
  compact,
  showEditButton,
  onEdit,
}: {
  user: AccountMenuUser
  businessName?: string
  compact?: boolean
  showEditButton?: boolean
  onEdit?: () => void
}) {
  const displayName = user.name || user.email?.split('@')[0] || 'Usuario'

  return (
    <div
      className={cn(
        'border-b border-zinc-800',
        compact ? 'px-4 py-3' : 'border-zinc-200 p-6 dark:border-zinc-800'
      )}
    >
      <div
        className={cn(
          'flex gap-3',
          compact ? 'items-center' : 'flex-col items-center text-center sm:flex-row sm:items-center sm:text-left'
        )}
      >
        <Avatar
          name={displayName}
          size={compact ? 'md' : 'lg'}
          className={cn('shrink-0', compact ? 'h-10 w-10' : 'h-14 w-14 ring-2 ring-zinc-300 dark:ring-zinc-700')}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate font-bold text-zinc-100',
              compact ? 'text-sm' : 'text-base text-zinc-900 dark:text-zinc-100'
            )}
          >
            {displayName}
          </p>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-zinc-500">{user.email}</p>
            {showEditButton ? (
              <Link
                href="/dashboard/settings?stack=account"
                onClick={() => onEdit?.()}
                className="shrink-0 text-xs font-semibold text-brand transition-colors hover:text-brand-hover"
              >
                Editar
              </Link>
            ) : null}
          </div>
          {!compact && businessName ? (
            <p className="mt-1 truncate text-xs text-zinc-400">
              <span className="font-display font-semibold text-zinc-300">Arkapp</span>
              <span className="font-normal"> x {businessName}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function AccountMenuActions({
  onAction,
  variant = 'popover',
  hideProfileLink = false,
  hideLogout = false,
}: {
  onAction?: () => void
  variant?: 'popover' | 'sheet'
  hideProfileLink?: boolean
  hideLogout?: boolean
}) {
  const { theme, setTheme } = useTheme()

  const rowClass =
    variant === 'sheet'
      ? 'flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm text-zinc-100 transition-colors hover:bg-zinc-800/80'
      : 'flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'

  const linkClass =
    variant === 'sheet'
      ? 'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800/80'
      : 'flex items-center gap-2 px-4 py-3 text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'

  const staticRowClass =
    variant === 'sheet'
      ? 'flex items-center gap-3 px-3 py-3 text-sm text-zinc-500'
      : 'flex items-center gap-2 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400'

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className={variant === 'sheet' ? 'px-2 py-1' : 'py-2'}>
      <button type="button" onClick={handleThemeToggle} className={rowClass}>
        <span className="flex items-center gap-2">
          {theme === 'dark' ? (
            <Moon className="h-4 w-4 text-zinc-400" />
          ) : (
            <Sun className="h-4 w-4 text-zinc-400" />
          )}
          {theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
        </span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-xs font-medium',
            theme === 'dark' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-200 text-zinc-700'
          )}
        >
          {theme === 'dark' ? 'On' : 'Off'}
        </span>
      </button>

      {!hideProfileLink ? (
        <Link href="/dashboard/settings" onClick={() => onAction?.()} className={linkClass}>
          <User className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          Mi perfil
        </Link>
      ) : null}

      <div className={staticRowClass}>
        <Globe className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <span>Idioma: Español 🇪🇸</span>
      </div>

      {!hideLogout ? (
        <div
          className={cn(
            'border-t border-zinc-800',
            variant === 'sheet' ? 'mx-2 mt-1 px-1 pb-2 pt-1' : 'p-2'
          )}
        >
          <AccountMenuLogoutButton variant={variant} onAction={onAction} />
        </div>
      ) : null}
    </div>
  )
}

export function AccountMenuLogoutButton({
  variant = 'sheet',
  onAction,
  className,
}: {
  variant?: 'popover' | 'sheet'
  onAction?: () => void
  className?: string
}) {
  const supabase = createClient()

  const handleLogout = async () => {
    onAction?.()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className={cn(
        variant === 'sheet'
          ? 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-red-950/30 hover:text-red-400'
          : 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-red-950/20 hover:text-red-400',
        className
      )}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      Cerrar sesión
    </button>
  )
}

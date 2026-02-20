'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react'
import { createClient } from '@/lib/supabase/client'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'arkapp-theme'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.classList.remove('dark', 'light')
  html.classList.add(theme)
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getStoredTheme()
    setThemeState(stored)
    applyThemeToDocument(stored)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const supabase = createClient()
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const meta = session?.user?.user_metadata?.theme as string | undefined
      const resolved: Theme = meta === 'light' || meta === 'dark' ? meta : getStoredTheme()
      setThemeState(resolved)
      applyThemeToDocument(resolved)
      try {
        localStorage.setItem(STORAGE_KEY, resolved)
      } catch {}
    }
    load()
  }, [mounted])

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme)
    applyThemeToDocument(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {}
    try {
      const supabase = createClient()
      await supabase.auth.updateUser({
        data: { theme: newTheme },
      })
    } catch (err) {
      console.error('Error saving theme preference:', err)
    }
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme }),
    [theme, setTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    return {
      theme: 'dark',
      setTheme: async () => {},
    }
  }
  return ctx
}

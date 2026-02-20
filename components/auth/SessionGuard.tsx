'use client'

import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const initialUserIdRef = useRef<string | null>(null)
  const [hasSessionConflict, setHasSessionConflict] = useState(false)
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)

  // Mantener el pathname actualizado en el ref para que el listener siempre tenga el valor más reciente
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const handleReload = useCallback(() => {
    window.location.reload()
  }, [])

  const handleGoToLogin = useCallback(() => {
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const setInitialUserIfNeeded = (userId: string | undefined) => {
      if (userId && initialUserIdRef.current === null) {
        initialUserIdRef.current = userId
      }
    }

    // Capturar el user.id inicial al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setInitialUserIfNeeded(session?.user?.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null

      // Si aún no teníamos usuario inicial, guardarlo (p. ej. INITIAL_SESSION)
      if (newUserId && initialUserIdRef.current === null) {
        initialUserIdRef.current = newUserId
        return
      }

      const initial = initialUserIdRef.current
      if (initial === null) return

      // Si estamos en una ruta de autenticación, actualizar el usuario inicial
      // sin activar conflicto (es esperado que la sesión cambie aquí)
      if (pathnameRef.current.startsWith('/auth')) {
        if (newUserId) {
          initialUserIdRef.current = newUserId
        }
        return
      }

      // Si el evento es SIGNED_OUT, es un logout explícito (en esta u otra pestaña)
      // No activamos conflicto para permitir que la redirección normal fluya
      if (event === 'SIGNED_OUT' || !session) {
        // Limpiar el estado para que no interfiera con la redirección
        initialUserIdRef.current = null
        setHasSessionConflict(false)
        return
      }

      // Sesión distinta (otra cuenta) - solo activar conflicto si hay un nuevo usuario
      // (no si la sesión es null, eso ya lo manejamos arriba)
      if (newUserId && newUserId !== initial) {
        setHasSessionConflict(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (hasSessionConflict) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-white">
        <div className="mx-auto max-w-md rounded-xl border border-zinc-600 bg-zinc-900 p-8 shadow-2xl">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-2xl">
              ⚠️
            </div>
          </div>
          <h1 className="mb-3 text-center text-xl font-semibold text-white">
            Sesión modificada
          </h1>
          <p className="mb-8 text-center text-zinc-300">
            Hemos detectado que se ha iniciado sesión con otra cuenta (o se ha
            cerrado sesión) en otra pestaña de este navegador.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleReload}
              className="rounded-lg bg-[#3B82F6] px-6 py-3 font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              Recargar la página
            </button>
            <button
              type="button"
              onClick={handleGoToLogin}
              className="rounded-lg border border-zinc-600 bg-transparent px-6 py-3 font-medium text-zinc-200 transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              Ir al Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

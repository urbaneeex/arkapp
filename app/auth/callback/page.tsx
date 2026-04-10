'use client'

import { useEffect, useState } from 'react'
import { parseOtpType } from '@/lib/auth/otp-types'
import { createClient } from '@/lib/supabase/client'

function storageKeys(searchPlusHash: string) {
  let h = 2166136261
  for (let i = 0; i < searchPlusHash.length; i++) {
    h ^= searchPlusHash.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const id = `supabase_auth_cb_v3_${(h >>> 0).toString(36)}_${searchPlusHash.length}`
  return { result: `${id}:r`, lock: `${id}:l` }
}

type StoredResult = { ok: boolean; next?: string; detail?: string }

function Spinner() {
  return (
    <svg className="h-8 w-8 animate-spin text-[#3b82f6]" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Completando acceso…')

  useEffect(() => {
    const searchPlusHash =
      typeof window !== 'undefined' ? `${window.location.search}${window.location.hash}` : ''
    const { result: RESULT_KEY, lock: LOCK_KEY } = storageKeys(searchPlusHash)

    let pollTimer: ReturnType<typeof setInterval> | null = null
    const NAV_GUARD = `${RESULT_KEY}:nav`

    const stopPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const goLoginFail = (detail?: string) => {
      if (sessionStorage.getItem(NAV_GUARD)) return
      sessionStorage.setItem(NAV_GUARD, '1')
      stopPoll()
      const q = new URLSearchParams({ error: 'auth_callback_failed' })
      if (detail) q.set('detail', detail.slice(0, 500))
      window.location.replace(`${window.location.origin}/login?${q.toString()}`)
    }

    const goSuccess = (nextPath: string) => {
      if (sessionStorage.getItem(NAV_GUARD)) return
      sessionStorage.setItem(NAV_GUARD, '1')
      stopPoll()
      setMessage('Redirigiendo…')
      // Navegación completa: el middleware debe ver las cookies de sesión (evita bucle con router.replace).
      window.location.assign(new URL(nextPath, window.location.origin).toString())
    }

    const applyStored = (raw: string) => {
      try {
        const j = JSON.parse(raw) as StoredResult
        if (j.ok && j.next) goSuccess(j.next)
        else goLoginFail(j.detail)
      } catch {
        goLoginFail()
      }
    }

    const existing = sessionStorage.getItem(RESULT_KEY)
    if (existing) {
      applyStored(existing)
      return
    }

    const claim = crypto.randomUUID()
    if (!sessionStorage.getItem(LOCK_KEY)) {
      sessionStorage.setItem(LOCK_KEY, claim)
    }
    const holder = sessionStorage.getItem(LOCK_KEY)

    if (holder !== claim) {
      let ticks = 0
      pollTimer = setInterval(() => {
        ticks++
        const r = sessionStorage.getItem(RESULT_KEY)
        if (r) {
          applyStored(r)
          return
        }
        if (ticks > 600) {
          stopPoll()
          sessionStorage.removeItem(LOCK_KEY)
          if (!sessionStorage.getItem(NAV_GUARD)) {
            goLoginFail(
              'Tiempo de espera agotado. Si ya confirmaste el correo, prueba a iniciar sesión con tu email y contraseña.'
            )
          }
        }
      }, 50)
      return () => stopPoll()
    }

    void (async () => {
      const supabase = createClient()
      const url = new URL(window.location.href)

      const writeResult = (payload: StoredResult) => {
        sessionStorage.setItem(RESULT_KEY, JSON.stringify(payload))
        sessionStorage.removeItem(LOCK_KEY)
      }

      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const queryErr = url.searchParams.get('error')
        const hashErr = hashParams.get('error')
        if (queryErr || hashErr) {
          const desc =
            url.searchParams.get('error_description') ||
            hashParams.get('error_description') ||
            url.searchParams.get('error_code') ||
            hashParams.get('error_code') ||
            queryErr ||
            hashErr ||
            ''
          const human = desc.replace(/\+/g, ' ').slice(0, 400)
          writeResult({
            ok: false,
            detail:
              human ||
              'El enlace de confirmación no es válido. Pide un correo nuevo o inicia sesión si ya confirmaste.',
          })
          applyStored(sessionStorage.getItem(RESULT_KEY)!)
          return
        }

        const pickUserId = async (): Promise<string | null> => {
          const { data: s1 } = await supabase.auth.getSession()
          if (s1.session?.user?.id) return s1.session.user.id
          const { data: u1 } = await supabase.auth.getUser()
          if (u1.user?.id) return u1.user.id
          return null
        }

        let userId = await pickUserId()

        const code = url.searchParams.get('code')
        const tokenHash = url.searchParams.get('token_hash')
        const token = url.searchParams.get('token')
        const email = url.searchParams.get('email')
        const otpType = parseOtpType(url.searchParams.get('type'))

        if (!userId && window.location.hash) {
          const access_token = hashParams.get('access_token')
          const refresh_token = hashParams.get('refresh_token')
          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (!error && data.user) userId = data.user.id
          }
        }

        if (!userId && tokenHash && otpType) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          })
          if (!error && data.user) userId = data.user.id
        }

        if (!userId && token && email && otpType) {
          const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: otpType,
          })
          if (!error && data.user) userId = data.user.id
        }

        if (!userId && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error && data.user) userId = data.user.id
        }

        if (!userId) {
          await new Promise((r) => setTimeout(r, 250))
          userId = await pickUserId()
        }

        if (!userId) {
          writeResult({
            ok: false,
            detail:
              'No se pudo validar el enlace. Pide un nuevo correo de confirmación o inicia sesión si la cuenta ya está activa.',
          })
          applyStored(sessionStorage.getItem(RESULT_KEY)!)
          return
        }

        const { data: existingBusiness } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_uid', userId)
          .maybeSingle()

        const nextPath = existingBusiness?.id ? '/dashboard' : '/onboarding'

        if (!existingBusiness?.id) {
          try {
            await fetch('/api/auth/post-auth-welcome', {
              method: 'POST',
              credentials: 'same-origin',
            })
          } catch {
            /* opcional */
          }
        }

        writeResult({ ok: true, next: nextPath })
        applyStored(sessionStorage.getItem(RESULT_KEY)!)
      } catch {
        writeResult({ ok: false, detail: 'Error inesperado al confirmar el acceso.' })
        applyStored(sessionStorage.getItem(RESULT_KEY)!)
      }
    })()

    return () => {
      stopPoll()
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-[#8e8e93]">
      <Spinner />
      <p className="text-sm">{message}</p>
    </div>
  )
}

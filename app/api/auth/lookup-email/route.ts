import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  fetchAuthUserByEmailForLookup,
  resolveEmailAuthStatus,
  type EmailAuthLookupStatus,
} from '@/lib/auth-lookup-email.server'
import { allowEmailLookupRequest } from '@/lib/email-lookup-rate-limit.server'

function clientKey(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

type Body = { email?: string }

export async function POST(request: NextRequest) {
  const start = Date.now()
  try {
    const key = clientKey(request)
    if (!allowEmailLookupRequest(key)) {
      await sleep(300)
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    let body: Body
    try {
      body = await request.json()
    } catch {
      await sleep(200)
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
    }

    const raw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!raw || !raw.includes('@')) {
      await sleep(200)
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !url) {
      console.error('[lookup-email] Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL')
      await sleep(300)
      return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const user = await fetchAuthUserByEmailForLookup(admin, raw)

    const minWait = 280
    const elapsed = Date.now() - start
    if (elapsed < minWait) await sleep(minWait - elapsed + Math.random() * 120)

    let status: EmailAuthLookupStatus
    if (!user) {
      status = 'new'
    } else {
      status = resolveEmailAuthStatus(user) === 'password' ? 'password' : 'google_only'
    }

    return NextResponse.json({ ok: true, status })
  } catch (e) {
    console.error('[lookup-email]', e)
    await sleep(250)
    return NextResponse.json({ ok: false, error: 'unknown' }, { status: 500 })
  }
}

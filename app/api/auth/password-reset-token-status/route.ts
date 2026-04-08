import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashPasswordResetToken } from '@/lib/password-reset.server'

export type PasswordResetTokenStatus = 'valid' | 'used' | 'expired' | 'invalid'

/**
 * GET ?token= (64 hex) — solo lectura; no consume el token.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim() ?? ''
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ status: 'invalid' satisfies PasswordResetTokenStatus })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !url) {
      return NextResponse.json({ status: 'invalid' satisfies PasswordResetTokenStatus })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const tokenHash = hashPasswordResetToken(token)
    const { data: row, error } = await admin
      .from('password_reset_tokens')
      .select('used_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ status: 'invalid' satisfies PasswordResetTokenStatus })
    }

    const now = Date.now()
    const expires = new Date(row.expires_at).getTime()
    if (Number.isFinite(expires) && expires <= now) {
      return NextResponse.json({ status: 'expired' satisfies PasswordResetTokenStatus })
    }

    if (row.used_at != null) {
      return NextResponse.json({ status: 'used' satisfies PasswordResetTokenStatus })
    }

    return NextResponse.json({ status: 'valid' satisfies PasswordResetTokenStatus })
  } catch (e) {
    console.error('[password-reset-token-status]', e)
    return NextResponse.json({ status: 'invalid' satisfies PasswordResetTokenStatus })
  }
}

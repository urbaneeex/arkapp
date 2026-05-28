import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import {
  buildEmailVerificationEmail,
  buildEmailVerificationVerifyUrl,
} from '@/lib/emails/email-verification-request'
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from '@/lib/password-reset.server'

import { getResendFromEmail } from '@/lib/emails/resend-config'

const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX_PER_WINDOW = 10
const buckets = new Map<string, { count: number; resetAt: number }>()

/** Rate limit por IP para registro y reenvío de verificación de email. */
export function allowEmailVerificationRequest(key: string): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (b.count >= RATE_MAX_PER_WINDOW) return false
  b.count += 1
  return true
}

export const EMAIL_VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000

export function createEmailVerificationPlainToken(): string {
  return generatePasswordResetToken()
}

export function hashEmailVerificationToken(plain: string): string {
  return hashPasswordResetToken(plain)
}

export async function invalidateEmailVerificationTokens(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  await admin
    .from('email_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)
}

/** Invalida tokens anteriores, crea uno nuevo y envía el correo por Resend. */
export async function sendEmailVerificationMessage(
  admin: SupabaseClient,
  userId: string,
  toEmail: string
): Promise<boolean> {
  await invalidateEmailVerificationTokens(admin, userId)
  const plain = createEmailVerificationPlainToken()
  const tokenHash = hashEmailVerificationToken(plain)
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRY_MS).toISOString()

  const { error: insertErr } = await admin.from('email_verification_tokens').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })

  if (insertErr) {
    console.error('[email-verification] insert', insertErr)
    return false
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[email-verification] RESEND_API_KEY no configurada')
    return false
  }

  const verifyUrl = buildEmailVerificationVerifyUrl(plain)
  const { subject, html } = buildEmailVerificationEmail({ verifyUrl })
  const resend = new Resend(apiKey)
  const { error: sendErr } = await resend.emails.send({
    from: getResendFromEmail(),
    to: toEmail,
    subject,
    html,
  })

  if (sendErr) {
    console.error('[email-verification] Resend', sendErr)
    return false
  }

  return true
}

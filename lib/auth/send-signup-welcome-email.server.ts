import type { SupabaseClient, User } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isEmailValidForSending } from '@/lib/email'
import { buildWelcomeEmailHtml } from '@/lib/emails/welcome-after-signup'
import { createServiceRoleClient } from '@/lib/supabase/admin'

import { getResendFromEmail } from '@/lib/emails/resend-config'

/** Evita reenvíos si ya se mandó el correo de alta de titular. */
const WELCOME_SENT_META_KEY = 'signup_welcome_sent_at'

function tryServiceRoleClient(): SupabaseClient | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

/** Empleado invitado: tiene fila staff por uid o email (no es flujo «solo titular onboarding»). */
async function userHasStaffMembership(
  db: SupabaseClient,
  userId: string,
  email: string
): Promise<boolean> {
  const { data: byId } = await db
    .from('staff')
    .select('id')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (byId?.id) return true

  const normalized = email.trim()
  if (!normalized) return false

  const { data: byEmail } = await db
    .from('staff')
    .select('id')
    .eq('email', normalized)
    .is('deleted_at', null)
    .maybeSingle()

  return Boolean(byEmail?.id)
}

async function markWelcomeEmailSent(userId: string): Promise<void> {
  const admin = tryServiceRoleClient()
  if (!admin) return

  try {
    const { data: fetched, error: getErr } = await admin.auth.admin.getUserById(userId)
    if (getErr || !fetched.user) return

    const meta = { ...(fetched.user.user_metadata ?? {}) }
    if (meta[WELCOME_SENT_META_KEY]) return

    meta[WELCOME_SENT_META_KEY] = new Date().toISOString()
    const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: meta,
    })
    if (upErr) console.error('[sendSignupWelcomeEmail] updateUser metadata', upErr)
  } catch (e) {
    console.error('[sendSignupWelcomeEmail] markWelcomeEmailSent', e)
  }
}

async function sendWelcomeIfNewBusiness(
  client: SupabaseClient,
  userId: string,
  email: string,
  userMetadata: User['user_metadata'],
  origin: string
): Promise<void> {
  const { data: existingBusiness } = await client
    .from('businesses')
    .select('id')
    .eq('owner_uid', userId)
    .maybeSingle()

  if (existingBusiness?.id) return

  if (userMetadata?.role === 'staff') return

  if (userMetadata && typeof userMetadata[WELCOME_SENT_META_KEY] === 'string') return

  const dbStaff = tryServiceRoleClient() ?? client
  if (await userHasStaffMembership(dbStaff, userId, email)) return

  if (!isEmailValidForSending(email)) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  try {
    const resend = new Resend(apiKey)
    const firstName =
      (userMetadata?.full_name as string | undefined)?.split(' ')[0] ?? 'bienvenido'
    await resend.emails.send({
      from: getResendFromEmail(),
      to: email,
      subject: '¡Bienvenido a Arkapp! 🎉',
      html: buildWelcomeEmailHtml(firstName, origin),
    })
    await markWelcomeEmailSent(userId)
  } catch (e) {
    console.error('[sendSignupWelcomeEmail]', e)
  }
}

/**
 * Tras confirmar email (cliente con sesión), envía bienvenida si aplica.
 */
export async function sendSignupWelcomeEmailIfNeeded(
  supabase: SupabaseClient,
  origin: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return
  await sendWelcomeIfNewBusiness(supabase, user.id, user.email, user.user_metadata, origin)
}

/**
 * Tras confirmar email vía Admin (sin cookies de sesión), envía bienvenida si aplica.
 */
export async function sendSignupWelcomeEmailIfNeededForUser(
  admin: SupabaseClient,
  user: User,
  origin: string
): Promise<void> {
  if (!user.email) return
  await sendWelcomeIfNewBusiness(admin, user.id, user.email, user.user_metadata, origin)
}

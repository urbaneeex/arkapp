import type { SupabaseClient, User } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isEmailValidForSending } from '@/lib/email'
import { buildWelcomeEmailHtml } from '@/lib/emails/welcome-after-signup'

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Arkapp <hello@arkapp.es>'

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
  if (!isEmailValidForSending(email)) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  try {
    const resend = new Resend(apiKey)
    const firstName =
      (userMetadata?.full_name as string | undefined)?.split(' ')[0] ?? 'bienvenido'
    await resend.emails.send({
      from: RESEND_FROM,
      to: email,
      subject: '¡Bienvenido a Arkapp! 🎉',
      html: buildWelcomeEmailHtml(firstName, origin),
    })
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

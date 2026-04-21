import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof process.env.VERCEL_URL === 'string' && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000')

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Arkapp <hello@arkapp.es>'

function buildInviteEmailHtml(name: string, inviteUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <h1 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #18181b;">
          Te han invitado al equipo
        </h1>
        <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #3f3f46;">
          Hola <strong>${name}</strong>,
        </p>
        <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.6; color: #3f3f46;">
          Has sido invitado a unirte al sistema de gestión. Pulsa el botón para crear tu contraseña y acceder a tu cuenta.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
          <tr>
            <td style="border-radius: 8px; background-color: #2563eb;">
              <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                Aceptar invitación y crear contraseña
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 28px 0 0 0; font-size: 14px; line-height: 1.5; color: #71717a;">
          El enlace expira en 24 horas. Si no has solicitado esta invitación, puedes ignorar este correo.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export async function POST(request: NextRequest) {
  try {
    // ── Autenticación: solo usuarios autenticados pueden invitar ────────────
    const supabaseUser = await createServerClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name, staff_id: bodyStaffId } = body

    if (!email || !name) {
      return NextResponse.json({ error: 'Email y nombre son requeridos' }, { status: 400 })
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY no está configurada')
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta. Contacta al administrador.' },
        { status: 500 }
      )
    }

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('RESEND_API_KEY no está configurada')
      return NextResponse.json(
        { error: 'Configuración de email incompleta. Contacta al administrador.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    let staffId = bodyStaffId
    if (!staffId) {
      const { data: staffRow, error: staffError } = await supabaseAdmin
        .from('staff')
        .select('id, business_id')
        .eq('email', email)
        .single()
      if (staffError || !staffRow) {
        return NextResponse.json(
          { error: 'No se encontró ningún empleado con ese email. Crea primero el empleado.' },
          { status: 400 }
        )
      }
      staffId = staffRow.id

      // ── Verificar que el usuario autenticado es owner del negocio ─────────
      const { data: ownerCheck } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('id', staffRow.business_id)
        .eq('owner_uid', user.id)
        .maybeSingle()
      if (!ownerCheck) {
        return NextResponse.json({ error: 'Sin permisos para invitar a este negocio' }, { status: 403 })
      }
    }

    await supabaseAdmin
      .from('staff_invites')
      .update({ used: true })
      .eq('staff_id', staffId)

    const inviteToken = randomUUID()
    // Token válido 48 horas (reducido desde 7 días por seguridad)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    const { error: insertError } = await supabaseAdmin.from('staff_invites').insert({
      staff_id: staffId,
      invite_token: inviteToken,
      email,
      expires_at: expiresAt.toISOString(),
      used: false,
    })

    if (insertError) {
      console.error('Error creando invitación:', insertError)
      return NextResponse.json({ error: 'Error al crear la invitación' }, { status: 500 })
    }

    const inviteUrl = `${SITE_URL}/auth/accept-invite?token=${inviteToken}`

    const resend = new Resend(resendApiKey)

    try {
      const { data: sendData, error: sendError } = await resend.emails.send({
        from: RESEND_FROM,
        to: email,
        subject: 'Invitación para unirte al equipo',
        html: buildInviteEmailHtml(name, inviteUrl),
      })

      if (sendError) {
        console.error('Resend error:', { message: sendError.message, name: sendError.name })
        return NextResponse.json({ error: 'Error al enviar el correo de invitación' }, { status: 500 })
      }
    } catch (err) {
      console.error('Error enviando email con Resend:', err)
      return NextResponse.json({ error: 'Error al enviar el correo de invitación' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error en API de invitación:', error)
    return NextResponse.json({ error: 'Error al crear la invitación' }, { status: 500 })
  }
}

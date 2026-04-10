import { SITE_URL } from './site-url'
import { actionButton, baseLayout } from './layout'

export function buildEmailVerificationEmail(params: { verifyUrl: string }): { subject: string; html: string } {
  return {
    subject: 'Confirma tu correo en Arkapp',
    html: baseLayout(`
      <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;">
        Gracias por registrarte en <strong>Arkapp</strong>. Confirma que este correo es tuyo para activar tu cuenta.
      </p>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#3f3f46;">
        Si no creaste una cuenta, ignora este mensaje. El enlace caduca en 24 horas.
      </p>
      ${actionButton('Confirmar correo', params.verifyUrl)}
      <p style="margin:16px 0 0 0;font-size:13px;color:#71717a;word-break:break-all;">
        Si el botón no funciona, copia y pega esta URL en el navegador:<br/>
        <span style="color:#3b82f6;">${params.verifyUrl}</span>
      </p>
    `),
  }
}

export function buildEmailVerificationVerifyUrl(plainToken: string): string {
  return `${SITE_URL.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(plainToken)}`
}

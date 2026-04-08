import { SITE_URL } from './site-url'
import { actionButton, baseLayout } from './layout'

export function buildPasswordResetEmail(params: { resetUrl: string }): { subject: string; html: string } {
  return {
    subject: 'Restablece tu contraseña en Arkapp',
    html: baseLayout(`
      <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;">
        Has solicitado restablecer la contraseña de tu cuenta en <strong>Arkapp</strong>.
      </p>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#3f3f46;">
        Si no fuiste tú, ignora este mensaje. El enlace caduca en una hora.
      </p>
      ${actionButton('Elegir nueva contraseña', params.resetUrl)}
      <p style="margin:16px 0 0 0;font-size:13px;color:#71717a;word-break:break-all;">
        Si el botón no funciona, copia y pega esta URL en el navegador:<br/>
        <span style="color:#3b82f6;">${params.resetUrl}</span>
      </p>
    `),
  }
}

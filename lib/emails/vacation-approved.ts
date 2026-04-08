import { SITE_URL } from './site-url'
import { actionButton, baseLayout } from './layout'

/** Email al empleado: vacación aprobada, pendiente de confirmar */
export function buildVacationApprovedEmail(params: {
  employeeName: string
  startDate: string
  endDate: string
  businessName: string
}): { subject: string; html: string } {
  const url = `${SITE_URL}/dashboard/fichar`
  return {
    subject: `Tu solicitud de vacaciones fue aprobada — confírmala`,
    html: baseLayout(`
      <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;">
        Hola <strong>${params.employeeName}</strong>,
      </p>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#3f3f46;">
        Tu solicitud de vacaciones en <strong>${params.businessName}</strong> ha sido <strong style="color:#16a34a;">aprobada</strong>:
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:0 0 16px 0;">
        <p style="margin:0;font-size:15px;color:#15803d;">
          <strong>Del ${params.startDate} al ${params.endDate}</strong>
        </p>
      </div>
      <p style="margin:0 0 4px 0;font-size:14px;color:#71717a;">
        Accede a tu portal para confirmar que has recibido la notificación.
      </p>
      ${actionButton('Confirmar vacaciones', url)}
    `),
  }
}

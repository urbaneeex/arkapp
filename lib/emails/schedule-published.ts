import { SITE_URL } from './site-url'
import { actionButton, baseLayout } from './layout'

/** Email al empleado: horario recurrente publicado, pendiente de confirmar */
export function buildSchedulePublishedEmail(params: {
  employeeName: string
  businessName: string
  scheduleDescription: string
}): { subject: string; html: string } {
  const url = `${SITE_URL}/dashboard/fichar`
  return {
    subject: `Tu horario ha sido actualizado — revísalo y confírmalo`,
    html: baseLayout(`
      <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;">
        Hola <strong>${params.employeeName}</strong>,
      </p>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#3f3f46;">
        <strong>${params.businessName}</strong> ha publicado un nuevo horario recurrente para ti:
      </p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:0 0 16px 0;">
        <p style="margin:0;font-size:14px;color:#1d4ed8;">${params.scheduleDescription}</p>
      </div>
      <p style="margin:0 0 4px 0;font-size:14px;color:#71717a;">
        Revisa tu horario y confírmalo desde tu portal de empleado.
      </p>
      ${actionButton('Ver y confirmar horario', url)}
    `),
  }
}

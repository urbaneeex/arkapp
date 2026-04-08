import { SITE_URL } from './site-url'
import { actionButton, baseLayout } from './layout'

/** Email al empleado: hay un documento pendiente de firma */
export function buildDocumentSignatureRequestEmail(params: {
  employeeName: string
  documentTitle: string
  uploaderName: string
  businessName: string
}): { subject: string; html: string } {
  const url = `${SITE_URL}/dashboard/fichar`
  return {
    subject: `Tienes un documento pendiente de firma — ${params.documentTitle}`,
    html: baseLayout(`
      <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;">
        Hola <strong>${params.employeeName}</strong>,
      </p>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#3f3f46;">
        <strong>${params.uploaderName}</strong> de <strong>${params.businessName}</strong> ha subido un documento que necesita tu firma:
      </p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;margin:0 0 16px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#18181b;">${params.documentTitle}</p>
      </div>
      <p style="margin:0 0 4px 0;font-size:14px;color:#71717a;">
        Accede a tu portal de empleado para revisar el documento y firmarlo.
      </p>
      ${actionButton('Revisar y firmar', url)}
    `),
  }
}

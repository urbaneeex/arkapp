import { SITE_URL } from './site-url'
import { actionButton, baseLayout } from './layout'

/** Email al manager: un empleado ha firmado un documento */
export function buildDocumentSignedEmail(params: {
  managerName: string
  employeeName: string
  documentTitle: string
  signedAt: string
}): { subject: string; html: string } {
  const url = `${SITE_URL}/dashboard/staff`
  return {
    subject: `${params.employeeName} ha firmado "${params.documentTitle}"`,
    html: baseLayout(`
      <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;">
        Hola <strong>${params.managerName}</strong>,
      </p>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#3f3f46;">
        <strong>${params.employeeName}</strong> ha firmado el documento <strong>"${params.documentTitle}"</strong>.
      </p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;margin:0 0 16px 0;">
        <p style="margin:0;font-size:13px;color:#71717a;">Firmado el ${params.signedAt}</p>
      </div>
      ${actionButton('Ver en panel de equipo', url)}
    `),
  }
}

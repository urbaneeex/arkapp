const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <p style="margin:0 0 24px 0;font-size:20px;font-weight:700;color:#18181b;">Arkapp</p>
        ${content}
        <p style="margin:28px 0 0 0;font-size:13px;color:#a1a1aa;">Arkapp — Sistema de gestión para empresas</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function actionButton(text: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:8px;background-color:#2563eb;">
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${text}</a>
      </td>
    </tr>
  </table>`
}

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

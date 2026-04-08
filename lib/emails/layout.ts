export function baseLayout(content: string): string {
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

export function actionButton(text: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:8px;background-color:#2563eb;">
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${text}</a>
      </td>
    </tr>
  </table>`
}

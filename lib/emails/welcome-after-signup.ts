export function buildWelcomeEmailHtml(firstName: string, origin: string): string {
  const safeName = firstName.replace(/[&<>"']/g, '')
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,
  'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
    style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px;
        box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 24px 0;font-size:22px;font-weight:600;
          color:#18181b;">
          ¡Hola, ${safeName}! 👋
        </h1>
        <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;
          color:#3f3f46;">
          Tu cuenta en <strong>Arkapp</strong> está lista.
        </p>
        <p style="margin:0 0 28px 0;font-size:16px;line-height:1.6;
          color:#3f3f46;">
          Ya puedes gestionar tus citas, empleados y empezar a 
          automatizar tu negocio desde el panel.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="border-radius:8px;background-color:#2563eb;">
              <a href="${origin}/dashboard"
                target="_blank" rel="noopener noreferrer"
                style="display:inline-block;padding:14px 28px;
                  font-size:16px;font-weight:600;color:#ffffff;
                  text-decoration:none;">
                Ir a mi panel →
              </a>
            </td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e5ea;margin:32px 0;">
        <p style="margin:0;font-size:13px;color:#71717a;">
          El equipo de Arkapp ·
          <a href="${origin}" style="color:#2563eb;text-decoration:none;">
            arkapp.es
          </a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

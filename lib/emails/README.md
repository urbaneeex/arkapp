# Plantillas de correo (Resend)

Los HTML que envía la aplicación con **Resend** viven en esta carpeta, un archivo por tipo de mensaje. Las rutas API importan `@/lib/email-templates`, que reexporta desde aquí.

## Recuperación de contraseña (flujo Arkapp)

El enlace «¿Olvidaste tu contraseña?» en la app usa **`POST /api/auth/request-password-reset`**, guarda un token hasheado en la tabla **`password_reset_tokens`** y envía el correo con la plantilla [`password-reset-request.ts`](password-reset-request.ts). El enlace del correo apunta solo a tu **`NEXT_PUBLIC_SITE_URL`** (p. ej. `/reset-password?token=...`), no a `supabase.co`.

Aplica la migración SQL en Supabase antes de usarlo: [`supabase/migrations/20260407120000_password_reset_tokens.sql`](../../supabase/migrations/20260407120000_password_reset_tokens.sql).

## Qué sigue en el panel de Supabase

Otros correos de **Supabase Auth** (confirmación de cuenta, magic link, etc.) siguen configurándose en el proyecto de Supabase.

## Limitación: `resetPasswordForEmail` nativo

La **anon key** es pública en el cliente. Cualquiera podría llamar a `supabase.auth.resetPasswordForEmail` contra tu proyecto y disparar el correo **nativo** de Supabase (enlace `*.supabase.co`), aunque tu UI ya no lo use.

**Mitigaciones prácticas:** en Supabase sube los **rate limits** de Authentication; en la plantilla SMTP de «Reset password» indica que el canal oficial es la app; monitoriza abusos. Una mitigación fuerte sería Auth Hook o restricciones que tu plan permita.

## Entregabilidad (otros correos y SMTP)

1. **Dominio en Resend**: verificado; remitente `no-reply@tudominio.com` alineado con `RESEND_FROM_EMAIL`.
2. **Supabase → Authentication → SMTP**: mismo proveedor si quieres coherencia en el resto de plantillas Auth.
3. **DNS**: **SPF**, **DKIM** y **DMARC** según Resend.
4. **Redirect URLs** y **Site URL** correctos para flujos que sigan pasando por Supabase.

Variable útil: `NEXT_PUBLIC_SITE_URL` (también alimenta `SITE_URL` en las plantillas).

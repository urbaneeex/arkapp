# Plantillas de correo (Resend)

Los HTML que envía la aplicación con **Resend** viven en esta carpeta, un archivo por tipo de mensaje. Las rutas API importan `@/lib/email-templates`, que reexporta desde aquí.

## Recuperación de contraseña (flujo Arkapp)

El enlace «¿Olvidaste tu contraseña?» en la app usa **`POST /api/auth/request-password-reset`**, guarda un token hasheado en la tabla **`password_reset_tokens`** y envía el correo con la plantilla [`password-reset-request.ts`](password-reset-request.ts). El enlace del correo apunta solo a tu **`NEXT_PUBLIC_SITE_URL`** (p. ej. `/reset-password?token=...`), no a `supabase.co`.

Aplica la migración SQL en Supabase antes de usarlo: [`supabase/migrations/20260407120000_password_reset_tokens.sql`](../../supabase/migrations/20260407120000_password_reset_tokens.sql).

## Confirmación de cuenta (registro con email y contraseña)

El alta **no** usa el correo de confirmación de Supabase. Flujo:

1. **`POST /api/auth/register`**: crea el usuario con la **Admin API** (`email_confirm: false`), guarda un token en **`email_verification_tokens`** y envía el correo con [`email-verification-request.ts`](email-verification-request.ts). El enlace es `{NEXT_PUBLIC_SITE_URL}/auth/verify-email?token=...` (mismo dominio que el remitente en Resend, mejor entregabilidad).

2. **`GET /auth/verify-email`**: valida el token, marca el email confirmado en Supabase y redirige al login.

3. **`POST /api/auth/resend-signup`**: reenvía ese mismo correo (tokens + Resend).

Migración: [`supabase/migrations/20260408120000_email_verification_tokens.sql`](../../supabase/migrations/20260408120000_email_verification_tokens.sql).

Requiere **`RESEND_API_KEY`**, **`SUPABASE_SERVICE_ROLE_KEY`** y **`NEXT_PUBLIC_SITE_URL`** coherente con la URL pública.

## Panel de Supabase (Auth)

- **Confirm email** (Authentication → Providers → Email): puedes dejarlo **activado**; el envío automático de Gotrue aplica sobre todo a **`signUp` del cliente**, y el registro por contraseña ya pasa solo por **`/api/auth/register`** (Admin API), sin disparar ese correo.

- Si apareciera **un segundo correo** de confirmación: revisa si tienes **SMTP personalizado en Supabase** además de Resend en la app (duplicidad). Ajusta para que solo un canal envíe la confirmación.

- **Redirect URLs**: incluye **`{SITE_URL}/auth/confirm`** (Google OAuth y confirmación en servidor). Mantén **`{SITE_URL}/auth/callback`** para el fallback con **hash** que envía `/auth/confirm` al cliente. El registro con email usa **`/auth/verify-email`**.

## Otros correos de Supabase Auth

Magic link u otros flujos que sigan usando el cliente de Supabase pueden seguir configurándose en el proyecto de Supabase.

## Limitación: `resetPasswordForEmail` nativo

La **anon key** es pública en el cliente. Cualquiera podría llamar a `supabase.auth.resetPasswordForEmail` contra tu proyecto y disparar el correo **nativo** de Supabase (enlace `*.supabase.co`), aunque tu UI ya no lo use.

**Mitigaciones prácticas:** en Supabase sube los **rate limits** de Authentication; en la plantilla SMTP de «Reset password» indica que el canal oficial es la app; monitoriza abusos. Una mitigación fuerte sería Auth Hook o restricciones que tu plan permita.

## Entregabilidad (Resend y DNS)

1. **Dominio en Resend**: verificado; remitente alineado con `RESEND_FROM_EMAIL`.
2. **DNS**: **SPF**, **DKIM** y **DMARC** según Resend.
3. **Redirect URLs** y **Site URL** correctos para OAuth y rutas legacy.

Variable útil: `NEXT_PUBLIC_SITE_URL` (también alimenta `SITE_URL` en las plantillas).

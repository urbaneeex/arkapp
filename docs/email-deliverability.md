# Entregabilidad de correo (Resend + arkapp.es)

Correos transaccionales (invitaciones, reset, verificación) salen **solo desde la app** vía **Resend**, no desde Supabase Auth.

## Variables en Vercel (Production)

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Arkapp <hello@arkapp.es>
NEXT_PUBLIC_SITE_URL=https://partners.arkapp.es
```

- `RESEND_FROM_EMAIL`: dirección del **dominio verificado** en Resend (`@arkapp.es`).
- `NEXT_PUBLIC_SITE_URL`: dominio de los enlaces del correo (partners). No afecta SPF/DKIM, pero mejora confianza si coincide con tu marca.

## Cloudflare Email Routing (foto 2)

Solo afecta **correo entrante** (`hello@arkapp.es` → Gmail). **No envía** invitaciones. Puedes dejarlo activo.

## DNS en Cloudflare — checklist (arkapp.es)

Resend usa subdominio **`send`** como Return-Path (MAIL FROM). Requiere **SPF + DKIM**; DMARC opcional pero recomendado.

### 1. DKIM — CRÍTICO: un solo registro

En DNS hay **dos** TXT en `resend._domainkey.arkapp.es`. Eso rompe DKIM y Gmail muestra **remitente no verificado**.

**Acción:** Resend → Domains → arkapp.es → copiar el DKIM actual. En Cloudflare **borrar el TXT viejo** y dejar **solo uno**.

Comprobar:

```bash
dig +short TXT resend._domainkey.arkapp.es
```

Debe devolver **una** línea `p=MIGfMA...`.

### 2. SPF en subdominio `send` — FALTA

Resend exige TXT en **`send.arkapp.es`**:

| Tipo | Nombre | Contenido |
|------|--------|-----------|
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

Ya tienes MX en `send` → `feedback-smtp.eu-west-1.amazonses.com`. Falta el TXT SPF (comprobado: `dig +short TXT send.arkapp.es` vacío).

### 3. SPF en raíz `arkapp.es`

Para **recibir** con Cloudflare Email Routing:

```txt
v=spf1 include:amazonses.com include:_spf.mx.cloudflare.net ip4:46.225.77.49 ~all
```

Solo **un** registro SPF por nombre. No dupliques TXT SPF en `arkapp.es`.

### 4. DMARC (ya lo tienes)

```txt
_dmarc.arkapp.es  →  v=DMARC1; p=none;
```

Opcional: añadir informes `rua=mailto:hello@arkapp.es`.

### 5. No mezclar envío con el VPS

Los registros A de `panel`, `n8n`, etc. **no envían** correo de la app. El envío es Resend → Amazon SES.

## Tras cambiar DNS

1. Resend → **Verify DNS** en arkapp.es.
2. Espera propagación (5–30 min).
3. Prueba en [mail-tester.com](https://www.mail-tester.com) (objetivo ≥ 9/10).
4. Reenvía invitación de prueba a Gmail.
5. En Gmail: «No es spam» + añadir remitente a contactos (primeros días).

## Supabase

No hace falta SMTP en Supabase si todo el correo pasa por Resend. Registro y reset usan `/api/auth/register` y `/api/auth/request-password-reset`.

## Código

Remitente centralizado: `getResendFromEmail()` en [`lib/emails/resend-config.ts`](../lib/emails/resend-config.ts).

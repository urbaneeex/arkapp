# Arkapp (appointment-crm)

Panel de gestión para negocios: citas, clientes, equipo, fichajes, documentos y firmas. Stack: **Next.js (App Router)**, **Supabase**, **Resend**.

## Requisitos

- Node.js 20+
- [pnpm](https://pnpm.io/)

## Configuración local

1. Clona el repositorio e instala dependencias:

   ```bash
   pnpm install
   ```

2. Crea tu archivo de entorno **a partir de la plantilla** (no compartas el archivo resultante):

   ```bash
   cp .env.example .env.local
   ```

3. Edita `.env.local` y rellena las variables. La plantilla [`.env.example`](.env.example) describe cada una. Como mínimo necesitas **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), **`RESEND_API_KEY`** y **`NEXT_PUBLIC_SITE_URL`** para el correo de recuperación de contraseña, y para fichaje QR **`CLOCK_IN_SECRET`** (mínimo 16 caracteres).

4. En el SQL Editor de Supabase, ejecuta la migración [`supabase/migrations/20260407120000_password_reset_tokens.sql`](supabase/migrations/20260407120000_password_reset_tokens.sql) (tabla de tokens de reset).

5. Arranca el entorno de desarrollo:

   ```bash
   pnpm dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Trabajo en equipo y secretos

- **No subas** `.env`, `.env.local` ni claves al repositorio.
- **Sí se versiona** [`.env.example`](.env.example): solo nombres y comentarios, sin valores secretos.
- Las claves reales se comparten por un canal seguro (gestor de secretos, variables del hosting) o cada desarrollador usa su propio proyecto de staging en Supabase.

Más detalle sobre correos (Resend vs plantillas de Supabase Auth): [`lib/emails/README.md`](lib/emails/README.md).

## Scripts

| Comando   | Descripción        |
| --------- | ------------------ |
| `pnpm dev`    | Servidor desarrollo |
| `pnpm build`  | Build producción    |
| `pnpm start`  | Servidor producción |
| `pnpm lint`   | ESLint              |

## Despliegue

Configura en tu proveedor (p. ej. Vercel) las mismas variables que en `.env.example`, usando valores de **producción**. `VERCEL_URL` la inyecta Vercel automáticamente; conviene definir `NEXT_PUBLIC_SITE_URL` con tu dominio definitivo.

# Agentes / IA en este repo

- Convenciones de UI (tipografía Clash Display en titulares, tokens `brand` / `brand-hover`, layout del dashboard, pestañas estilo Equipo): ver **`.cursor/rules/arkapp-design-system.mdc`** (Cursor la adjunta al trabajar en `app/**/*.tsx`, `components/**/*.tsx` y `app/globals.css`).
- Resumen legible para humanos: **`docs/design-system.md`**.

## Seguridad

- **Estándares obligatorios** para toda nueva función, ruta API o cambio de autenticación: **`docs/security-standards.md`**.
- Antes de generar o modificar una ruta API, leer el documento de estándares y marcar la checklist del §11.
- Reglas clave resumidas:
  1. Toda ruta API que acceda a datos de negocio llama `getUser()` al inicio y retorna 401 si no hay sesión.
  2. Siempre verifica que el `businessId` pertenece al usuario autenticado (propietario o staff del negocio).
  3. Los mensajes de error al cliente son genéricos; el detalle real solo va a `console.error`.
  4. Tokens de invitación/reset: validez ≤ 48 h, check de `expires_at`, marcado como `used: true` tras consumir.
  5. Webhooks entrantes verifican header `Authorization: Bearer <WEBHOOK_SECRET>`.
  6. Prohibido `console.log` con datos sensibles en producción (tokens, emails, respuestas de API completas).
  7. Nuevas tablas Supabase: RLS habilitado + políticas SELECT/INSERT/UPDATE/DELETE en la misma migración.

a # Vulnerabilidades de seguridad — estado

> Todas las vulnerabilidades identificadas han sido corregidas. Para las reglas que deben seguirse a futuro, ver **`docs/security-standards.md`**.

---

## ✅ Resueltas

### 1. `/api/appointments/available-staff` — Sin autenticación
**Fix aplicado:** Se añadió `getUser()` al inicio del handler + verificación de que el `businessId` pertenece al usuario (propietario o staff del negocio). Retorna 401/403 si no hay sesión o acceso.

### 2. `/api/webhooks/n8n-appointment` — Sin secreto compartido
**Fix aplicado:** Se verifica `Authorization: Bearer <WEBHOOK_SECRET>` si la variable de entorno está definida. Retorna 401 si el secreto no coincide. Añadir `WEBHOOK_SECRET` en `.env` y en la configuración de n8n.

### 3. `/api/staff/accept-invite` — Token sin validación de `expires_at`
**Fix aplicado:** Se añadió comprobación `if (invite.expires_at && new Date(invite.expires_at) < new Date())` → retorna 400.

### 4. `/api/staff/invite` — Sin autenticación ni verificación de ownership
**Fix aplicado:** Se añadió `getUser()` al inicio + verificación de que el usuario autenticado es `owner_uid` del negocio al que pertenece el empleado invitado. Retorna 401/403 si no cumple.

### 5. `next.config.ts` — Sin headers de seguridad HTTP
**Fix aplicado:** Se añadió la función `headers()` con `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy` y `Content-Security-Policy` para todas las rutas.

### 6. Rate limiting en memoria (no distribuido)
**Estado:** Documentado en `docs/security-standards.md` §4. Aceptable para MVP; migrar a Upstash/Redis antes de escalar a múltiples instancias en producción.

### 7. `console.log` con datos sensibles en `available-staff`
**Fix aplicado:** Se eliminaron los dos bloques `console.log` de debug (`DEBUG HORARIOS PARSEADOS` y `FINAL API RESPONSE`).

### 8. Coordenadas GPS controladas por el cliente
**Fix aplicado (mitigación):** Se registra la IP del cliente en `metadata.client_ip` de cada entrada de fichaje (`time_entries`). La validación Haversine ya estaba implementada. Documentado en `docs/security-standards.md` §9.

### 9. `accept-invite` usaba `listUsers()` completo para buscar por email
**Fix aplicado:** Se sustituye por `listUsers({ page: 1, perPage: 200 })` con búsqueda local, evitando descargar miles de usuarios. Nota: `getUserByEmail` no existe en la API de Supabase JS actualmente.

### 10. Mensajes de error internos expuestos al cliente
**Fix aplicado:** Se sustituyeron todos los `error.message` / `insertError.message` devueltos al cliente por mensajes genéricos en: `accept-invite`, `invite`, `clock-in` (break, resume, in, out) y `available-staff`. El error real solo se loguea con `console.error`.

### 11. Token de invitación con validez de 7 días
**Fix aplicado:** Reducido a 48 horas en `invite/route.ts` (`expiresAt.setHours(+48)`). El email de invitación ya informaba "24 horas" — ahora el código y el texto son consistentes.

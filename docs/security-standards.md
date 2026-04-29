# Estándares de seguridad — Arkapp

> **Propósito:** Este documento define las reglas de seguridad que TODA nueva función, ruta API o componente debe cumplir. Su objetivo es que no haya que auditar la app de nuevo desde cero; se audita solo el delta de cada PR comparándolo contra esta checklist.

---

## 1. Autenticación en rutas API

### Regla obligatoria
**Toda ruta API** que acceda a datos de negocio (clientes, citas, personal, finanzas, fichajes…) **debe** verificar la sesión del usuario al principio del handler, **antes** de cualquier otra lógica:

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
```

### Excepciones permitidas
- Rutas de auth propias (`/api/auth/register`, `/api/auth/login`, `/api/auth/lookup-email`, etc.) — por definición operan sin sesión previa.
- `/api/staff/accept-invite` — el token de invitación es el mecanismo de autenticación.
- Webhooks entrantes (ej. n8n) — protegidos con secreto compartido (ver §6).

---

## 2. Autorización: verificar pertenencia al negocio

Autenticarse no es suficiente. Siempre hay que verificar que el `businessId` del recurso pedido pertenece al usuario autenticado:

```ts
// Opción A: el usuario es propietario del negocio
const { data: biz } = await supabase
  .from('businesses')
  .select('id')
  .eq('id', businessId)
  .eq('owner_uid', user.id)
  .maybeSingle()

// Opción B: el usuario es staff del negocio
const { data: membership } = await supabase
  .from('staff')
  .select('id')
  .eq('business_id', businessId)
  .eq('id', user.id)
  .is('deleted_at', null)
  .maybeSingle()

if (!biz && !membership) {
  return NextResponse.json({ error: 'Sin acceso a este negocio' }, { status: 403 })
}
```

**Nunca** confiar en `businessId` que viene del body/querystring sin verificar en DB.

---

## 3. Errores: nunca exponer mensajes internos al cliente

Los mensajes de error de Supabase/Postgres pueden filtrar nombres de tablas, columnas y estructura interna.

```ts
// ❌ MAL — filtra información interna
return NextResponse.json({ error: insertError.message }, { status: 500 })

// ✅ BIEN — mensaje genérico al cliente, detalle solo en servidor
console.error('[mi-ruta] error al insertar', insertError)
return NextResponse.json({ error: 'Error interno' }, { status: 500 })
```

**Regla:** el campo `error` de toda respuesta 4xx/5xx debe ser una cadena comprensible para el usuario final, **sin** stacktraces, nombres de columnas ni mensajes ORM crudos.

---

## 4. Rate limiting

Las rutas de autenticación y alta sensibilidad deben tener rate limiting por IP.

### Implementación actual (en memoria — aceptable para MVP)
Se usa el patrón ya presente en `lib/email-verification.server.ts`, `lib/email-lookup-rate-limit.server.ts` y `lib/password-reset.server.ts`.

### Cuándo añadir rate limit
Toda nueva ruta que:
- Reciba email/contraseña
- Genere o consuma tokens (invitaciones, resets, QR)
- Envíe emails o mensajes (Resend, WhatsApp)

### Límites recomendados
| Tipo de ruta | Ventana | Máximo |
|---|---|---|
| Registro / login | 15 min | 10 intentos |
| Lookup de email | 15 min | 20 intentos |
| Reset de contraseña | 15 min | 8 intentos |
| Envío de invitaciones | 1 hora | 20 envíos |

> **Nota de escalabilidad:** En Vercel cada instancia serverless tiene su propio contador. Para límites estrictos en producción multi-instancia, migrar a `@upstash/ratelimit` con Redis distribuido.

---

## 5. Tokens de invitación y reset

- **Validez máxima:** 48 horas (no 7 días).
- **Comprobación de expiración** en el handler que consume el token:
  ```ts
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'El enlace ha expirado' }, { status: 400 })
  }
  ```
- **Marcado como usado** (`used: true`) inmediatamente después de consumirlo.
- Los tokens deben ser opacos y suficientemente aleatorios (`randomUUID()` o `randomBytes(32).toString('hex')`).

---

## 6. Webhooks entrantes

Todo webhook que pueda disparar acciones (emails, WhatsApp, modificaciones de BD) debe autenticarse con un secreto compartido:

```ts
const webhookSecret = process.env.WEBHOOK_SECRET
if (webhookSecret) {
  const auth = req.headers.get('authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (provided !== webhookSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}
```

- `WEBHOOK_SECRET` debe estar en `.env` con al menos 32 caracteres aleatorios.
- Configurar el mismo secret en el sistema que llama (n8n, Zapier, etc.).

---

## 7. Headers HTTP de seguridad

Configurados en `next.config.ts` para **todas las rutas**. No modificar sin revisar el impacto:

| Header | Valor | Por qué |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `X-Frame-Options` | `DENY` | Previene clickjacking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Fuerza HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Evita filtar URL en Referer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self)` | Limita APIs de navegador |
| `Content-Security-Policy` | Ver `next.config.ts` | Restringe fuentes de recursos |

Si se añaden nuevos dominios externos (CDN de imágenes, APIs de mapas, etc.), actualizar el CSP en `next.config.ts`.

---

## 8. Logs en producción

- **Prohibido** hacer `console.log` con datos sensibles (tokens, contraseñas, respuestas de API completas, datos personales).
- Los logs de debug **solo** deben existir bajo una variable de entorno:
  ```ts
  if (process.env.DEBUG === 'true') console.log(...)
  ```
- Está permitido `console.error` con el error original (para Vercel logs del servidor), **siempre** que el mensaje de error al cliente sea genérico.

---

## 9. GPS / geolocalización (fichajes)

El GPS siempre viene del cliente, por lo que **no puede garantizarse en servidor**. Mitigaciones obligatorias:

1. Registrar la IP del request junto a cada fichaje en `metadata: { client_ip }`.
2. La validación Haversine (radio del negocio) ya está implementada y debe mantenerse.
3. Si se detectan discrepancias repetidas IP ≠ localización GPS, el sistema debe poder alertar al propietario.

---

## 10. RLS (Row Level Security) en Supabase

- **Toda tabla nueva** debe tener RLS habilitado desde el principio.
- Siempre añadir políticas de `SELECT`, `INSERT`, `UPDATE` y `DELETE`.
- Las migraciones de nuevas tablas deben incluir las políticas RLS en el mismo fichero `.sql`.
- Probar las políticas con un usuario sin privilegios antes de hacer merge.

---

## 11. Checklist de PR — seguridad

Antes de hacer merge de cualquier PR que toque rutas API o autenticación, verificar:

- [ ] ¿Llama `getUser()` al inicio si accede a datos de negocio?
- [ ] ¿Verifica que el `businessId` pertenece al usuario autenticado?
- [ ] ¿Las cargas auxiliares del dashboard (p. ej. catálogo cliente/servicio para modales) comprueban sesión y negocio del usuario?
- [ ] ¿Los errores devueltos al cliente son genéricos (sin mensajes internos de DB)?
- [ ] ¿Hay `console.log` con datos sensibles?
- [ ] ¿Los tokens tienen TTL ≤ 48 h y se marcan como usados?
- [ ] ¿Los webhooks entrantes verifican el secreto compartido?
- [ ] ¿Las tablas nuevas tienen RLS habilitado con políticas completas?
- [ ] ¿Las rutas de historial o auditoría (p. ej. lectura de `appointment_audit_log`) restringen acceso a propietario o rol alto del negocio?
- [ ] ¿Se ha actualizado el CSP en `next.config.ts` si se añaden dominios externos?

/**
 * QR Clock-in token utilities using Web Crypto API (no external dependencies).
 * Token format: base64url(JSON payload) + '.' + base64url(HMAC-SHA256 signature)
 */

const TOKEN_TTL_MS = 2 * 60 * 1000 // 2 minutes

function b64urlEncode(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.CLOCK_IN_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('CLOCK_IN_SECRET env var must be set (min 16 chars)')
  }
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export type QRTokenPayload = {
  businessId: string
  iat: number
  exp: number
}

export async function generateQRToken(businessId: string): Promise<string> {
  const now = Date.now()
  const payload: QRTokenPayload = {
    businessId,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  }
  const encoder = new TextEncoder()
  const payloadJson = JSON.stringify(payload)
  const payloadB64 = b64urlEncode(encoder.encode(payloadJson).buffer as unknown as ArrayBuffer)

  const key = await getKey()
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64))

  return `${payloadB64}.${b64urlEncode(sig)}`
}

export async function verifyQRToken(token: string): Promise<QRTokenPayload> {
  const parts = token.split('.')
  if (parts.length !== 2) throw new Error('Token inválido')

  const [payloadB64, sigB64] = parts

  const key = await getKey()
  const encoder = new TextEncoder()
  const sigBytes = b64urlDecode(sigB64)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes.buffer as ArrayBuffer,
    encoder.encode(payloadB64)
  )

  if (!valid) throw new Error('Firma del token inválida')

  const payloadJson = Buffer.from(b64urlDecode(payloadB64)).toString('utf-8')
  const payload = JSON.parse(payloadJson) as QRTokenPayload

  if (Date.now() > payload.exp) throw new Error('El código QR ha expirado. Solicita uno nuevo.')

  return payload
}

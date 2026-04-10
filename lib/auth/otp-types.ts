export type OtpType = 'signup' | 'email' | 'email_change' | 'recovery' | 'invite' | 'magiclink'

const OTP_TYPES: readonly OtpType[] = [
  'signup',
  'email',
  'email_change',
  'recovery',
  'invite',
  'magiclink',
]

export function parseOtpType(raw: string | null): OtpType | null {
  if (!raw) return null
  const n = raw.toLowerCase()
  return (OTP_TYPES as readonly string[]).includes(n) ? (n as OtpType) : null
}

/** Remitente verificado en Resend para arkapp.es */
export const DEFAULT_RESEND_FROM = 'Arkapp <hello@arkapp.es>' as const

export function getResendFromEmail(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  return from || DEFAULT_RESEND_FROM
}

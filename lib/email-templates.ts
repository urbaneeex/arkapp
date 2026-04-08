/**
 * Punto de entrada estable para plantillas HTML enviadas vía Resend.
 * Implementación modular en `lib/emails/`.
 */
export {
  SITE_URL,
  baseLayout,
  actionButton,
  buildDocumentSignatureRequestEmail,
  buildVacationApprovedEmail,
  buildSchedulePublishedEmail,
  buildDocumentSignedEmail,
  buildPasswordResetEmail,
} from '@/lib/emails'

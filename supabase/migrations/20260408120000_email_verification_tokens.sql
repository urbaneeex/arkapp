-- Tokens opacos para confirmar email del registro (enlace solo a tu dominio vía Resend).
-- Solo el service role debe usar esta tabla (RLS sin políticas = denegado a anon/authenticated).

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_unused
  ON public.email_verification_tokens (user_id)
  WHERE used_at IS NULL;

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_verification_tokens IS 'Signup email verification; store only SHA-256 hex of secret; service_role only.';

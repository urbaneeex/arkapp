-- Tablas de tokens: acceso solo desde servidor con SUPABASE_SERVICE_ROLE_KEY (bypass RLS).
-- Antes: RLS ON sin políticas → Security Advisor lint 0008 (rls_enabled_no_policy).
-- Ahora: políticas explícitas que niegan anon/authenticated; mismo efecto que el deny implícito.

-- ---------------------------------------------------------------------------
-- email_verification_tokens
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS email_verification_tokens_select_none ON public.email_verification_tokens;
DROP POLICY IF EXISTS email_verification_tokens_insert_none ON public.email_verification_tokens;
DROP POLICY IF EXISTS email_verification_tokens_update_none ON public.email_verification_tokens;
DROP POLICY IF EXISTS email_verification_tokens_delete_none ON public.email_verification_tokens;

CREATE POLICY email_verification_tokens_select_none
  ON public.email_verification_tokens
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY email_verification_tokens_insert_none
  ON public.email_verification_tokens
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY email_verification_tokens_update_none
  ON public.email_verification_tokens
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY email_verification_tokens_delete_none
  ON public.email_verification_tokens
  FOR DELETE
  TO anon, authenticated
  USING (false);

REVOKE ALL ON TABLE public.email_verification_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.email_verification_tokens FROM anon;
REVOKE ALL ON TABLE public.email_verification_tokens FROM authenticated;
GRANT ALL ON TABLE public.email_verification_tokens TO service_role;

COMMENT ON TABLE public.email_verification_tokens IS
  'Tokens de verificación de email; solo rutas servidor con service role. Políticas RLS niegan anon/authenticated.';

-- ---------------------------------------------------------------------------
-- password_reset_tokens
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS password_reset_tokens_select_none ON public.password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_insert_none ON public.password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_update_none ON public.password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_delete_none ON public.password_reset_tokens;

CREATE POLICY password_reset_tokens_select_none
  ON public.password_reset_tokens
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY password_reset_tokens_insert_none
  ON public.password_reset_tokens
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY password_reset_tokens_update_none
  ON public.password_reset_tokens
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY password_reset_tokens_delete_none
  ON public.password_reset_tokens
  FOR DELETE
  TO anon, authenticated
  USING (false);

REVOKE ALL ON TABLE public.password_reset_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.password_reset_tokens FROM anon;
REVOKE ALL ON TABLE public.password_reset_tokens FROM authenticated;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;

COMMENT ON TABLE public.password_reset_tokens IS
  'Tokens de reset de contraseña; solo rutas servidor con service role. Políticas RLS niegan anon/authenticated.';

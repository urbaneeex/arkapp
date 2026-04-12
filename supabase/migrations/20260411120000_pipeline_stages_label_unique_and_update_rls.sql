-- Unicidad del nombre visible por negocio (trim + case-insensitive). slug no se modifica aquí;
-- sigue alineado con appointment_status vía trigger appointments_sync_stage_and_status.
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_business_label_normalized_key
  ON public.pipeline_stages (business_id, (lower(trim(label))));

DROP POLICY IF EXISTS pipeline_stages_update_member ON public.pipeline_stages;

CREATE POLICY pipeline_stages_update_member
  ON public.pipeline_stages
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_uid = (SELECT auth.uid()))
    OR business_id IN (
      SELECT business_id FROM public.staff
      WHERE id = (SELECT auth.uid()) AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE owner_uid = (SELECT auth.uid()))
    OR business_id IN (
      SELECT business_id FROM public.staff
      WHERE id = (SELECT auth.uid()) AND deleted_at IS NULL
    )
  );

-- Allow the hearing index to retain the provenance of official TJPR PROJUDI MNI evidence.
ALTER TABLE public.audiencias_monitoradas
  DROP CONSTRAINT IF EXISTS audiencias_monitoradas_fonte_check;

ALTER TABLE public.audiencias_monitoradas
  ADD CONSTRAINT audiencias_monitoradas_fonte_check
  CHECK (fonte = ANY (ARRAY['DJEN'::text, 'DataJud'::text, 'TJPR PROJUDI'::text]));

COMMENT ON CONSTRAINT audiencias_monitoradas_fonte_check ON public.audiencias_monitoradas IS
  'Only verified official publication or movement sources may create hearing evidence.';

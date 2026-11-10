ALTER TABLE public.audiencias_monitoradas DROP CONSTRAINT IF EXISTS audiencias_monitoradas_tipo_check;
ALTER TABLE public.audiencias_monitoradas
 ADD CONSTRAINT audiencias_monitoradas_tipo_check
 CHECK (tipo IN ('conciliacao','instrucao','julgamento','sessao_virtual','sessao_julgamento','audiencia'));
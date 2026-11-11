-- Hermes / Audiências: remove somente projeções artificiais com intervalo impossível.
-- Textos DJEN/DataJud permanecem nos registros de evidência e no histórico Hermes.
-- Não altera processos, retornos, custas, honorários ou comunicação com clientes.

-- Um evento já possui projeção canônica (mesmo tenant, CNJ, tipo e data):
-- preservar o evento canônico e remover a segunda projeção com fim anterior ao começo.
DELETE FROM public.audiencias_monitoradas bad
USING public.audiencias_monitoradas good
WHERE bad.id <> good.id
 AND good.empresa_id=bad.empresa_id
 AND good.processo_id=bad.processo_id
 AND good.tipo=bad.tipo
 AND good.data_evento=bad.data_evento
 AND bad.tipo='sessao_virtual'
 AND bad.data_fim < bad.data_evento
 AND good.data_fim IS NULL
 AND good.chave=good.tipo||':'||good.data_evento::text||':';

-- Nas demais projeções impossíveis, a data inicial permanece registrada.
-- Corrige também chaves legadas cujo fim já havia sido limpo pela auditoria.
UPDATE public.audiencias_monitoradas a
SET data_fim=NULL,
    hora_fim=NULL,
    chave=a.tipo||':'||a.data_evento::text||':',
    atualizado_em=now()
WHERE a.tipo='sessao_virtual'
 AND a.data_evento IS NOT NULL
 AND (
   a.data_fim < a.data_evento
   OR (a.data_fim IS NULL AND a.chave<>a.tipo||':'||a.data_evento::text||':')
 )
 AND NOT EXISTS (
   SELECT 1 FROM public.audiencias_monitoradas good
   WHERE good.id<>a.id
    AND good.empresa_id=a.empresa_id
    AND good.processo_id=a.processo_id
    AND good.chave=a.tipo||':'||a.data_evento::text||':'
 );

-- Para evitar regressões, futuras upserts não poderão inserir um intervalo impossível.
DO $safety$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conname='audiencias_monitoradas_end_after_start'
    AND conrelid='public.audiencias_monitoradas'::regclass
 ) THEN
  ALTER TABLE public.audiencias_monitoradas
   ADD CONSTRAINT audiencias_monitoradas_end_after_start
   CHECK (data_fim IS NULL OR data_evento IS NULL OR data_fim >= data_evento) NOT VALID;
 END IF;
END;
$safety$;
ALTER TABLE public.audiencias_monitoradas
 VALIDATE CONSTRAINT audiencias_monitoradas_end_after_start;

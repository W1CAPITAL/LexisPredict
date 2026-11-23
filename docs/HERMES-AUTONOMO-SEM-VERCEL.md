# Hermes 3D — execução autônoma sem Vercel

Implementado em 23/11/2026 no Supabase do LexisPredict (`segjskjlbeydlljnefai`).

## O que está operacional

- Função `hermes-background` em Supabase Edge; invocação regional `sa-east-1`.
- Job existente `lexis-hermes-full-portfolio` (#24), agora a cada 2 minutos,
  aponta para `/functions/v1/hermes-background?forceFunctionRegion=sa-east-1`.
- O job não depende de o EXE, navegador, LexisPredict ou Vercel estarem abertos.
- Continua usando `hermes_claim_portfolio_scan_batch` e
  `hermes_portfolio_scans`: lock atômico por empresa/processo, RLS e preservação
  de evidências. Prioriza retornos vencidos e os próximos sete dias.
- Faz consultas novas e diretas às APIs oficiais DataJud e DJEN; não confunde
  falha 401/403/429 com ausência de movimentações.
- Se as duas fontes estiverem temporariamente bloqueadas, não consome a fila
  nem regrava evidências sem fazer consulta. Respeita intervalo de espera
  global por fonte para evitar bloqueios e consumo excessivo.
- Os eventos registrados anteriormente no formato `{source,at,text,url}`
  permanecem intactos; apenas evidências associadas ao CNJ exato são adicionadas.
- Não envia mensagens, não altera processo, não registra atendimentos que não
  ocorreram e não muda a data do próximo retorno.

## Segurança e validação observada

- O serviço rejeita requisições sem token (HTTP 401).
- O token é lido pelo próprio Supabase Vault; não aparece em arquivos,
  GitHub, EXEs nem logs. A verificação ocorre via função SQL acessível
  somente com `service_role`.
- Teste autorizado inicial retornou HTTP 200 com dois itens processados.
- Teste regional `sa-east-1`: dois itens processados, com DJEN confirmado,
  sem falsa afirmação de resultados do DataJud.
- A execução do cron #24 em 23/11/2026 13:32 UTC foi confirmada por resposta
  HTTP 200, executando dois itens e armazenando resultado parcial.

## Limitações existentes

O monitor independente substitui a **verificação da carteira** que dependia
da Vercel. Outras rotinas antigas do Hermes, como reuniões, revisão detalhada
de retornos, audiências e conectores específicos, ainda têm jobs que apontam
para a Vercel. Essas rotinas **não** devem ser anunciadas como migradas.

O DJEN respondeu no datacenter de São Paulo. O DataJud respondeu HTTP 401
com a chave pública disponível; o worker tenta renovar a chave pela
documentação oficial e classifica o erro quando não consegue. Alguns
tribunais exigem credenciais e não podem ser consultados livremente.

Os relatórios e a experiência 3D leem dados persistidos. A renderização da
interface não é a execução do monitor.

## Conferência sem alteração de dados

```sql
select jobname, active, schedule from cron.job
where jobname='lexis-hermes-full-portfolio';

select state, count(*), max(checked_at) as ultima_verificacao
from public.hermes_portfolio_scans group by state;

select start_time, status, return_message from cron.job_run_details
where jobid=24 order by start_time desc limit 10;
```

A disponibilidade e o custo dependem dos limites do plano Supabase e
das restrições das APIs judiciais. Nunca anunciar execução contínua como
garantia de que todas as fontes estarão acessíveis.

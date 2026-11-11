# Hermes3D — Revisões judiciais automáticas de retorno

## Objetivo
Gerar uma análise *interna*, auditável e separada de WhatsApp para processos cujo
`proximo_retorno` chegou ou venceu: consultar DataJud + DJEN e, quando disponível,
a API oficial do tribunal (MNI), listar até três
movimentações relevantes posteriores ao `ultimo_retorno`, preparar rascunho,
classificar urgência da fila e sugerir próximo retorno administrativo.

## Agendamento
- Supabase pg_cron: `lexis-hermes-due-returns`, a cada 5 minutos entre
  08:00 e 19:55 (America/Sao_Paulo), diariamente.
- Supabase pg_cron: `lexis-hermes-full-portfolio`, a cada minuto; varre a carteira
  por lotes incrementais de dois processos, sem depender de retorno vencido.
  O ciclo percorre processos com CNJ válido e reconsulta os parciais/indisponíveis.
- JWT/secret: usa o segredo existente `lexis_wa_daily_cron_token` do
  Vault via header Authorization para chamar
  `/api/cron/hermes-returns`. A mesma credencial deve estar configurada na
  Vercel como `WA_DAILY_CRON_SECRET` ou `CRON_SECRET`.
- Micro-lotes de até 2 processos por chamada; evita consultar todos os
  processos a cada minuto. Hoje ganha prioridade sobre backlog anterior.
- Idempotência na tabela `hermes_return_reviews` por empresa, processo,
  data do retorno. Claims são atômicos. Falhas são tentadas novamente depois
  de quatro horas, claims interrompidos após 15 minutos.
- O agendamento precisa estar efetivamente instalado em Supabase e a Vercel
  com a rota publicada; o arquivo SQL sozinho não ativa jobs.
- No primeiro uso, backlog pode ser processado ao longo de várias execuções.
  O agendamento não garante atualização em tempo real do tribunal; respeita
  limites e indisponibilidade das fontes.

## Origem e qualidade
- Consulta DataJud `fetchDataJud` e DJEN `fetchDjenComunicacoes` (APIs oficiais)
  por CNJ previamente cadastrado no Supabase.
- Para CNJ do TJPR (`8.16`), quando DataJud falha ou não traz movimento posterior
  ao último retorno, o Hermes aciona automaticamente o serviço oficial PROJUDI
  MNI 2.2.2, em 1º ou 2º grau conforme o final do CNJ.
- O MNI 2.2.2 é consultado sem cadastro, login ou senha, conforme a Resolução
  TJPR 532-OE/2026, de 23/03/2026. Os campos de autenticação obrigatórios no WSDL
  são enviados vazios, sem segredos ou variáveis adicionais.
- A consulta pede somente movimentos públicos: cabeçalho e documentos ficam
  desativados. O Hermes não lê nem persiste complementos de movimentação, que
  devem permanecer ocultos em toda consulta pública automatizada.
- O portal público com reCAPTCHA não é automatizado; a integração usa o serviço
  SCMPP/MNI oficial, sem contornar controles de acesso.
- e-SAJ/eproc/PJe/Jus.br não são raspados por automação de navegador: páginas
  com login, captcha ou WAF não são contornadas. Fontes adicionais só entram
  quando houver API oficial e autorização técnica do respectivo tribunal.
- Registra cada fonte separadamente. MNI não é rotulado como DataJud; um
  movimento do tribunal atualiza apenas a última movimentação genérica e o
  histórico com a origem correta. Resposta HTTP falha não vira «sem andamento».
- Eventos anteriores ao último atendimento não são chamados de novos.
- Sem último retorno, não assume que a movimentação é posterior ao contato.
- Texto da mensagem só menciona fatos recuperados. São sugestões, não
  atestados, certidões ou cálculos de prazos judiciais.
- Para efeitos jurídicos de ato crítico, revisar o teor integral no tribunal.

## Operação e permissões
- /cases: botão de robô em cada cartão de cliente.
- /tarefas: fila Hermes por prioridade e botão individual nos grupos.
- /processos: botão na lateral de detalhes do processo selecionado.
- Acesso restrito a sessão Supabase e empresa, validação server-side.
- Tabela privada: RLS ativo; leitura/gravação somente pelo service_role
  no servidor, sem exposição da tabela diretamente via navegador.
- Botão «Consultar agora»: servidor consulta fontes e atualiza análise, sem enviar.
- Botão «Copiar»: copia rascunho para revisão e possível uso manual.

## Proibições operacionais
Esta rotina **NÃO**:
- envia WhatsApp, e-mail, mensagem de grupo nem dispara notificações aos clientes;
- altera `ultimo_retorno`, `proximo_retorno` ou o responsável;
- cria atendimento que não ocorreu ou atribui atendimento a operador;
- modifica status processual, baixa, mérito, sentença ou prazo judicial;
- considera uma consulta sem resultados prova de inexistência processual;
- acessa processos de outra empresa.

A data sugerida de 25 dias quando houver evento crítico e 30 dias em rotina
é apenas uma proposta administrativa dentro da janela de 25–35 dias.
A prioridade sinaliza ordem de **revisão humana**, não previsão de resultado
processual. Processos encerrados não recebem rascunho automático.

## Testes e operação
- `pnpm run typecheck`, `pnpm test` e `pnpm run build` no CI.
- A documentação técnica oficial do TJPR para o SCMPP descreve os endpoints
  MNI 2.2.2, o identificador/código privativos e a senha MD5 diária:
  https://portal.tjpr.jus.br/pesquisa_athos/anexo/7150778
- A consulta MNI pública não exige secrets da Vercel; a autorização decorre da
  Resolução TJPR 532-OE/2026 e se limita aos dados públicos previstos na
  Resolução CNJ 121/2010.
- Conferir job `cron.job` e `cron.job_run_details`, status HTTP da
  `net._http_response` e novas linhas de `hermes_return_reviews`.
- Verificar 401 do endpoint sem token. Não copiar o valor do Vault para logs.
- Se o cron falhar, pausar por `cron.unschedule('lexis-hermes-due-returns')`.
  Os dados de análise já gerados permanecem disponíveis em modo leitura.

## Escritório 3D
A visualização Hermes mostra robôs volumétricos com cabeça de seis faces
(geometria CSS 3D, sem WebGL pesado) nas mesas dos especialistas e modo
alternativo 2D. Os robôs não afirmam atividade em tempo real; a fila e o
status real das consultas ficam nas páginas operacionais.

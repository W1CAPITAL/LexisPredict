# Retorno inteligente - scanner seletivo de fontes (14/10/2026)

## Por que era lento
A interface esperava 45 segundos **entre cada processo** e o servidor chamava DataJud e DJEN simultaneamente mesmo para processos com publicação DJEN posterior já comprovada. Números sem telefone eram escolhidos pelo banco e desperdiçavam uma iteração. O painel contava todos os vencidos (inclusive inviáveis).

## Nova seleção e processamento
1. `wa_next_due_return` filtra no PostgreSQL: encerrados, telefone brasileiro ausente/inválido, retorno anterior ausente, CNJ inválido, já conferidos hoje. Primeiro processa a publicação DJEN posterior ao retorno.
2. `checkReturnSources` executa o mesmo filtro de consentimento, bloqueio e encerramento utilizado no envio **antes** de buscar um tribunal.
3. Publicação DJEN recente, original, com CNJ/data/teor válidos e posterior ao último retorno: utiliza a prova já salva (não usa DataJud).
4. Se o DJEN precisa atualizar, consulta só DJEN, com `dataInicio` próximo ao último retorno (um dia antes, para cobrir fuso).
5. Se o DJEN não confirma novidade, só então tenta DataJud (reaproveita checagem recente). Uma publicação com indício terminal fica em revisão, sem envio precipitado.
6. Interface em lotes de até seis, sem pausa artificial de 45 segundos, com próximo lote após 700 ms; cron também confere até seis por invocação, com limite de 40 s.

## Segurança
- Nenhuma alteração de `ultimo_retorno` ou `proximo_retorno` em conferência negativa.
- Separação por empresa, bloqueios e opt-out continuam obrigatórios.
- A automação permanece desligada até ativação voluntária; cron de verificação não dispara mensagens.
- O resultado de "publicação localizada" não é sinônimo de envio. O envio exige confirmação de entrega e estado de transporte adequado.
- Consultas ao DataJud seguem necessárias quando o DJEN não traz todas as movimentações do tribunal.

## Métricas
`wa_daily_return_checks` registra razão por processo/dia e a interface conta o volume de registros revisados; não confundir `533 vencidos` com `533 elegíveis`. Fazer medição real de duração após deploy sem enviar mensagens.

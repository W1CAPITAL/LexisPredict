# Retorno inteligente WA.Auto / DataJud / DJEN

## Como funciona
A rotina NÃO envia status repetido. Primeiro consulta um único processo e busca a movimentação mais recente DataJud ou DJEN. Só cria aviso se houver teor + data posteriores ao DIA do último retorno. Com "último retorno" ausente ou com publicação datada no mesmo dia, requer conferência manual.

O envio é uma transação única **empresa + telefone + dia** e integra pedidos de cliente, scanner 1 a 1 e agendamento de vencidos. Depois de resposta positiva do WA.Auto E mensagem persistida no Supabase, os campos `ultimo_retorno` e `proximo_retorno` são atualizados, com intervalo configurável de 1 a 30 dias. Em caso de timeout, o resultado é incerto e NÃO se tenta reenviar. O WA.Auto confirma aceitação, não necessariamente leitura/entrega no aparelho do destinatário.

## Interface
`/whatsapp` -> **Retorno inteligente**:
- Ligar/desligar automação (inicialmente desligada)
- Escolher próximo retorno: 1/3/7/14/30 dias
- **Verificar próximo**: um CNJ vencido por vez, consultando DataJud/DJEN em modo curto
- **Iniciar varredura / Parar**: loop de 45s enquanto o navegador permanecer aberto
- **Verificar um CNJ**: mostra a prévia e permite consulta live aos tribunais antes do envio
- "Sem novidade" = nenhum WhatsApp e nenhuma alteração nas datas

## Agendamento
**Supabase pg_cron + pg_net** chama `GET /api/cron/wa-daily-return` a cada cinco minutos em dias úteis 9:00–17:55 BRT. Vercel Hobby não permite múltiplos crons por dia; não usar `vercel.json` para isto. O agendador usa token aleatório armazenado no Supabase Vault e como variável `WA_DAILY_CRON_SECRET` criptografada na Vercel. O endpoint compartilha o limite de 120 envios/empresa/dia com a fila de movimentações e checa um CNJ por execução. Carteiras grandes podem levar mais de um dia; falhas de fonte não geram mensagens.

## Pedidos de cliente no WhatsApp
`/api/webhook/evolution` tem assinatura/segredo existente. Só auto-responde quando **WA_DAILY_WEBHOOK_EMPRESA_ID** é definido no Vercel e a instância da mensagem coincide com **WA_DAILY_WEBHOOK_INSTANCE** (ou `EVOLUTION_INSTANCE`).
Outra opção: `POST /api/integration/wa-auto/daily-return-inbound`, com Bearer `WA_DAILY_WEBHOOK_SECRET` de 24+ caracteres, `WA_DAILY_WEBHOOK_EMPRESA_ID` e `WA_DAILY_WEBHOOK_INSTANCE` verificados no servidor. O WA.Auto precisa ser configurado para efetivamente emitir esse webhook ao receber mensagens; o endpoint sozinho não cria essa conexão.

Exemplos entendidos: "última atualização do meu processo", "qual é o andamento?", "novidades?", "movimentação", "processo". Mensagens genéricas como "oi" e "bom dia" são ignoradas.

Um número associado a vários processos na mesma empresa é considerado ambíguo para resposta automática. Solicitar o CNJ antes de fornecer detalhes.

## Segurança e restrições
- Consentimento: opt-in individual ou confirmação contratual da carteira pelo responsável, gravada com autor e data em `wa_daily_return_settings`. Qualquer recusa individual ou opt-out prevalece.
- Este transporte usa a sessão individual Baileys do WA.Auto. Não aplica o bloqueio de janela da Cloud API a este transporte. Integrações futuras com a API oficial devem implementar templates aprovados quando exigidos.
- Nenhum LLM reescreve ou inventa andamentos. A mensagem contém a descrição original sanitizada, CNJ, data e fonte.
- `wa_daily_return_sends` impede duplicidade por empresa/telefone/dia. `wa_daily_return_checks` impede examinar indefinidamente um mesmo CNJ no mesmo dia.
- Automações dependem de webhook realmente configurado, cron ativo e WA.Auto conectado; não confundir código publicado com integração validada ponta a ponta.
- Os novos campos e registros ficam isolados por `empresa_id` e service-role. A configuração padrão não envia.

## Fila unificada (9 out. 2026)
O scanner DataJud/DJEN salva os registros e prepara a mesma fila de novidades, quando a automação está ativa. Todos os responsáveis da empresa participam, sem filtro por `created_by`. A seleção leve `wa_notice_portfolio_rows` lê apenas campos necessários; a prévia mostra encerrados, sem telefone, sem data de retorno e sem novidade. `wa_notice_prior` também confere envios de outras rotinas.

`wa_reserve_return` usa trava transacional por empresa, unicidade por telefone/dia e por evento, intervalo de 45s e limite comum de 120 avisos. Não há reenvio após resposta ambígua. `wa_record_return` mescla as datas no JSON atual e evita sobrescrever retorno manual alterado durante o envio.

Para cron, a identidade do responsável é assinada no servidor por 90 segundos e validada pelo callback existente do WA.Auto. O callback confere cargo, empresa e automação/fila ativa; não aceita identidade arbitrária de navegador nem publica credenciais.

## Conferência do conteúdo e tom do atendimento
As mensagens se identificam como Setor Processual, usam o primeiro nome formatado e a saudação do horário de Brasília. Não prometem contato em uma data sem agendamento nem avisos sem novidade.

`djen_ultimo_resumo` é uma classificação de palavras-chave, não o teor original. A automação exige `wa_djen_evidence` com texto oficial, CNJ, data e consulta recente, separado do resumo. DataJud precisa de consulta nas últimas 24h e descrição legível: códigos isolados, consultas antigas, publicações sem teor verificável e atos finais em processos ainda abertos vão para conferência, sem envio. O evento e a regra de não duplicar permanecem independentes da redação.

“Sob pena de extinção”, pedido de extinção e citações aos artigos 290/485 não comprovam encerramento. A classificação só reconhece ato final afirmativo. Uma consulta pública mais recente fornecida pelo responsável fica registrada com sua origem, sem substituir artificialmente os dados do DataJud por dados de outra fonte.

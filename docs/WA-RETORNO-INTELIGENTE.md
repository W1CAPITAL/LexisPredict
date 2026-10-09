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
`vercel.json` configura chamada a `GET /api/cron/wa-daily-return` a cada cinco minutos nos dias úteis 9:00–17:55 BRT. O endpoint usa o `CRON_SECRET` (ou `WA_MOVEMENT_CRON_SECRET`) configurado na Vercel e limita os envios a 25/empresa/dia. Checa somente um CNJ por invocação, portanto não se promete esgotar uma carteira grande no mesmo dia. Se o provedor falhar, é registrada conferência sem enviar; pode ser conferido manualmente.

## Pedidos de cliente no WhatsApp
`/api/webhook/evolution` tem assinatura/segredo existente. Só auto-responde quando **WA_DAILY_WEBHOOK_EMPRESA_ID** é definido no Vercel e a instância da mensagem coincide com **WA_DAILY_WEBHOOK_INSTANCE** (ou `EVOLUTION_INSTANCE`).
Outra opção: `POST /api/integration/wa-auto/daily-return-inbound`, com Bearer `WA_DAILY_WEBHOOK_SECRET` de 24+ caracteres, `WA_DAILY_WEBHOOK_EMPRESA_ID` e `WA_DAILY_WEBHOOK_INSTANCE` verificados no servidor. O WA.Auto precisa ser configurado para efetivamente emitir esse webhook ao receber mensagens; o endpoint sozinho não cria essa conexão.

Exemplos entendidos: "última atualização do meu processo", "qual é o andamento?", "novidades?", "movimentação", "processo". Mensagens genéricas como "oi" e "bom dia" são ignoradas.

Um número associado a vários processos na mesma empresa é considerado ambíguo para resposta automática. Solicitar o CNJ antes de fornecer detalhes.

## Segurança e restrições
- A companhia deve ter registrado consentimento positivo específico (`dados.whatsapp_opt_in` ou equivalentes) e nenhum bloqueio/opt-out.
- Comunicados de texto livre só podem ser disparados dentro de janela de atendimento de até 24 horas. Fora dela, é necessária integração com **templates Meta aprovados**; o envio livre é bloqueado.
- Nenhum LLM reescreve ou inventa andamentos. A mensagem contém a descrição original sanitizada, CNJ, data e fonte.
- `wa_daily_return_sends` impede duplicidade por empresa/telefone/dia. `wa_daily_return_checks` impede examinar indefinidamente um mesmo CNJ no mesmo dia.
- Automações dependem de webhook realmente configurado, cron ativo e WA.Auto conectado; não confundir código publicado com integração validada ponta a ponta.
- Os novos campos e registros ficam isolados por `empresa_id` e service-role. A configuração padrão não envia.

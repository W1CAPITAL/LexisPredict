# WA.Auto — avisos automáticos da última movimentação (W1 Capital)

## Funcionamento

Em `/whatsapp`, Supervisor/Administrador/Superadmin vinculado à empresa pode clicar **Avisar última movimentação**. O sistema consulta **toda a carteira da empresa** em páginas de 400 diretamente no Supabase, não somente os 350 contatos exibidos inicialmente. Para cada processo, usa somente a última movimentação datada entre `datajud_ultimo_movimento + datajud_ultimo_nome` e `djen_ultima_data + djen_ultimo_resumo`.

Sem telefone válido, texto/data de evento confirmados ou com `nao_contatar`/`whatsapp_opt_out`/`consentimento_whatsapp=false`, a linha é excluída. Há prévia de mensagens e resumo dos motivos de exclusão. O operador precisa declarar que existem autorizações de contato.

Uma campanha é salva nas tabelas `wa_movement_campaigns` e `wa_movement_dispatches`, isoladas por empresa. Há deduplicação persistente por `empresa_id + processo_id + hash da movimentação`. Criação de fila não envia nada sem clique na confirmação. A função Postgres `wa_claim_movement` faz reivindicação atômica com intervalos mínimos de 45s e até 120 mensagens confirmadas por empresa por dia.

A entrega utiliza a sessão **individual do responsável** no WA.Auto Cloud, com token de integração server-side e `x-lexis-user-id` obtido apenas do banco. Não usa a sessão global do WA.Auto nem cai automaticamente para Evolution. Se a resposta for inconclusiva, o registro vira `uncertain` e a campanha é pausada até conferência no WhatsApp.

## Execução

- Enquanto a aba WhatsApp estiver aberta, o cliente avança a fila gradualmente; pausar, retomar e cancelar funcionam na interface.
- Para envio mesmo com a aba fechada, o endpoint privado `GET /api/cron/wa-movement` processa um envio confirmado por chamada. O endpoint exige `WA_MOVEMENT_CRON_SECRET` (mínimo 16 caracteres), e cada disparo valida a autorização atual do operador no Supabase.
- Produção: configurar Supabase `pg_cron`, `pg_net` e `vault`, guardando o segredo no Vault. O job chama o endpoint em HTTPS com `Authorization: Bearer <segredo>`. Evite cron duplicado.
- Antes de ativar o cron, publicar e verificar que a versão de produção tem a rota, que o segredo corresponde e que o WA.Auto está conectado à sessão do responsável.
- Job agendado não inicia campanhas sozinho: só campanhas explicitamente confirmadas e ativas recebem envios.
- Não rodar Vercel cron paralelo ao cron Supabase, para evitar consumo/requisições desnecessárias (claims atômicos impedem duplicidade).

## Observações

O aviso é **registro processual datado**, não conclusão jurídica, vitória, sentença ou garantia. Uma linha pode conter andamento desatualizado: a data e a fonte aparecem na prévia, e o operador confirma se deseja comunicar esse registro. A fila não faz varredura automática DataJud/DJEN: ela comunica o último evento **já salvo** no banco da carteira. Monitoramento contínuo de novas publicações requer um serviço separado de atualização dos andamentos.

Status: `running`, `paused`, `completed` ou `cancelled`. Linhas: `pending`, `processing`, `sent`, `failed`, `uncertain`, `cancelled`. Quando houver timeout, nunca efetuar reenvio automático da mesma mensagem.

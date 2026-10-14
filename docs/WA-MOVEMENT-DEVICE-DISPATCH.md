# Campanhas de movimentações no dispositivo WA.Auto vinculado

## Correção de 2026-10-14

As campanhas antigas dependiam de `evolutionForOwner()` e de um temporizador de navegador que reivindicava trabalhos somente enquanto a aba estivesse aberta. Como a Evolution está desativada, a campanha ficava em estado `running` com trabalhos `pending` e informava que o operador precisava se conectar à Evolution.

Agora o endpoint `/api/whatsapp-local/worker` autentica o dispositivo da empresa, solicita uma preparação por pulso de 65 segundos, e revalida campanha, responsável, telefone, opt-out e evento oficial. O banco executa reserva atômica com limite de um contato por telefone/dia, 45 segundos entre envios, e os limites de publicação.

A mensagem é inserida em `wa_local_jobs` e vinculada à movimentação por `wa_job_id`. O progresso da campanha `sent_count` só muda após o aceite real `accepted` pelo dispositivo. Estados incertos pausam a campanha; não são repetidos automaticamente. A atualização do último retorno é separada e protegida contra gravações concorrentes.

O navegador exibe a fila e seus contadores, mas não reivindica trabalhos nem exige sessão Evolution ou confirmação repetitiva. A execução ocorre apenas em dias úteis, das 9h às 18h (Brasília), com o dispositivo online. O provedor vinculado é **não oficial** e pode enfrentar bloqueios do WhatsApp; limites de envio são mitigação, não garantia.

### Verificação em produção

Após deploy, conferir no Supabase `wa_movement_dispatches.status`, `wa_local_jobs.status`, `wa_daily_return_sends.status` e se `wa_local_bridges.last_seen` permanece recente. Sem ACK do dispositivo, não afirmar envio concluído.

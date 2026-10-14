# WhatsApp: privacidade e encerramentos
- Novas mensagens do dispositivo vinculado deixam de ser copiadas para a tabela `whatsapp_messages`. O servidor apenas registra pedidos de SAIR em `wa_contact_optouts` (empresa, telefone, data).
- O histórico que já existia não é apagado automaticamente. Os pedidos anteriores de SAIR são transferidos à tabela mínima para não liberar contatos bloqueados.
- Conteúdo de trabalhos em `wa_local_jobs`, `wa_daily_return_sends` e `wa_movement_dispatches` é necessário **até** o aceite/falha. Após resolução, um gatilho substitui o conteúdo por marcador sem texto original.
- Dados mínimos de auditoria de entrega e datas do retorno permanecem. O QR e a sessão vinculada continuam separados e protegidos.
- O scanner pode notificar processos marcados como encerrados que tenham nova movimentação posterior ao último retorno, com evidência DataJud/DJEN recente e válida. Encerramento interno por si só **não** prova encerramento judicial.
- Comunicados de atos terminais judicialmente confirmados descrevem exatamente a categoria do ato e não prometem resultado favorável ou pagamento. Pedidos condicionais e teores ambíguos ficam para revisão.
- Não há prova de ausência de contato por outros canais apenas por falta de histórico no CRM. A fila de avisos é deduplicada por telefone, evento e dia; mantém opt-out e janelas de envio.
- A automação ainda respeita dias úteis 09h–18h, Brasil, e o dispositivo vinculado precisa estar online. Não use consultas repetitivas ao tribunal para fatos já verificados.

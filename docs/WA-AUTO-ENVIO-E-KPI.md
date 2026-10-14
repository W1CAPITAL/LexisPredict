# Retorno automático e produtividade humana

- WA.Auto vinculado é o transporte; `wa_local_jobs` recebe fila e o trabalhador confirma `accepted`, `delivered` e `read`.
- `wa_daily_return_sends` só passa para `sent` com aceite do dispositivo. A atualização de `ultimo_retorno` ocorre no mesmo banco, por gatilho e respeitando `prior_return` (edição humana concorrente).
- Clientes encerrados, telefone inválido, consentimento, SAIR, bloqueios, limite diário, intervalo 45 segundos e horário comercial continuam protegidos.
- Vercel Cron a cada 5 min; a ponte ligada também pode solicitar preparação. A automação é habilitada somente com autorização expressa e consentimento registrado.
- `/cases`, `/processos`, `/tarefas` e `/report` contabilizam eventos humanos de edição e atendimento, uma vez por caso/operador no período. O último retorno do cliente só muda com contato real, nunca por simples edição.
- Métricas de entrega do dispositivo distinguem aceito de entregue; o app não infere leitura.

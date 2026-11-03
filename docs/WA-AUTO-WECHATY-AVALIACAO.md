# WA.Auto + Wechaty — avaliação e melhorias implantadas

## Referência estudada

- Wechaty: https://github.com/wechaty/wechaty
- Mapeamento de eventos `scan`, `login`, `logout`, `ready`, `message`, `heartbeat` e tratamento de erros:
  https://github.com/wechaty/wechaty/blob/main/src/wechaty-mixins/puppet-mixin.ts
- Modelo de extensões por plugins:
  https://github.com/wechaty/wechaty/blob/main/src/wechaty-mixins/plugin-mixin.ts

O **Wechaty** expõe uma interface independente do protocolo (puppet), mas
**não é um substituto direto** da sessão WhatsApp existente do LexisPredict.
Não se adicionou `wechaty` como dependência, não se criou uma sessão concorrente
nem se alterou o provedor. O WA.Auto atual usa o processo Baileys em
`workers/wa-local`, separado das funções serverless da Vercel.

## Melhorias aplicadas

1. **Ciclo de vida previsível.** `connecting`, `qr`, `ready`, `offline`
   e `error` permanecem estados distintos. Uma geração antiga do socket
   não pode continuar processando mensagens, recibos ou credenciais depois
   de ser substituída. A inicialização de conexão é single-flight.
2. **Reconexão segura.** Backoff exponencial com jitter e teto de 60 s;
   falha no startup e na renovação de QR agendam nova tentativa. `loggedOut`
   continua exigindo nova vinculação real do dispositivo.
3. **Eventos recebidos.** Mensagens inbound são deduplicadas por ID do
   provedor + telefone, em cache de memória com limite e expiração.
   O worker envia apenas entradas recebidas ao verificador de opt-out;
   falha de registro retira o evento do cache para permitir novo processamento.
   O texto do histórico não é salvo no bridge.
4. **Recibos ordenados.** ACK de entrega/leitura que chega antes do aceite
   é armazenado brevemente por ID (sem corpo do texto); depois do aceite,
   as atualizações avançam de forma serial e monotônica. Falha ao confirmar
   ACK não vira entrega fictícia nem dispara reenvio da mensagem.
5. **Confirmação atômica no banco.** O endpoint `/api/whatsapp-local/worker`
   agora verifica transições válidas, o identificador da mensagem no
   provedor e se a atualização por `status` anterior alterou realmente uma
   linha. Uma corrida retorna HTTP 409, não falso sucesso.
6. **Painel mais preciso.** A consulta do estado usa uma única requisição
   por vez, renova quando a aba volta ao primeiro plano, descarta respostas
   antigas e deixa de mostrar `CONECTADO` se a última verificação falhar.
   Mostra QR apenas quando a sessão e o código estão realmente recentes.

## Segurança e operação

- **Não foram ativados disparos em massa.** Mantêm-se autorizações por
  empresa, opt-out e reserva de fila no Supabase, com a distinção de
  aceite pelo dispositivo e entrega real.
- A fila no banco é o registro durável. Deduplicação em memória protege
  somente a vida útil do processo; reinícios não substituem a transação da fila.
- Não se transferem credenciais, mensagens, QR ou sessão para o Wechaty.
  Nenhuma alteração de schema Supabase é necessária.
- O `render.yaml` configura auto deploy do **worker Render** a partir
  de commits, se o serviço estiver realmente provisionado e conectado.
  O deploy Vercel publica o painel/API, mas **não comprova** que o worker
  está rodando; essa condição requer verificação separada no Render.
- A integração Baileys usa WhatsApp Web não oficial, sujeita a alterações
  e restrições; para mensagens empresariais oficiais, avaliar a
  WhatsApp Business Platform em uma migração planejada.

## Testes

- `node --check workers/wa-local/index.mjs`
- `node --test workers/wa-local/connection-lifecycle.test.mjs`
- `pnpm test` (inclui a máquina de estados de ACK)
- `pnpm run typecheck && pnpm run build`

A suíte GitHub Actions executa essas etapas antes do merge.

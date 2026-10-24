# WhatsApp Web no navegador — LexisPredict

> Dois canais, uma carteira. O modo navegador não exige WA.Auto, Evolution, Render nem modelo de IA. Ele usa a sessão que o próprio operador já abriu em **web.whatsapp.com**.

## Como usar
1. Abra [o terminal WhatsApp](https://lexispredict.vercel.app/whatsapp).
2. Selecione um processo com telefone salvo e confira a mensagem.
3. Em **Canal para esta mensagem**, escolha **WhatsApp Web (meu navegador)**.
4. Clique **Abrir e revisar no WhatsApp Web**. Se preciso, autentique o WhatsApp Web.
5. Verifique telefone, destinatário e texto, então clique em **Enviar** no próprio WhatsApp.
6. Retorne ao Lexis e registre o atendimento por seu fluxo habitual **apenas após confirmar envio real**.

Para envio via worker, mude o canal para **WA.Auto** e confirme que a ponte está conectada. A conexão não é automaticamente criada por esta mudança.

## O que não acontece
- Um clique em "Abrir" não é um envio nem uma entrega confirmada.
- Não é possível ler a sessão WhatsApp de outra origem ou manipular o DOM da aba pelo código hospedado em Vercel (política de mesma origem).
- Não há envio em lote, leitura de resposta ou sincronização automática dos chats por este modo.
- O WhatsApp Web não executa o motor Qwen no navegador; os mecanismos são independentes.

## ego-lite: referência de navegador para agentes
Projeto: https://github.com/citrolabs/ego-lite

ego-lite oferece Spaces locais e uma skill CLI chamada `ego-browser`. **Não é um backend disponível para ser usado diretamente na Vercel.** Sua adoção como automação de WhatsApp depende de instalação e execução local, consentimento e uma ponte autorizada, com evidência de envio e controle de sessão. Este patch não instala o executável, não migra cookies, não cria ponte e não automatiza envio silenciosamente.

## Segurança
- Isolamento entre empresas mantido pelo processo selecionado no painel.
- Números validados em E.164 e mensagem limitada para link.
- Sujeito às normas de WhatsApp/Meta, consentimento dos destinatários e diretrizes internas.
- Se a mensagem idêntica já estiver no histórico, o operador precisa confirmar a abertura novamente.
- Não marcar `ultimo_retorno`, "enviado" ou "delivered" sem comprovação por canal confiável.
- Evitar envio repetido após falhas ou timeout de provedor.

## Arquivos
- `src/lib/whatsapp-links.ts`
- `src/lib/whatsapp-links.test.ts`
- `src/app/whatsapp/page.tsx`
- `skills/whatsapp-browser/SKILL.md`
- `skills/lexis-ai-suite/agents/whatsapp-browser.md`

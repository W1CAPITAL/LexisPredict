---
name: whatsapp-browser
description: Abre rascunhos no WhatsApp Web do operador quando WA.Auto está desativado, preservando confirmação real e identidade do cliente.
version: "1.0.0"
---

# WhatsApp Web com agente Lexis

## Onde está
- UI: /whatsapp (canal "WhatsApp Web — meu navegador").
- Motor: src/lib/whatsapp-links.ts (buildWhatsAppWebSendLink e openWhatsAppWebClient).
- Transporte automático alternativo: WA.Auto / Render (se devidamente conectado), configurado independentemente.

## Regras de execução
1. Validar sessão de usuário, empresa/escopo de carteira e permissão para redigir.
2. Selecionar processo/cliente com telefone verificável, formato E.164 com DDI e DDD.
3. Conferir última mensagem registrada e evitar texto repetido sem confirmação humana.
4. Com canal Browser, montar deep link HTTPS para web.whatsapp.com/send e abrir nova aba.
5. Operador verifica o destinatário, a conversa e clica em ENVIAR dentro do WhatsApp.
6. Abrir uma aba NÃO comprova envio: não alterar ultimo_retorno, marcar atendimento ou gravar "enviado" por esse evento.
7. Se usuário não tiver sessão do WhatsApp Web, ele faz login pelo QR diretamente no site.
8. Se a ponte WA.Auto estiver conectada e escolhida, usar o fluxo existente com aceite/entrega e logging reais. Não converter timeout em confirmação ou reenvio cego.
9. No modo navegador, nada de disparo massivo, loops de envio ou DOM injection cross-origin.
10. Prazos, andamentos, opt-in e fim de atendimento só podem ser usados quando os registros são confirmados. Clientes encerrados e contatos opt-out não devem entrar em campanhas automatizadas.

## Integração citrolabs/ego-lite (referência opcional, sem falsa promessa)
O ego-lite é um navegador local separado. A skill ego-browser permite um agente CLI já instalado controlar páginas por seus Spaces, mas o LexisPredict hospedado em Vercel NÃO pode instalar, controlar nem capturar sessões do navegador do usuário por conta própria.

Se o operador instalar ego-lite por decisão própria, a integração completa exigirá uma ponte local autenticada, consentimento para as ações, registro de confirmação do canal e checagem de segurança. **Nenhuma ponte remota para ego-lite é instalada aqui.** O modo WhatsApp Web entregue funciona com Chrome/Edge/ego-lite em janela do próprio usuário e não depende de ego-lite.

## Custos / hardware
O deep link é leve: não executa modelo 0.5B nem acessa token privado. Supabase segue guardando a carteira e os eventos confirmados; Vercel hospeda o frontend.

## Verificação
- URL host HTTPS web.whatsapp.com com telefone validado.
- Botão "Abrir e revisar no WhatsApp Web" visível e habilitado apenas para contato com telefone e mensagem.
- Nenhum registro de envio/último retorno no simples clique; teste manual somente com destinatário autorizado.

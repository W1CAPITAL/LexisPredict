# Agente: Navegador WhatsApp (handoff humano)

Capacidade implementada: preparar rascunho e abrir WhatsApp Web com texto preenchido no navegador autenticado do próprio operador.

- Não confundir WhatsApp Web com WA.Auto ou API Meta.
- Não ler DOM, cookies, QR Code ou conteúdo de outras abas a partir da origem Lexis.
- Conferir CNJ/cliente com carteira autorizada antes do texto.
- Se dados ambíguos: saudação e informação de conferência, sem andamento inventado.
- Reutilizar rascunho e evitar duplicidade, respeitar opt-out, consentimento e status encerrado.
- Clique em "Abrir" nunca registra mensagem como enviada; exigir confirmação do canal para lançar último retorno.
- Produção automática de mensagens em lote continua reservada a transporte autorizado com prova de envio.
- Não acionar o modelo pesado local para redigir rascunho; scripts e evidências disponíveis são padrão.
- ego-lite/ego-browser pode servir como inspiração de ambiente isolado de agentes, porém requer instalação e execução local fora da Vercel, não está integrado automaticamente.

Ver skills/whatsapp-browser/SKILL.md e docs/WHATSAPP-WEB-NAVEGADOR.md.

# WhatsApp dentro do LexisPredict — ponte local gratuita

Este módulo cria uma conexão de **dispositivo vinculado** com o WhatsApp, usando a biblioteca aberta [Baileys](https://github.com/WhiskeySockets/Baileys). O QR Code, as conversas e os envios ficam na tela do CRM, enquanto a sessão criptográfica permanece **no computador da empresa**. Não usa o antigo WA.Auto suspenso, Evolution, API Meta, CNPJ nem mensalidade de outro provedor.

**Limites importantes:** Baileys é uma integração **não oficial** e pode se desconectar ou causar restrições pela plataforma do WhatsApp. Não use para spam/disparo em massa. O servidor da Vercel não sustenta conexões WhatsApp contínuas: **um computador precisa manter este programa rodando enquanto houver atendimento**. Sem ele, o CRM mostra Offline e não envia mensagens.

## Instalação no Windows (uma vez)

1. Acesse LexisPredict → WhatsApp → **Conectar dispositivo local** → **Gerar credencial**. Só gestores podem gerar a credencial. Copie o token **sem compartilhá-lo**. Criar outro revoga o anterior.
2. Baixe o repositório e abra a pasta `workers/wa-local`. É necessário **Node.js 20+** instalado (gratuito). Clique em `iniciar-windows.cmd`. Ele instala as dependências na primeira execução.
3. Edite o arquivo `.env` aberto pelo script. Use `LEXIS_URL=https://lexispredict.vercel.app` e cole a credencial em `LEXIS_BRIDGE_TOKEN`. Salve e feche o editor.
4. O script abre a conexão. No próprio LexisPredict, aparecerá o **QR Code**. No WhatsApp do telefone: **Aparelhos conectados → Conectar aparelho**. Escaneie o QR apresentado no CRM.
5. Com a sessão conectada, selecione uma conversa/processo no CRM. Clique em **Enviar dentro do CRM**. A mensagem entra na fila, e o trabalhador local a envia. O status *aceita*, *entregue* ou *lida* só muda se houver confirmação.

O arquivo `.env` e a pasta `session/` contêm credenciais. **Nunca envie nem publique esses arquivos.** São ignorados pelo Git.

Não há disparos automáticos de campanhas nesta fase. O processamento de avisos em massa permanece desativado até revisão dos filtros de consentimento, descadastro e riscos de bloqueio.

## Operação

O computador precisa estar ligado e com internet. Ao fechar o terminal, o painel fica Offline após aproximadamente 45 segundos. Ao reiniciar, a sessão é recuperada de `session/`. Se gerar um novo token no CRM, atualize `.env` e reinicie.

Pode hospedar este mesmo trabalhador num computador próprio sempre ligado; não é necessária assinatura mensal do provedor, mas há custo de energia/internet e eventual manutenção.

A hospedagem Vercel continua sendo somente a interface e a API de controle, com Supabase pago/atual para o histórico e a fila; o aplicativo **não** precisa mostrar ou fornecer a chave `SUPABASE_SERVICE_ROLE_KEY` ao trabalhador.

O método não incorpora a página WhatsApp Web em um iframe (ela não aceita essa incorporação); é uma interface de conversas própria dentro do CRM.

# WA.Auto integrado — LexisPredict e Render

O CRM (Vercel) consulta um servidor próprio Node.js (Render) executando um cliente WhatsApp vinculado por QR Code (Baileys, implementação **não oficial**). Não depende do WA.Auto antigo nem da Evolution; não requer CNPJ. O usuário opera a partir do próprio LexisPredict, sem instaladores.

A especificação do serviço está em `render.yaml` (plano gratuito, `rootDir: workers/wa-local`, `/health`). Esta especificação apenas prepara o serviço; ela **não o implanta sozinha**. Para começar, o servidor Render precisa ser provisionado com o segredo `LEXIS_BRIDGE_TOKEN` (256 bits), cujo SHA-256 deve corresponder à entrada da empresa em `wa_local_bridges`. Uma credencial divulgada anteriormente não pode ser reutilizada.

O QR Code só aparecerá na aba WhatsApp quando o servidor enviar um QR real. A primeira vinculação exige escanear pelo WhatsApp do aparelho em **Aparelhos conectados**. Depois da vinculação, a sessão é armazenada no Supabase como ciphertext AES-256-GCM, criptografado com a credencial do worker, para que reinícios no Render não apaguem o pareamento. Opcionalmente configure `WA_AUTO_RENDER_URL` no Vercel com o hostname HTTPS real do Render para acordar o serviço gratuito quando o painel for aberto.

**Limitações:** Render Free hiberna após inatividade e pode suspender uma instância por consumo; não há garantia de 24/7. A integração WhatsApp Web não é oficial e pode sofrer restrições. Campanhas em massa permanecem desativadas. A chave administrativa do Supabase nunca sai da Vercel.

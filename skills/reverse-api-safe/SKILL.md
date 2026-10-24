---
name: reverse-api-safe
description: Inspeção passiva de HAR em sistemas próprios ou autorizados sem cookies, tokens ou replay.
version: "1.0.0"
---
# Reverse API no LexisPredict

Referência: https://github.com/kalil0321/reverse-api-engineer

O projeto de referência combina captura, HAR e geração de clientes. A versão Lexis mantém somente a análise passiva e local. O prompt original contém orientação para hardcode de credenciais e bypass de proteções; essas práticas não são adotadas.

## Implementação
- Página /estudio-agentes#auditoria-api.
- src/lib/agent-improvements/har-observer.ts.
- HAR 1.2 exportado pelo operador, limite 3 MiB e 2.000 entradas.
- Analisa host, rota anonimizada, método, volume, latência, erros 5xx, status 401/403 e 429.
- Sem envio de HAR ao servidor, execução de requisições, persistência de sessões ou download de dependências.

## Alvos úteis
- APIs próprias /report, /processos, /tarefas, /whatsapp e demais rotas Next.js.
- Contratos Supabase do próprio projeto, sem exposição de tokens/valores da query.
- DataJud/DJEN somente pelos acessos oficiais/documentados permitidos.
- Worker WA.Auto próprio, não a API privada ou sessão de WhatsApp Web.
- Gate antes de integrar: dono do endpoint, autorização, documentação, escopo, rate limit, privacidade, teste e revisão humana.

## Limites
Não contornar login, MFA, WAF, CAPTCHA, proteção antibot ou limites. Não gerar código com cookies/tokens capturados, não armazenar payloads sensíveis.

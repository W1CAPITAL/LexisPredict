# LexisPredict — Security Report

Gerado em: 2026-08-08T12:53:10.443Z · Motor: full

## Resumo

- Score de exposição: **0/100** (grade F)
- Achados: 67
- OWASP com falha: 3

### Recomendações

1. Evite; se necessário, sanitize o HTML antes de renderizar.
2. Use textContent/React; sanitize ou evite injetar HTML com entrada.
3. Adicione guarda de autenticação/autorização em cada rota sensível (página + server action).
4. Adicione CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy e Permissions-Policy.
5. Mantenha dependências atualizadas e remova pacotes vulneráveis (npm audit fix).

## Code Security

| Severidade | Arquivo | Linha | Regra | Detalhe |
|---|---|---|---|---|
| high | `src/components/ui/chart.tsx:81` | 81 | dangerouslySetInnerHTML | dangerouslySetInnerHTML |
| high | `src/app/revisional/page.tsx:388` | 388 | innerHTML / outerHTML / document.write | document.write( |
| medium | `src/lib/djen-busca-texto.ts:13` | 13 | fetch com URL dinâmica | fetch(`${DJEN_URL}?${ |
| medium | `src/lib/djen.ts:263` | 263 | fetch com URL dinâmica | fetch(`${DJEN_URL}?${ |
| medium | `src/lib/ai/cascade.ts:326` | 326 | fetch com URL dinâmica | fetch(`${ |
| medium | `src/lib/ai/xai-prestige.ts:53` | 53 | fetch com URL dinâmica | fetch(`${ |
| medium | `src/components/system/app-update-banner.tsx:20` | 20 | fetch com URL dinâmica | fetch(`/api/version?t=${ |
| medium | `src/app/actions/document-actions-djen-snippet.ts:20` | 20 | fetch com URL dinâmica | fetch(`${ |
| info | `document-flow.ts:143` | 143 | console.log em produção | console.log( |
| info | `src/lib/performance-motor.ts:116` | 116 | console.log em produção | console.log( |
| info | `src/lib/ai/context.ts:9` | 9 | console.log em produção | console.log( |
| info | `src/lib/ai/memory.ts:11` | 11 | console.log em produção | console.log( |
| info | `src/app/api/datajud-worker/route.ts:41` | 41 | console.log em produção | console.log( |

## OWASP Top 10

| ID | Categoria | Status | Resumo |
|---|---|---|---|
| A01 | Broken Access Control | FAIL | 26 página(s) sem referência visível a autenticação/autorização (useAuth/profile). |
| A02 | Cryptographic Failures | PASS | 0 hash/cifra fraca · 0 requisição HTTP sem TLS. |
| A03 | Injection | PASS | 0 SQL · 0 command · 0 eval. |
| A04 | Insecure Design | REVIEW | Revisão de desenho sugerida para fluxos que consomem fontes externas (DataJud/DJEN), uploads e peças geradas. |
| A05 | Security Misconfiguration | FAIL | Faltam 6 header(s) de segurança no middleware: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Content-Security-Policy, Strict-Transport-Security, Permissions-Policy. |
| A06 | Vulnerable & Outdated Components | FAIL | npm audit: 0 crítica · 10 alta · 52 média · 0 baixa. |
| A07 | Identification & Authentication Failures | WARN | Sem evidência de rate limit/lockout nos fluxos de autenticação. |
| A08 | Software & Data Integrity | PASS | Lockfile presente — dependências pinadas por integridade. |
| A09 | Security Logging & Monitoring | PASS | Logs de auditoria de ações detectados (auditoria_logs_app). |
| A10 | SSRF | WARN | 6 chamada(s) com URL dinâmica encontrada(s). |

## Trail of Bits Review

| Status | Check | Detalhe |
|---|---|---|
| WARN | Autenticação em ações de servidor | 26/56 arquivos 'use server' chamam getUserContext (46%). |
| PASS | Escopo multi-tenant por empresa | 24 arquivos filtram por empresa_id. |
| WARN | Validação de entrada nas ações | 18/56 arquivos usam zod/parse para validar entrada. |
| WARN | Rate limiting em rotas públicas | Sem evidência de rate limiting em login/APIs públicas. |
| FAIL | Cabeçalhos de segurança (CSP/HSTS) | Faltam: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Content-Security-Policy, Strict-Transport-Security, Permissions-Policy. |
| PASS | Higiene de segredos | 0 credencial hardcoded · 0 chave privada. |
| WARN | SSRF — controle de destinos externos | 6 fetch com URL dinâmica. |
| FAIL | Dependências auditadas | npm audit: 0 crítica · 10 alta. |
| WARN | Cookies de sessão (httpOnly/SameSite) | httpOnly: não detectado · SameSite: não detectado. |
| REVIEW | Erros não vazam detalhes internos | 35 arquivos devolvem e?.message ao cliente — revise para não expor detalhes internos. |
| FAIL | CSP restritivo ativo | Sem Content-Security-Policy no middleware. |

## Ponytail Audit

| Severidade | Arquivo | Regra | Fix |
|---|---|---|---|
| medium | `document-flow.ts:1` | Função exportada documentFlow definida em 3 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `document-flow.ts:1` | Função exportada extrairDadosProcuracao definida em 3 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `middleware.ts:1` | Função exportada middleware definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `middleware.ts:1` | Função exportada config definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/busca-apreensao-logic.ts:1` | Função exportada digitsOnly definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/busca-apreensao-logic.ts:1` | Função exportada normalizeName definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/case-logic.ts:1` | Função exportada isCasoEncerrado definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/cnj-extract.ts:1` | Função exportada extractCnjFromText definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/djen-keywords-patch.ts:1` | Função exportada summarizeDjenKeywords definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/djen-keywords-patch.ts:1` | Função exportada classifyEventFromText definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/notes-update-snippet.ts:1` | Função exportada updateStoredNote definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/puter-ai-client.ts:1` | Função exportada puterChat definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/server-db.ts:1` | Função exportada clearDataJudAuditAction definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/supabase/client.ts:1` | Função exportada createClient definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/genkit.ts:1` | Função exportada ai definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/motor-despacho.ts:1` | Função exportada gerarRascunhoEstrategico definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/case-risk-analysis.ts:1` | Função exportada caseRiskAnalysis definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/chat-ai-flow.ts:1` | Função exportada chatAIFlow definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/chat-ai-flow.ts:1` | Função exportada perguntarIA definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/note-analysis-flow.ts:1` | Função exportada analisarEvidenciasLocais definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/note-analysis-flow.ts:1` | Função exportada noteAnalysisFlow definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/note-analysis-flow.ts:1` | Função exportada analisarNotasIA definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/theme-architect-flow.ts:1` | Função exportada generateNeuralTheme definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/veredito-ai-flow.ts:1` | Função exportada vereditoAIFlow definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/lib/ai/flows/veredito-ai-flow.ts:1` | Função exportada executarVereditoAI definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/components/pdf/habilitacao-peca-pdf.tsx:1` | Função exportada HabilitacaoPecaPDF definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/app/api/webhook/evolution/route.ts:1` | Função exportada POST definida em 7 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/app/api/version/route.ts:1` | Função exportada dynamic definida em 9 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/app/api/version/route.ts:1` | Função exportada GET definida em 4 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/app/api/queue/enqueue-scan/route.ts:1` | Função exportada preferredRegion definida em 5 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/app/api/datajud-worker/route.ts:1` | Função exportada maxDuration definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/app/actions/case-actions.ts:1` | Função exportada recalibrateCasesAction definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| medium | `src/app/actions/document-actions-djen-snippet.ts:1` | Função exportada generateDjenPublicationPDFAction definida em 2 arquivos | Centralize em um único módulo e importe onde precisar. |
| low | `src/lib/security-scanner.mjs:1` | Arquivo monolítico (887 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/lib/server-db.ts:1` | Arquivo monolítico (761 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/lib/xlsx-dossie-builder.ts:1` | Arquivo monolítico (945 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/data/cases.json:1` | Arquivo monolítico (6474 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/components/ui/sidebar.tsx:1` | Arquivo monolítico (764 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/components/pdf/dossie-cliente-pdf.tsx:1` | Arquivo monolítico (859 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/tarefas/page.tsx:1` | Arquivo monolítico (769 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/settings/page.tsx:1` | Arquivo monolítico (1080 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/revogacao-poderes/page.tsx:1` | Arquivo monolítico (710 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/revisional/page.tsx:1` | Arquivo monolítico (799 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/report/page.tsx:1` | Arquivo monolítico (885 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/processos/page.tsx:1` | Arquivo monolítico (732 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/cases/page.tsx:1` | Arquivo monolítico (1058 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/actions/automacao-register-actions.ts:1` | Arquivo monolítico (817 linhas) | Quebre em módulos menores de responsabilidade única. |
| low | `src/app/actions/case-actions.ts:1` | Arquivo monolítico (740 linhas) | Quebre em módulos menores de responsabilidade única. |
| info | `document-flow.ts:1` | console.log deixado (1) | Remova ou troque por logger condicionado. |
| info | `src/lib/performance-motor.ts:1` | console.log deixado (1) | Remova ou troque por logger condicionado. |
| info | `src/lib/ai/context.ts:1` | console.log deixado (1) | Remova ou troque por logger condicionado. |
| info | `src/lib/ai/memory.ts:1` | console.log deixado (1) | Remova ou troque por logger condicionado. |
| info | `src/app/api/datajud-worker/route.ts:1` | console.log deixado (1) | Remova ou troque por logger condicionado. |
| info | `scripts/security-scan.mjs:1` | console.log deixado (6) | Remova ou troque por logger condicionado. |

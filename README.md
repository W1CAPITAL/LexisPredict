# LexisPredict

### Plataforma de operações jurídicas e inteligência de carteira

> SaaS multi-tenant para gestão processual, prazos, atendimento, auditoria CNJ (**DataJud**), diário oficial (**DJEN**), automação de captura, documentos, notas CRM e equipe — feito para **rotina de gabinete com volume** (centenas a milhares de processos).

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/DataJud-CNJ-orange?style=for-the-badge" alt="DataJud" />
  <img src="https://img.shields.io/badge/DJEN-Diário-blue?style=for-the-badge" alt="DJEN" />
  <img src="https://img.shields.io/badge/AI-Cascade-purple?style=for-the-badge" alt="AI" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License" />
</p>

**Produção:** [private-assecom.vercel.app](https://private-assecom.vercel.app/)  
**Titular:** Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.  
**Contato:** w1capitalassessoria@protonmail.com  
**Licença:** Proprietária — ver [`LICENSE`](./LICENSE)

---

## Visão geral

O **LexisPredict** organiza a operação de assessorias e bancas que convivem com planilhas legadas, prazos, atendimento, evidências de tribunal/diário e cobrança de retorno ao cliente.

```text
Importação CSV / planilha
    → Carteira (status, prazo, retorno, escritório, advogado)
    → Scanner híbrido DataJud ∪ DJEN (lote / pontual / worker)
    → Flags: novidade, baixa/trânsito, B.A., cumprimento, mérito
    → Fila de tarefas (prioridade unificada)
    → Sugerir resposta (scripts pelo teor real + rascunho IA opcional)
    → Automação Judicial (pipeline 01–08, captura, OCR, custas TJSP)
    → Documentos PDF (procuração, habilitação, substabelecimentos)
    → Dossiê operacional do cliente (risco, timeline, plano de ação)
    → Indicadores / urgências / equipe
```

> Nascido de uso real em operação — não de protótipo de vitrine.

---

## Módulos (mapa do produto atual)

### Operação

| Rota | Módulo | Função |
|------|--------|--------|
| `/` | **Painel** | Telemetria, risco global, preview da fila, saúde do scanner |
| `/tarefas` | **Fila de contato** | Prioridade unificada, Audit 3D, sugerir resposta, rascunho IA |
| `/cases` | **Processos** | Carteira completa, novo processo, scan pontual, dossiê PDF, Excel |
| `/tools/automacao` | **Automação Judicial** | Pipeline 01–08, eproc/e-SAJ, captura/OCR, cadastro na carteira, **Custas TJSP** |
| `/team` | **Equipe** | Cargos, escopo multi-tenant, KPI (admin) |

### Ferramentas

| Rota | Módulo | Função |
|------|--------|--------|
| `/veredito` | **Consulta processo** | Consulta embutida / fontes de tribunal |
| `/chat` · `/chat-ia` · `/chatbot-separado` | **Assistente IA** | Chat jurídico com cascata de motores |
| `/documents` | **Procuração** | PDF de procuração |
| `/habilitacao-peca` | **Habilitação** | Peça de habilitação em PDF |
| `/substabelecimento` · `/substabelecimento-simples` · `/substabelecimento-peca` | **Substabelecimentos** | Três variantes de documento |
| `/whatsapp` | **WhatsApp** | Links / disparo operacional |
| `/import` | **Importar** | CSV/planilha em volume, normalização, dedupe por CNJ |
| `/notes` | **Notas** | CRM de anotações (cliente/protocolo) |
| `/tools/ocr` | **OCR** | Transcrição de prints e documentos |
| `/onboarding` | **Treinamento** | Guia + vídeo de apoio |

### Sistema

| Rota | Módulo | Função |
|------|--------|--------|
| `/analytics` | **Indicadores** | Métricas de carteira e operação |
| `/urgency` | **Urgências** | Foco em casos críticos |
| `/settings` | **Configurações** | Empresa, banca de advogados (dados completos), preferências, motores de IA |

---

## Destaques recentes (o que o README antigo não cobria)

### Automação Judicial (pipeline 01–08)
1. **Captura** — eproc prioritário (SP), e-SAJ 1º/2º grau, embed no app, print/OCR, **screenshot automático** por CNJ (Chromium serverless; CAPTCHA → operador)
2. **Triagem** — categorização com OCR / sinais (classe, BA, sentença, custas)
3. **Cadastro** — grava direto na carteira (`processos`)
4. **Classificação** → **Demanda** → **Análise** → **Devolutiva** → **Recomendações**
5. Subaba **Custas (TJSP)** — portal de custas embutido / apoio a guias

### Scanner & telemetria
- Worker DataJud + status/trigger (`/api/datajud-*`)
- Proxy DJEN e health de scan
- Flags de auditoria (novidade pós-retorno, baixa, B.A., cumprimento)
- Métricas de sucesso por fonte (quando instrumentado)

### Sugerir resposta (Tarefas e Processos)
- Motor **determinístico pelo teor** DataJud/DJEN (não só catálogo genérico)
- Detecta indeferimento, extinção sem mérito, trânsito/arquivo, custas, emenda, B.A., etc.
- Rascunho IA opcional com **cascata de motores** (xAI, Groq, OpenRouter, Puter, Lexis local…)
- Componente `AiDraftPreview` com contraste legível (fundo escuro / texto claro)

### Dossiê operacional do cliente (PDF)
- 2 páginas estilo corporativo LexisPredict
- KPIs (status, fase, advogado, prazo com dias de atraso)
- Índice de risco 0–100 + painel de prioridade (pontos)
- Pontos fortes × pontos de atenção
- Linha do tempo DataJud + DJEN em destaque
- Resumo executivo, plano de ação numerado, leitura estratégica
- HTML entities do DJEN decodificadas; rodapé com paginação real

### Banca de advogados
- Cadastro/edição com campos operacionais (e-mail, telefone, endereço, CPF/RG, OAB…) para peças e procurações
- Integração de consulta OAB (quando configurada)

### Notas CRM
- Notas vinculadas a cliente/protocolo
- Edição e sincronização com histórico do cliente

### Exportações
- Excel da carteira (visão operacional, sem colunas técnicas de ID)
- PDF DJEN / decisões com branding
- Dossiê por processo na aba Processos

### Multi-tribunal
- Mapa de links TJ/TRF (`tribunais-links`)
- Ações de abertura/consulta e captura de evidência

---

## Prioridade da fila de tarefas

1. Indício de **busca e apreensão**
2. **Baixa / trânsito** no tribunal
3. Eventos de **mérito** (sentença, liminar, audiência…)
4. Novo andamento / **publicação DJEN** pós-retorno
5. Score de **prazo** e tempo sem retorno ao cliente

---

## Inteligência artificial (honestidade operacional)

| Camada | Papel |
|--------|--------|
| Scripts determinísticos | Mensagens ao cliente baseadas no **teor** (DataJud/DJEN) |
| Rascunho IA | Opcional; validação humana obrigatória |
| Cascata de motores | Troca automática quando tokens/limites falham (xAI, Groq, OpenRouter free, Puter, motor Lexis) |
| Assistente / chat | Consulta orientada; pode enriquecer com dados de processo quando disponíveis |

> A IA **não substitui** advogado nem certidão oficial do tribunal.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Front | Next.js 15 (App Router), React, TypeScript, Tailwind, shadcn/ui, Zustand |
| Back | Server Actions, rotas `/api/*` (worker, cron, proxy DJEN, version) |
| Dados | Supabase Auth + PostgreSQL (RLS / `empresa_id`) |
| PDF | `@react-pdf/renderer` (dossiê, peças, DJEN) |
| Captura | `puppeteer-core` + `@sparticuz/chromium` (screenshot tribunal) |
| Deploy | Vercel |
| Testes | Vitest · Playwright (e2e) |

**Fonte de verdade da carteira:** Supabase. UI (filtros, progresso de scan) pode usar estado local.

---

## APIs e variáveis de ambiente (resumo)

Configure no Vercel / `.env` conforme o que for usar:

| Grupo | Exemplos |
|-------|----------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, chaves anon |
| DataJud | token/API pública CNJ |
| IA | `XAI_API_KEY`, `GROQ_API_KEY`, modelos (`XAI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL`…) |
| WhatsApp | Evolution API (se habilitada) |
| Cron | secret do worker DataJud |

Não commitar segredos. Preferir um único caminho de deploy: **git push → Vercel**.

---

## Onboarding

1. **Treinamento** (`/onboarding`) e **Guia rápido** na sidebar — tour alinhado ao produto atual  
2. Preferir o guia interativo: vídeos podem ficar defasados em detalhes de UI  
3. Fluxo sugerido para novo operador: Importar → Processos → Scanner → Tarefas → Sugerir resposta → Dossiê  

---

## Limites honestos

- **DataJud ≠ PJe/e-SAJ** — pode atrasar ou divergir; use para triagem, não como certidão.  
- **DJEN** pode falhar por rede, geo (403) ou rate limit.  
- Lotes grandes são **sequenciais de propósito** (estabilidade).  
- Heurísticas de B.A. / encerramento / risco **não são garantia jurídica**.  
- Screenshot automático **não vence CAPTCHA** humano: o app tenta; se bloquear, use embed + envio de print + OCR.  
- Cron na Vercel **Hobby**: no máximo 1 execução/dia; lote manual/nuvem sob demanda é a operação real.  
- Cascata de IA depende de chaves e cotas dos provedores.

---

## Segurança e multi-tenant

- Isolamento por `empresa_id`  
- Auth Supabase e controle por cargo (admin / operador)  
- Software **proprietário** — repositório visível ≠ open source  
- Ver também `MANIFESTO_DE_INTEGRIDADE.json` no repositório  

---

## Desenvolvimento

```bash
npm install
npm run dev          # porta 9002 (Turbopack)
npm run typecheck
npm run build
npm test             # vitest
npm run test:e2e     # playwright
```

---

## Estrutura relevante (src)

```text
src/app/           # rotas App Router (cases, tarefas, tools/automacao, …)
src/app/actions/   # Server Actions (scan, dossiê, captura, notas, OAB, …)
src/app/api/       # workers DataJud, proxy DJEN, cron, version
src/components/    # UI: layout, pdf, ai, scanner, dashboard, …
src/lib/           # DataJud, DJEN, scripts, risco, pipeline, tribunais, IA
```

---

## Licença e contato

Copyright © 2026  
**Davi Alves Figueredo**  
**W1 Capital Assessoria Financeira Ltda.**

Todos os direitos reservados. Proibido copiar, modificar, distribuir ou explorar comercialmente sem autorização escrita.

**Comercial:** w1capitalassessoria@protonmail.com

---

**LexisPredict** — gabinete digital para quem vive de prazo, processo e operação.

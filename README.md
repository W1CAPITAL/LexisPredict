# LexisPredict

### Plataforma de operações jurídicas e inteligência de carteira

> SaaS multi-tenant para gestão processual, prazos, atendimento, auditoria CNJ (**DataJud**), diário oficial (**DJEN**), CRM de assessoria financeira, peças e equipe — feito para **rotina de gabinete com volume**.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node-24-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/DataJud-CNJ-orange?style=for-the-badge" alt="DataJud" />
  <img src="https://img.shields.io/badge/DJEN-Diário-blue?style=for-the-badge" alt="DJEN" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License" />
</p>

**Produção:** [private-assecom.vercel.app](https://private-assecom.vercel.app/)  
**Titular:** Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.  
**Contato:** w1capitalassessoria@protonmail.com  
**Licença:** Proprietária — ver [`LICENSE`](./LICENSE)  
**Produto:** 9.57 · **app:** 1.13.3

---

## Operação de hoje

1. **Painel** — vencidos e novidades.  
2. **Fila** — quem atender agora.  
3. **Parados** — silêncio no tribunal; filtrar fase; retomar scan.  
4. **Processos** — fase honesta + dono / último ato.  
5. **Peças** — Central de documentos.  
6. **Régua** — só atrasados; marcar pago.  
7. **WhatsApp** — próximo vencido; Evolution acorda **só no Enviar**.  
8. O resto fica em **Mais**.  
9. Superadmin define **pacote da empresa** (Máximo = todos).  
10. Recarregou no meio do lote? **Retomar fila**.

---

## Visão geral

```text
Importação CSV / planilha
    → Carteira (status, prazo, retorno, escritório, advogado, dono)
    → Scanner híbrido DataJud ∪ DJEN (lote / pontual / worker / resume)
    → Flags honestas: fase + o que falta (não “ALERTA BA” por jurisprudência)
    → Fila de tarefas + Parados por fase
    → Sugerir resposta (teor real + rascunho IA opcional)
    → Automação Judicial (pipeline 01–08, captura, OCR, custas TJSP)
    → Documentos PDF (padrão Ad Judicia)
    → CRM assessoria (funil, a receber, régua D0+)
    → Dossiê / Excel operacional
```

Nascido de uso real — não de vitrine.

---

## Pacotes por empresa

| Plano | Conteúdo |
|--------|----------|
| **Essencial** | Painel, carteira, tarefas, cadastro, config |
| **Operacional** | Essencial + tribunal, WhatsApp, peças, parados, alertas |
| **Financeiro** | Essencial + CRM, caixa, dossiê |
| **Máximo** | União dos três |

Configurações (Superadmin) → Pacotes por empresa. Sem plano gravado, a empresa atual permanece em Máximo.

---

## Módulos

### Operação

| Rota | Módulo | Função |
|------|--------|--------|
| `/` | Painel | Telemetria, risco, preview da fila |
| `/tarefas` | Fila | Prioridade, Audit 3D, sugerir resposta, dono/último ato |
| `/cases` | Processos | Carteira, scan, dossiê, Excel, fase honesta |
| `/processos` | Visão da empresa | Carteira consolidada |
| `/processos-parados` | Parados | Fase, XLSX, scanner com pause/resume, log CNJ |
| `/agenda` | Agenda | Semana / prazos |
| `/tools/automacao` | Automação Judicial | Pipeline 01–08, eproc/e-SAJ, OCR, Custas TJSP |
| `/team` | Equipe | Cargos, multi-tenant |
| `/clients` | Clientes | Cadastro operacional |

### Ferramentas

| Rota | Módulo | Função |
|------|--------|--------|
| `/veredito` | Consulta | DataJud + DJEN, CPF / CNJ |
| `/documents` | Central de peças | Procuração, habilitação, substabelecimentos, revogação |
| `/whatsapp` | WhatsApp | Scripts, Evolution (wake só no envio), próximo vencido |
| `/import` | Importar | CSV/planilha, dedupe CNJ |
| `/notes` | Notas CRM | Cliente / protocolo |
| `/tools/ocr` | OCR | Prints e documentos |
| `/onboarding` | Treinamento | Caminho do dia + tour |
| `/chat` | Assistente | Cascata de motores (opcional) |

### CRM / financeiro

| Rota | Função |
|------|--------|
| `/crm` | Hub assessoria |
| `/crm/funil` | Lead → contrato |
| `/crm/cobranca` | Régua D0+ e marcar pago |
| `/crm/financeiro` | Receber / pagar |
| `/financas` | Caixa operacional |
| `/report` | Dossiê / relatório |

### Sistema

| Rota | Função |
|------|--------|
| `/analytics` | Indicadores |
| `/urgency` | Urgências |
| `/settings` | Empresa, banca, temas, motores, pacotes |
| `/supervisao` | Visão supervisor |
| `/security` | Só Superadmin |

---

## Destaques atuais

### Flags honestas
- Card mostra **fase** e **o que falta** (contestação, réplica, cumprimento, silêncio).
- B.A. só com classe/rito e contexto de mandado — jurisprudência citada **não** gera alerta.
- Cumprimento já recebido sai dos parados.

### Processos parados
- Filtro multi: sem contestação / sem sentença / sem réplica / cumprimento aberto / janela recente.
- Export CSV/XLSX da lista filtrada.
- Scanner em lote com checkpoint (recarregar = retomar).
- Log: CNJ · motor · ok/falha · hora.

### Régua de cobrança
- Só atrasados (D0+) por padrão.
- Script do agente + **marcar pago**.
- Sem gateway pago.

### Peças
- Formatação no padrão Ad Judicia (qualificação, poderes, art. 105 CPC).
- Opção de incluir ou omitir nome/CNPJ do banco.
- Validação de nome, CPF e placeholders.

### WhatsApp
- Evolution acorda **somente no Enviar**.
- Antiban: delay, composing, teto diário, texto idêntico bloqueado.
- Atalhos Mais vencido / Menos vencido.

### Atualizações em tempo real
- Banner quando o `buildId` muda (`/api/version`, 12s + foco).
- Menu **Notas**: em vigor, próximas e log (15s).
- Fonte: `src/lib/release-feed.ts`.

---

## Prioridade da fila

1. Indício real de busca e apreensão  
2. Baixa / trânsito no tribunal  
3. Mérito (sentença, liminar, audiência)  
4. Publicação DJEN pós-retorno  
5. Prazo e tempo sem retorno  

---

## Inteligência artificial

| Camada | Papel |
|--------|--------|
| Scripts determinísticos | Mensagem pelo **teor** DataJud/DJEN |
| Rascunho IA | Opcional; humano valida |
| Cascata | xAI, Groq, OpenRouter, Puter, motor Lexis — se configurado |
| Scanner + Claude | Só depois de ativar o motor no Núcleo Neural |

A IA **não** substitui advogado nem certidão do tribunal.

---

## Stack (atual)

| Camada | Tecnologia |
|--------|------------|
| Front | **Next.js 16.3** (App Router), **React 19**, **TypeScript 7**, Tailwind, shadcn/ui, Zustand |
| Runtime | **Node 24.x** (Vercel) |
| Back | Server Actions, `/api/*` (worker, cron, proxy DJEN, version) |
| Dados | Supabase Auth + PostgreSQL (RLS / `empresa_id`) |
| PDF / Excel | `@react-pdf/renderer` · SheetJS |
| Captura | `puppeteer-core` + `@sparticuz/chromium` (quando habilitado) |
| Deploy | Vercel · `middleware.ts` **só na raiz** |
| Testes | Vitest · Playwright |

`engines.node` = `24.x`. Lint: `eslint .` (sem `typescript-eslint` — ainda não cobre TS 7). Typecheck: `tsc --noEmit`.

---

## Variáveis de ambiente

| Grupo | Exemplos |
|-------|----------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| DataJud / DJEN | token CNJ e configs do proxy |
| IA | `XAI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_*` (opcional) |
| WhatsApp | Evolution (opcional) |
| Cron | secret do worker |

Não commitar segredos. Caminho de deploy: **git push → Vercel**.

---

## Desenvolvimento

```bash
npm install
npm run dev          # :9002 (Turbopack)
npm run typecheck
npm run lint
npm run build        # next build --webpack
npm test
npm run test:e2e
```

---

## Limites honestos

- DataJud ≠ PJe/e-SAJ.  
- DJEN pode 403 / rate-limit.  
- Lote é sequencial de propósito.  
- Heurística de B.A. / encerramento **não é certidão**.  
- Screenshot automático não vence CAPTCHA.  
- Cron Hobby: no máximo 1/dia; lote manual é a operação real.  
- Cascata de IA depende de cota.

---

## Segurança

Isolamento por `empresa_id`. Cargos: Superadmin, Supervisor, Administrador, Operador, Visualizador.  
Software proprietário. Ver `MANIFESTO_DE_INTEGRIDADE.json`.

---

## Estrutura

```text
src/app/            rotas
src/app/actions/    server actions
src/app/api/        version, datajud, djen, webhooks
src/components/     layout, peças, scanner, CRM
src/lib/            domínio + release-feed
```

---

Copyright © 2026  
**Davi Alves Figueredo** / **W1 Capital Assessoria Financeira Ltda.**  
w1capitalassessoria@protonmail.com

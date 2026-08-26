<p align="center">
  <img src="docs/assets/lexis-banner.svg" alt="LexisPredict — Suite operacional de carteira jurídica" width="100%" />
</p>

<p align="center">
  <strong>Suite operacional de carteira jurídica</strong><br/>
  <em>Não é um CRM de vendas. É o sistema de operação do gabinete.</em>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-Proprietary-0B1220?style=for-the-badge&labelColor=111827" />
  <img alt="Stack" src="https://img.shields.io/badge/Next.js-App_Router-black?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img alt="Status" src="https://img.shields.io/badge/produto-operacional-22D3EE?style=for-the-badge&labelColor=0B1220" />
</p>

<p align="center">
  <a href="#-o-que-é">Produto</a> ·
  <a href="#-módulos">Módulos</a> ·
  <a href="#-quem-usa">Perfis</a> ·
  <a href="#-stack">Stack</a> ·
  <a href="#-começar">Começar</a> ·
  <a href="#-arquitetura">Arquitetura</a> ·
  <a href="#-roadmap">Roadmap</a> ·
  <a href="#-licença">Licença</a>
</p>

---

## Por que existe

Escritórios e assessorias que operam **volume** precisam ver a carteira, priorizar, atender e acompanhar tribunal **sem** viver em planilha solta nem “abrir processo a processo”.

**LexisPredict** concentra essa camada operacional.

| | **LexisPredict** | **CRM “full” típico** |
|--|------------------|------------------------|
| **Centro** | Processo · CNJ · prazo | Lead · deal · pipeline |
| **Usuário** | Operador, BKO, supervisor jurídico | Vendas e CS comercial |
| **Rotina** | Retorno, vencidos, novidades, cumprimento | Qualificar, fechar, NPS |
| **Integrações** | DataJud, DJEN, protocolo | Ads, e-mail marketing, tickets |
| **“Completo”** | Ciclo **operacional** da carteira | Ciclo **comercial** da empresa |

> **Uma linha:** organiza e acelera quem já opera processos — não substitui RH, financeiro ou comercial do escritório.

```
┌──────────────────────────────────────────────────────────────────┐
│  CARTEIRA  →  FILAS  →  ATENDIMENTO  →  TRIBUNAL  →  GESTÃO     │
│  processos     prioridade   retorno       DataJud     supervisão │
│                vencidos     ranking       DJEN        relatório  │
└──────────────────────────────────────────────────────────────────┘
```

---

## O que é

<p align="center">
  <img src="docs/assets/lexis-mark.svg" width="88" height="88" alt="LexisPredict mark" />
</p>

**LexisPredict** é a **suite operacional de carteira jurídica**:

- Carteira de processos com **escopo por cargo**
- Filas de ação (contato, parados, encerrados a revisar)
- Atendimento, ranking e auditoria de quem mexeu
- Sinais de tribunal (**DataJud + DJEN**) e motores de apoio
- Supervisão, indicadores e relatório executivo

Predição avançada de resultado e financeiro nativo completo entram como **evolução** — a comunicação atual prioriza **operações + inteligência de carteira**.

---

## Módulos

| Módulo | Função |
|--------|--------|
| **Carteira / Processos** | Base por empresa, escopo por cargo, busca e listagem |
| **Painel** | KPIs de ativos, vencidos, novidades, baixas, atendimento |
| **Tarefas / Filas** | Prioridade operacional do dia |
| **Atendimento** | Retorno, ranking, trilha de edição |
| **Scanner tribunal** | DataJud + DJEN + motores (encerrar, parados, cumprimento) |
| **Ações / Procedentes** | Falta instaurar cumprimento, oportunidade |
| **Supervisão** | Taxa de retorno, carteira por responsável |
| **Relatórios** | Export executivo (xlsx) da carteira |
| **Plano B** | Leitura via planilha/Sheets se a cota do banco apertar |
| **Documentos / Veredito / Chat** | Apoio documental e assistente |
| **Comercial (opcional)** | Assessoria / follow-ups — **não** é o centro do produto |

---

## Quem usa

| Perfil | Visão |
|--------|--------|
| **Operador** | Sua carteira e filas |
| **Administrador** | Operação do time (conforme escopo) |
| **Supervisor / Superadmin** | Empresa inteira, supervisão e controles amplos |

Regras de cargo são **parte do produto**: não é “todo mundo vê tudo” por padrão.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| App | **Next.js** (App Router) · **TypeScript** |
| Dados | **Supabase** (Postgres + Auth + RLS) |
| Deploy | **Vercel** (ou equivalente) |
| Tribunal | DataJud / DJEN (fluxos do produto) |
| Desktop | Shell Windows opcional apontando para a URL web |

> Variáveis (`SUPABASE_*`, secrets de worker, etc.) ficam na documentação interna de deploy. **Nunca** versionar segredos.

---

## Começar

```bash
git clone <repo-url>
cd LexisPredict

npm install
cp .env.example .env.local   # preencha com seus valores

npm run dev
```

### Qualidade (obrigatório em produção)

```bash
npm run typecheck
npm run build
```

| Script | Uso |
|--------|-----|
| `npm run dev` | Desenvolvimento local |
| `npm run build` | Build de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Lint (se configurado) |

Export duplicado, JSX quebrado ou typecheck vermelho **não** devem ir para deploy.

---

## Arquitetura

```
┌──────────────┐     ┌─────────────────┐     ┌────────────────────┐
│  UI          │────▶│  Server Actions │────▶│  Supabase          │
│  App Router  │     │  + motores      │     │  RLS · Admin       │
└──────────────┘     └─────────────────┘     └────────────────────┘
                              │
                              ▼
                     DataJud / DJEN / KPIs
```

**Princípios**

- Listagens e KPIs pesados → agregação no **servidor** + paginação  
- Scanner de tribunal é **real** (custa tempo) — não inventa volume  
- Plano B (`/plano-b`) lê CSV/Sheets **sem** desligar o fluxo normal do banco  

---

## Segurança e compliance

| Tema | Diretriz |
|------|----------|
| Código e marca | Licença **proprietária** — ver [`LICENSE`](./LICENSE) |
| Dados de clientes | Responsabilidade do contratante (LGPD quando aplicável) |
| Automação / IA | **Não** substitui advogado nem certidão oficial |
| Segredos | Não commitar `.env`, service role keys nem dumps de carteira |

---

## Roadmap

Prioridades para merecer o selo de **suite operacional completa**:

| # | Frente | Objetivo |
|---|--------|----------|
| 1 | **Build** | CI + typecheck, zero regressão de JSX/export |
| 2 | **Web first-class** | Mesma experiência app · desktop · navegador |
| 3 | **KPIs e escopo** | Números corretos; só supervisor/superadmin veem tudo |
| 4 | **Scanners** | DataJud + DJEN + motores, sem fila fantasma |
| 5 | **Onboarding** | Tour e estados vazios claros |
| 6 | **Mobile / PWA** | Assessoria no celular |
| 7 | **Financeiro** | Recibo, pagamento simples, histórico |
| 8 | **Nome vs IA** | Mais predição real **ou** comunicação só de operação inteligente |

---

## Licença

<p align="center">
  <img alt="Proprietary" src="https://img.shields.io/badge/LICENSE-Proprietary_All_Rights_Reserved-0B1220?style=for-the-badge&labelColor=111827" />
</p>

Software **proprietário**.  
Copyright © 2026 **Davi Alves Figueredo** / **W1 Capital Assessoria Financeira Ltda.**

Uso, cópia, modificação e distribuição **somente** com autorização.  
Texto completo: **[`LICENSE`](./LICENSE)**.

**Licenciamento e parcerias**  
[w1capitalassessoria@protonmail.com](mailto:w1capitalassessoria@protonmail.com)

---

## Contato

| | |
|--|--|
| **Organização** | W1 Capital Assessoria Financeira Ltda. |
| **Titular** | Davi Alves Figueredo |
| **E-mail** | [w1capitalassessoria@protonmail.com](mailto:w1capitalassessoria@protonmail.com) |

---

<p align="center">
  <img src="docs/assets/lexis-mark.svg" width="48" height="48" alt="LexisPredict" /><br/><br/>
  <b>LexisPredict</b><br/>
  <sub>Suite operacional de carteira jurídica · uso interno e licenciamento controlado</sub>
</p>

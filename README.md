# LexisPredict

**Suite operacional de carteira jurídica**

> Não é um CRM de vendas genérico.  
> É o sistema de operação do gabinete: processos, prazos, atendimento, sinais de tribunal e filas de ação — com inteligência de carteira por cima.

```
┌─────────────────────────────────────────────────────────────┐
│  CARTEIRA  →  FILAS  →  ATENDIMENTO  →  TRIBUNAL  →  GESTÃO │
│  processos    prioridade   retorno        DataJud     supervisão │
│               vencidos     ranking        DJEN        relatório  │
└─────────────────────────────────────────────────────────────┘
```

---

## O que é

| LexisPredict | CRM “full” típico |
|--------------|-------------------|
| Centro no **processo / CNJ / prazo** | Centro no **lead / deal** |
| Operador, BKO, supervisor jurídico | Vendas e CS comercial |
| DataJud, DJEN, cumprimento, encerrar | Pipeline, marketing, tickets |
| Trabalhar a **carteira** | Fechar **oportunidade** |

**Uma linha:** organiza e acelera quem já opera processos — não substitui o escritório inteiro (RH, financeiro, comercial).

---

## Módulos (visão de produto)

| Módulo | Função |
|--------|--------|
| **Carteira / Processos** | Base por empresa, escopo por cargo, busca e listagem |
| **Dashboard** | KPIs de ativos, vencidos, novidades, baixas, atendimento |
| **Tarefas / Filas** | Prioridade operacional do dia |
| **Atendimento** | Retorno, ranking, auditoria de quem mexeu |
| **Scanner tribunal** | DataJud + DJEN + motores (encerrar, parados, cumprimento) |
| **Ações / Procedentes** | Falta instaurar cumprimento, score de oportunidade |
| **Supervisão** | Visão da operação, taxa de retorno, carteira por responsável |
| **Relatórios** | Export executivo (xlsx) da carteira |
| **Plano B** | Leitura via planilha/Sheets se a cota do banco apertar |

> Predição avançada de resultado (risco/tempo de ganho) e financeiro fechado (cobrança nativa) entram como evolução — a comunicação atual deve priorizar **operações + inteligência de carteira**.

---

## Quem usa

| Perfil | O que vê |
|--------|----------|
| **Operador** | Sua carteira e filas |
| **Administrador** | Operação do time (conforme regras de escopo) |
| **Supervisor / Superadmin** | Empresa inteira, supervisão e controles amplos |

Regras de cargo são parte do produto: **não** é “todo mundo vê tudo” por padrão.

---

## Stack (referência)

- **App:** Next.js (App Router), TypeScript  
- **Dados:** Supabase (Postgres + auth)  
- **Deploy:** Vercel (ou equivalente)  
- **Tribunal:** integrações DataJud / DJEN (APIs públicas / fluxos do produto)  
- **Desktop (opcional):** shell Windows apontando para a URL web  

Requisitos de ambiente e variáveis (`SUPABASE_*`, secrets de worker, etc.) ficam na documentação interna de deploy — não versionar segredos.

---

## Começar (desenvolvimento)

```bash
# clonar
git clone <repo-url>
cd LexisPredict

# dependências
npm install

# env local (exemplo — use seus valores)
cp .env.example .env.local

# dev
npm run dev

# qualidade
npm run typecheck
npm run build
```

> Em produção, **typecheck no CI** e build limpo são obrigatórios. Export duplicado ou JSX quebrado não deve chegar a deploy.

---

## Scripts úteis

| Comando | Uso |
|---------|-----|
| `npm run dev` | Ambiente local |
| `npm run build` | Build de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Lint (se configurado) |

---

## Arquitetura em uma frase

```
UI (App Router)  →  Server Actions  →  Supabase (RLS + admin)  →  motores de scan / KPIs
```

- Listagens e KPIs pesados devem preferir **agregação no servidor** e paginação.  
- Scanner de tribunal é **real** (chamadas com custo de tempo), não “mil processos em 1 segundo”.  
- Plano B (`/plano-b`) lê CSV/Sheets **sem** desligar o fluxo normal do banco.

---

## Segurança e compliance (resumo)

- Código e marca: **licença proprietária** — ver `LICENSE`  
- Dados de clientes/processos: responsabilidade do contratante (LGPD quando aplicável)  
- Saídas de automação **não** substituem advogado nem certidão oficial  
- Não commitar `.env`, service role keys nem dumps de carteira

---

## Roadmap de qualidade (produto)

Prioridades honestas para merecer “suite operacional completa”:

1. **Estabilidade de build** — CI + typecheck, zero regressão de JSX/export  
2. **Web first-class** — mesma experiência app/desktop/navegador  
3. **KPIs e escopo por cargo** — números corretos; só supervisor/superadmin veem tudo  
4. **Scanners robustos** — DataJud + DJEN + motores, sem fila fantasma  
5. **Onboarding** — tour e estados vazios claros  
6. **Mobile / PWA** — assessoria no celular  
7. **Financeiro** — fechar ciclo (recibo, pagamento simples, histórico)  
8. **Nome vs IA** — ou mais predição real, ou comunicação só de operação inteligente  

---

## Licença

Software **proprietário**.  
Copyright © 2026 **Davi Alves Figueredo** / **W1 Capital Assessoria Financeira Ltda.**

Uso, cópia, modificação e distribuição só com autorização.  
Detalhes e restrições: arquivo [`LICENSE`](./LICENSE).

**Licenciamento e parcerias:**  
[w1capitalassessoria@protonmail.com](mailto:w1capitalassessoria@protonmail.com)

---

## Contato

| | |
|--|--|
| **Produto / operação** | W1 Capital Assessoria Financeira Ltda. |
| **E-mail** | w1capitalassessoria@protonmail.com |
| **Titular** | Davi Alves Figueredo |

---

<p align="center">
  <b>LexisPredict</b><br/>
  <sub>Suite operacional de carteira jurídica · uso interno e licenciamento controlado</sub>
</p>

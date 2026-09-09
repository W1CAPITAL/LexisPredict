<p align="center">
  <img src="docs/assets/lexis-promo-web.svg" alt="LexisPredict — operação de carteira jurídica" width="100%" />
</p>

<p align="center">
  <strong>LexisPredict</strong><br/>
  <span>O gabinete digital de quem vive de <strong>prazo</strong> e <strong>volume</strong>.</span><br/>
  <em>Não é CRM de vitrine. É o sistema operacional da carteira jurídica.</em>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-Proprietary-0B1220?style=for-the-badge&labelColor=111827" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Postgres" src="https://img.shields.io/badge/Postgres-multi--tenant-3FCF8E?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img alt="Status" src="https://img.shields.io/badge/web-operacional-22D3EE?style=for-the-badge&labelColor=0B1220" />
  <img alt="Graph" src="https://img.shields.io/badge/code_map-4.3k_nodes-4E79A7?style=for-the-badge&labelColor=0B1220" />
  <img alt="Offline" src="https://img.shields.io/badge/offline-EXE_v5+-5EEAD4?style=for-the-badge&labelColor=0B1220" />
</p>

<p align="center">
  <a href="#-por-que-existe">Por que existe</a> ·
  <a href="#-o-que-é">Produto</a> ·
  <a href="#-para-quem">Para quem</a> ·
  <a href="#-web-vs-offline">Web vs Offline</a> ·
  <a href="#-módulos">Módulos</a> ·
  <a href="#-mapa-do-código">Mapa do código</a> ·
  <a href="#-arquitetura">Arquitetura</a> ·
  <a href="#-começar">Começar</a> ·
  <a href="#-licença">Licença</a>
</p>

---

## Por que existe

Assessoria que opera **revisional / volume** não precisa de mais um funil bonito.

| Dor do dia a dia | O que o Lexis faz |
| ---------------- | ----------------- |
| Prazo vencido sem dono claro | Fila + status + responsável |
| “Quem atendeu esse CNJ?” | Ranking por log (`atendido_por`) sem roubar carteira |
| Silêncio no tribunal | Scanner DataJud / DJEN + BA real |
| Planilha paralela bagunçada | Export/import pelo **CRM do próprio app** |
| Queda de internet / nuvem | Offline EXE continua com a carteira local |

> **Uma linha:** organiza e acelera quem já opera processos — não substitui RH, financeiro genérico ou marketing de vitrine.

```text
  CARTEIRA  →  FILAS  →  ATENDIMENTO  →  TRIBUNAL  →  GESTÃO
  processos    vencidos   quem atendeu    DataJud     supervisão
               BA real    sem roubar      DJEN        relatório
```

---

## O que é

**LexisPredict (web)** — sistema diário da assessoria: carteira, filas, atendimento, DataJud/DJEN, peças, dossiê, CRM operacional e supervisão.

**LexisPredict Offline** — EXE Windows ([OFFLINE-LEXISPREDICT](https://github.com/W1CAPITAL/OFFLINE-LEXISPREDICT)): login local, planilha/JSON, DataJud/DJEN com internet. Paridade total com o web: *em evolução*.

No app: rota `/offline` · mapa de código `/mapa-codigo` · anúncio pós-atualização.

---

## Para quem

| Perfil | Ganha o quê |
| ------ | ----------- |
| **Operador** | Fila do dia, atendimento, WhatsApp, carteira sem ruído |
| **Supervisor** | Empresa inteira, “Rodar empresa”, ranking, auditoria |
| **Sócio / BKO** | Volume, vencidos, silêncio, relatório executivo |
| **Quem vive de planilha** | Excel/Sheets pelo **CRM do Lexis**, não como banco principal |

Não é HubSpot. Não é PJe. É **gabinete + operação**.

---

## Web vs Offline

| | **Web (este repo)** | **Offline EXE** |
|--|--|--|
| Onde roda | Vercel + browser | Windows (`Lexis Gabinete.exe`) |
| Login | Supabase Auth | Login/senha locais |
| Dados primários | Postgres multi-tenant (`empresa_id`) | Planilha / JSON local |
| DataJud + DJEN | Sim | Sim (com internet) |
| CRM / ranking / supervisão | Completo | Em paridade gradual |
| Queda da nuvem | Depende do host | EXE continua |

---

## Módulos

| Módulo | Função |
| ------ | ------ |
| **Painel** | KPIs: ativos, vencidos, atendidos, novidades |
| **Meus processos / Cases** | Carteira por `created_by` |
| **Processos da empresa** | Visão completa · **“Rodar empresa”** só supervisão |
| **Filas / Tarefas** | Prioridade do dia |
| **Parados / Encerrados a revisar** | Silêncio tribunal ≠ prazo vencido |
| **Scanner tribunal** | DataJud + DJEN |
| **WhatsApp / Peças / Dossiê** | Atendimento e documentação |
| **CRM Assessoria** | Clientes, funil — **export/import planilha** |
| **Team / Supervisão** | Ranking, cargos, auditoria |
| **Mapa do código** | Grafo graphify · acoplamento real |
| **Offline** | `/offline` + EXE irmão |

---

## Mapa do código

O repositório inclui visão **graphify** do código (rede de símbolos):

| Métrica | Valor |
| ------- | ----- |
| Nós | **4.378** |
| Arestas | **13.547** |
| Comunidades | **225** |

Pastas mais densas (útil antes de lotes grandes):

| Pasta | ~símbolos | Papel |
| ----- | --------- | ----- |
| `src/lib` | 2.1k | Núcleo de domínio |
| `src/app` | 900+ | Rotas |
| `src/components` | 850+ | UI |
| `src/app/actions` | 490+ | Server actions |
| `src/lib/ai` | 150+ | IA / motores |

No app: **`/mapa-codigo`** (iframe de `public/mapa/graph.html`).

Paleta operacional (dark ops):

`#0f0f1a` fundo · `#1a1a2e` painel · `#4E79A7` acento · comunidades `#F28E2B` `#E15759` `#76B7B2` `#59A14F`

---

## Planilha & CRM — sem depender de Apps Script

**Postgres = fonte da verdade.** Planilha = espelho / arquivo de trabalho.

```text
  Lexis (web) → Postgres → Export XLSX/CSV → Excel/Sheets
                      ↘ Import pelo CRM ← edição humana
```

Apps Script só como **Plano B** opcional (legado offline). Nunca no caminho feliz do atendimento.

---

## Arquitetura

```text
  UI (Next.js 15) · tema graphify dark ops
       ↓
  Server Actions
       ↓
  Postgres (Supabase) · empresa_id · created_by · atendido_por
       ↓
  DataJud / DJEN / KPIs
       ↓
  CRM export/import
       ↘ [opcional] Apps Script ↔ Sheets
```

**Regras de ouro**

- **Dono** = `created_by`
- **Crédito de atendimento** = `atendido_por` / log
- **Atender não troca o dono**
- Ranking da semana = log (`pessoa + CNJ` único)

---

## Notas honestas

| Assunto | Verdade |
| ------- | ------- |
| DataJud | Não é PJe / e-SAJ · consulta pública indexada |
| DJEN | Pode 403 / HTML / rate limit · preferir client-side |
| Heurística de encerramento | Apoio operacional · **não** é certidão |
| IA | Depende de cota / motor configurado |
| Apps Script | Opcional · não escala como SQL |

---

## Começar

```bash
git clone https://github.com/W1CAPITAL/LexisPredict.git
cd LexisPredict
npm install
cp .env.example .env.local   # Supabase / chaves
npm run dev
```

```bash
npm run typecheck
npm run build
```

**Visual graphify:** copie o `graph.html` para `public/mapa/graph.html` e abra `/mapa-codigo`.

**Produção:** Vercel · variáveis Supabase + DataJud.

**Offline:** [OFFLINE-LEXISPREDICT](https://github.com/W1CAPITAL/OFFLINE-LEXISPREDICT).

---

## Roadmap

1. Contagens idênticas em painel, `/processos` e relatório  
2. Offline: paridade de atendimento + export/import estável  
3. Sync web ↔ EXE sem duplicar CNJ  
4. Apps Script apenas adaptador opcional — nunca núcleo  
5. Tema dark ops (graphify) em painel, filas e cases  

---

## Diferencial comercial

| | CRM genérico | **LexisPredict** |
|--|--|--|
| Centro | Lead / deal | **Processo · CNJ · prazo** |
| Usuário | Vendas | **Operador, BKO, supervisor jurídico** |
| Rotina | Funil | **Retorno, vencidos, tribunal, ranking** |
| Planilha | Integração genérica | **Export/CRM nativo** |
| Offline | Raro | **EXE Windows real** |
| Código | Caixa-preta | **Mapa graphify 4k nós** |

---

## Licença

Copyright © 2026 **Davi Alves Figueredo** / **W1 Capital Assessoria Financeira Ltda.**

Software **proprietário**. Proibida cópia, redistribuição ou exploração comercial sem autorização escrita.

**Contato comercial / demo:** [w1capitalassessoria@protonmail.com](mailto:w1capitalassessoria@protonmail.com)

---

<p align="center">
  <sub>LexisPredict · W1 Capital · Gabinete digital para quem opera de verdade</sub>
</p>

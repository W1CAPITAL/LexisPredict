<p align="center">
  <img src="docs/assets/lexis-graph-hero.svg" alt="LexisPredict" width="100%" />
</p>

<p align="center">
  <strong>LexisPredict</strong><br/>
  O gabinete digital de quem vive de <strong>prazo</strong> e <strong>volume</strong>.<br/>
  <em>Não é CRM de vitrine. É o sistema operacional da carteira jurídica.</em>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-Proprietary-0B1220?style=for-the-badge&labelColor=111827" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Postgres" src="https://img.shields.io/badge/Postgres-multi--tenant-3FCF8E?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img alt="Status" src="https://img.shields.io/badge/web-operacional-22D3EE?style=for-the-badge&labelColor=0B1220" />
  <img alt="Graphify" src="https://img.shields.io/badge/graphify-4.3k_nós_·_13.5k_arestas-4E79A7?style=for-the-badge&labelColor=0B1220" />
  <img alt="Offline" src="https://img.shields.io/badge/offline-EXE_v5+-5EEAD4?style=for-the-badge&labelColor=0B1220" />
</p>

<p align="center">
  <a href="#-por-que-existe">Por que existe</a> ·
  <a href="#-o-que-é">Produto</a> ·
  <a href="#-para-quem">Para quem</a> ·
  <a href="#-web-vs-offline">Web vs Offline</a> ·
  <a href="#-módulos">Módulos</a> ·
  <a href="#-mapa-graphify-do-código">Mapa graphify</a> ·
  <a href="#-planilha--crm">Planilha & CRM</a> ·
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

<p align="center">
  <img src="docs/assets/lexis-pipeline.svg" alt="Pipeline operacional Lexis" width="100%" />
</p>

```text
  CARTEIRA → FILAS → ATENDIMENTO → TRIBUNAL → GESTÃO
  processos  vencidos  quem atendeu  DataJud   supervisão
             BA real   sem roubar    DJEN      relatório
```

---

## O que é

**LexisPredict (web)** — sistema diário da assessoria: carteira, filas, atendimento, DataJud/DJEN, peças, dossiê, CRM operacional e supervisão.

**LexisPredict Offline** — EXE Windows ([OFFLINE-LEXISPREDICT](https://github.com/W1CAPITAL/OFFLINE-LEXISPREDICT)): login local, planilha/JSON, DataJud/DJEN com internet. Paridade com o web: *em evolução*.

No app: rota `/offline` + anúncio na abertura / pós-atualização.

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
| **Offline** | `/offline` + EXE irmão |

---

## Mapa graphify do código

O código do Lexis foi mapeado com **graphify** (rede de símbolos e dependências).  
Isso **não roda dentro do produto** — vive na documentação, para quem desenvolve e decide onde mexer.

<p align="center">
  <img src="docs/assets/lexis-code-density.svg" alt="Densidade do código Lexis" width="100%" />
</p>

| Métrica | Valor |
| ------- | ----- |
| **Nós** | 4.378 |
| **Arestas** | 13.547 |
| **Comunidades** | 225 |

### Onde está o peso real

| Pasta | ~símbolos | Papel |
| ----- | --------- | ----- |
| `src/lib` | **2.142** | Núcleo de domínio |
| `src/app` | **912** | Rotas Next |
| `src/components` | **866** | UI |
| `src/app/actions` | **495** | Server actions |
| `src/components/ui` | **372** | Design system |
| `src/lib/ai` | **159** | IA / motores |
| `src/lib/data-provider` | **58** | Provider / sync |
| `src/lib/hybrid` | **34** | Hybrid / Sheets (Plano B) |

### Paleta das comunidades (mesmo visual do grafo)

| Cor | Hex | Uso sugerido na leitura do mapa |
| --- | --- | -------------------------------- |
| 🔵 | `#4E79A7` | Núcleo / lib dominante |
| 🟠 | `#F28E2B` | App / rotas |
| 🔴 | `#E15759` | Componentes |
| 🩵 | `#76B7B2` | Actions |
| 🟢 | `#59A14F` | UI kit |
| 🟡 | `#EDC948` | IA |
| 🟣 | `#B07AA1` | Data provider |
| 🌸 | `#FF9DA7` | Hybrid |

### Grafo interativo (fora do app)

O HTML completo do graphify fica em:

```text
docs/assets/graph.html
```

Abra no navegador (arquivo local ou GitHub Pages / raw estático).  
Busca de nós, legenda de comunidades, inspeção de grau e arquivo de origem — **só documentação**, zero impacto no runtime do Lexis.

```bash
# opcional: servir local
npx --yes serve docs/assets -p 5180
# abrir http://localhost:5180/graph.html
```

> **Por que existe o mapa:** lotes grandes em `src/lib` e `src/app/actions` mexem no coração do produto. O grafo mostra acoplamento antes de “melhorar tudo de uma vez”.

---

## Planilha & CRM

A estratégia do Lexis é **não transformar Google Apps Script no centro do produto**.

### Caminho principal (recomendado)

```text
Operação no Lexis (web)
        │
        ▼
Postgres (fonte da verdade)
        │
        ├── Export XLSX / CSV → Excel ou Google Sheets
        └── Import de volta pelo CRM / Import → carteira atualizada
```

- Planilha = espelho e arquivo de trabalho (BKO / sócio)
- Zero webhook Google na rotina diária de atendimento

### Caminho opcional (Plano B)

```text
Lexis ↔ Apps Script (opcional) ↔ Google Sheets
```

Só se a equipe **explicitamente** precisar de 2 vias automáticas. Documentado no repo offline. **Não é requisito** do web com Postgres.

| Objetivo | Preferir |
| -------- | -------- |
| Vender / operar assessoria | Web + Postgres + CRM |
| Trabalhar offline no notebook | EXE + planilha local |
| Espelhar números no Excel | **Export/Import pelo app** |
| Sync automático Sheet ↔ app | Apps Script (opcional) |

---

## Arquitetura

```text
UI (Next.js 15)
  → Server Actions
  → Postgres (Supabase) · empresa_id · created_by · atendido_por
  → DataJud / DJEN / KPIs
  → CRM export/import (planilha humana)
  → [opcional] Apps Script ↔ Sheets
```

**Regras de ouro da carteira**

- **Dono** = `created_by` (carteira do operador)
- **Crédito de atendimento** = `atendido_por` / log (ranking)
- **Atender não troca o dono**
- Ranking da semana = log (`pessoa + CNJ` único)

---

## Notas honestas (produto sério)

| Assunto | Verdade |
| ------- | ------- |
| DataJud | Não é PJe / e-SAJ · consulta pública indexada |
| DJEN | Pode 403 / HTML / rate limit · lote sequencial |
| Heurística de encerramento | Apoio operacional · **não** é certidão |
| IA | Depende de cota / motor configurado |
| Apps Script | Opcional · cotas Google · não escala como SQL |
| Graphify | Mapa de código · **não** feature de usuário final |

Software jurídico não pode fingir que atalho é certidão.

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

**Produção:** deploy Vercel · variáveis Supabase + DataJud.

**Offline:** [OFFLINE-LEXISPREDICT](https://github.com/W1CAPITAL/OFFLINE-LEXISPREDICT).

**Mapa do código:** abra `docs/assets/graph.html` no browser.

---

## Roadmap

1. Contagens idênticas em painel, `/processos` e relatório  
2. Offline: paridade de atendimento + export/import estável  
3. Sync web ↔ EXE sem duplicar CNJ  
4. Apps Script apenas como adaptador opcional — nunca como núcleo  

---

## Diferencial comercial

| | CRM genérico | **LexisPredict** |
|--|--|--|
| Centro | Lead / deal | **Processo · CNJ · prazo** |
| Usuário | Vendas | **Operador, BKO, supervisor jurídico** |
| Rotina | Funil | **Retorno, vencidos, tribunal, ranking** |
| Planilha | “Integração” genérica | **Export/CRM nativo · Sheet só se quiser** |
| Offline | Raro | **EXE Windows real** |
| Transparência técnica | Caixa-preta | **Graphify 4k nós na documentação** |

---

## Licença

Copyright © 2026 **Davi Alves Figueredo** / **W1 Capital Assessoria Financeira Ltda.**

Software **proprietário**. Proibida cópia, redistribuição ou exploração comercial sem autorização escrita.

**Contato comercial / demo:** [w1capitalassessoria@protonmail.com](mailto:w1capitalassessoria@protonmail.com)

---

<p align="center">
  <sub>LexisPredict · W1 Capital · Gabinete digital para quem opera de verdade</sub><br/>
  <sub>Código mapeado · operação primeiro · planilha como espelho</sub>
</p>

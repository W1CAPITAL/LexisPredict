<p align="center">
  <img src="docs/assets/lexis-promo-web.svg" alt="LexisPredict — operação de carteira jurídica" width="100%" />
</p>

<p align="center">
  <strong>LexisPredict</strong> — suite operacional de carteira jurídica<br/>
  <em>Não é CRM de vitrine. É o gabinete digital de quem vive de prazo e volume.</em>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-Proprietary-0B1220?style=for-the-badge&labelColor=111827" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img alt="Status" src="https://img.shields.io/badge/web-operacional-22D3EE?style=for-the-badge&labelColor=0B1220" />
  <img alt="Offline" src="https://img.shields.io/badge/offline-coming_soon-5EEAD4?style=for-the-badge&labelColor=0B1220" />
</p>

<p align="center">
  <a href="#-o-que-é">Produto</a> ·
  <a href="#-web-vs-offline">Web vs Offline</a> ·
  <a href="#-módulos">Módulos</a> ·
  <a href="#-notas">Notas</a> ·
  <a href="#-começar">Começar</a> ·
  <a href="#-licença">Licença</a>
</p>

---

## O que é

**LexisPredict (web)** é o sistema que a assessoria usa todo dia: carteira, filas, atendimento, DataJud/DJEN, peças, dossiê e CRM operacional.

**LexisPredict Offline** é o EXE Windows ([W1CAPITAL/OFFLINE-LEXISPREDICT](https://github.com/W1CAPITAL/OFFLINE-LEXISPREDICT)) — **já abre** com login, senha e planilha. A **paridade com este web** é *coming soon*.

No app: rota `/offline` + anúncio fechável na abertura / após atualizar.

```
CARTEIRA → FILAS → ATENDIMENTO → TRIBUNAL → GESTÃO
processos   vencidos   quem atendeu   DataJud    supervisão
            BA real    sem roubar     DJEN       relatório
```

---

## Web vs Offline

| | **Web (este repo)** | **Offline EXE v5.1.8** |
|--|--|--|
| Onde roda | Vercel + browser | Windows (`Lexis Gabinete.exe`) |
| Login | Supabase | Login e senha locais — **já funciona** |
| Dados | Postgres multi-tenant | Planilha / JSON local — **já funciona** |
| DataJud + DJEN | Sim | Sim (precisa internet) |
| Fila + KPIs | Empresa / meus | Carteira local |
| Ranking pelo log | Sim | Coming soon |
| Encerrados a revisar | Sim | Coming soon |
| CRM + agentes | Sim | Coming soon |
| Queda da nuvem | App some | EXE continua |

README do EXE (mesmo visual): copie `README-OFFLINE.md` para o repo Offline.

---

## Módulos

- Painel, Meus processos, Processos da empresa, Fila de contato  
- Encerrados a revisar  
- Scanner DataJud / DJEN  
- Tarefas, WhatsApp, peças, dossiê / report  
- CRM Assessoria + agentes  
- Offline (soon) — `/offline`

---

## Começar

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Produção: painel web da W1. Offline: junte as partes do EXE no repo Offline e abra `Lexis Gabinete.exe`.

---

## Arquitetura

`src/app` rotas · `src/app/actions` server actions · `src/lib` DataJud/DJEN/risco · Supabase `empresa_id` + `created_by` (dono) + `atendido_por` (crédito).

Atender **não** troca o dono. Ranking da semana = log (`pessoa + CNJ` único).

---

## Roadmap

1. Contagem idêntica em painel, /processos e relatório  
2. Offline: paridade de atendimento + planilha 2 vias estável  
3. Sync web ↔ EXE sem duplicar CNJ  

---

## Licença

Copyright © 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.  
Proprietário. Proibido copiar ou explorar comercialmente sem autorização.

**Contato:** w1capitalassessoria@protonmail.com

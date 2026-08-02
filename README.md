# LexisPredict

### Plataforma de operações jurídicas e inteligência de carteira

> SaaS multi-tenant para gestão processual, prazos, atendimento, auditoria CNJ (**DataJud**), diário oficial (**DJEN**), documentos e equipe — feito para **rotina de gabinete com volume**.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/DataJud-CNJ-orange?style=for-the-badge" alt="DataJud" />
  <img src="https://img.shields.io/badge/DJEN-Diário-blue?style=for-the-badge" alt="DJEN" />
  <img src="https://img.shields.io/badge/AI-Support-purple?style=for-the-badge" alt="AI" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License" />
</p>

**Produção:** [private-assecom.vercel.app](https://private-assecom.vercel.app/)  
**Titular:** Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.  
**Contato:** w1capitalassessoria@protonmail.com  
**Licença:** Proprietária — ver `LICENSE`

---

## Visão geral

O **LexisPredict** organiza a operação de assessorias e bancas que convivem com milhares de processos, planilhas legadas, prazos, atendimento e evidências de tribunal/diário.

Fluxo contínuo:

```text
Importação CSV
    → Carteira (status, prazo, retorno)
    → Scanner DataJud ∪ DJEN (híbrido / lote / pontual)
    → Flags de novidade, baixa, B.A., cumprimento
    → Fila de tarefas (prioridade unificada)
    → Centro de Alertas de Mérito
    → Scripts / rascunho IA (opcional, com validação humana)
    → Documentos PDF
    → Dossiê / relatório executivo
```

> Nascido de uso real em operação — não de protótipo de vitrine.

---

## Módulos principais

| Módulo | Função |
|--------|--------|
| **Dashboard** | Telemetria unificada, risco, preview da fila |
| **Tarefas** | Fila crítica: B.A. → baixa → mérito → andamento/DJEN → prazo |
| **Processos** | Carteira, sinal de capa, Audit 3D, atendimento |
| **Alertas** | Só mérito (sentença, audiência, B.A., execução…) — sem prazo genérico |
| **Scanner** | DataJud e/ou DJEN; logs locais; nuvem sob demanda |
| **Documentos** | Procuração, habilitação, substabelecimentos |
| **Import CSV** | Volume, normalização, dedupe por CNJ |
| **Equipe** | Cargos, escopo multi-tenant, KPI |
| **Dossiê** | Top 10 críticos, encerramento, responsabilidade, ranking |
| **IA** | Scripts determinísticos + rascunho opcional (não substitui o advogado) |

### Prioridade da fila (resumo)

1. Indício de busca e apreensão  
2. Baixa / trânsito no tribunal  
3. Eventos de mérito (sentença, liminar, audiência…)  
4. Novo andamento / publicação DJEN pós-retorno  
5. Score de prazo e tempo sem retorno  

### Limites honestos

- **DataJud ≠ PJe/e-SAJ** — pode atrasar ou divergir; use para triagem.  
- **DJEN** pode falhar por rede/geo (403) ou rate limit.  
- Lotes grandes são **sequenciais de propósito** (estabilidade).  
- Heurísticas de B.A. / encerramento **não são garantia jurídica**.  
- Cron na Vercel **Hobby**: no máximo 1 execução/dia; lote manual/nuvem sob demanda é a operação real.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Front | Next.js 15, React, TypeScript, Tailwind, shadcn/ui, Zustand |
| Back | Server Actions, Supabase Auth + PostgreSQL (multi-tenant) |
| Deploy | Vercel |
| Docs | PDF / OCR de apoio |

Fonte de verdade da carteira: **Supabase**. UI (filtros, progresso de scan) pode usar estado local.

---

## Onboarding

1. **Guia do Sistema** (sidebar) — tour pelas abas com o produto atual.  
2. **/onboarding** — vídeo de apoio.  
3. Preferir o guia interativo: o vídeo pode ficar desatualizado em detalhes de UI.

---

## Segurança

- Isolamento por `empresa_id`  
- Auth Supabase e controle por cargo  
- Software **proprietário** — repositório público ≠ open source  

---

## Licença e contato

Copyright © 2026  
Davi Alves Figueredo  
W1 Capital Assessoria Financeira Ltda.

Todos os direitos reservados. Proibido copiar, modificar, distribuir ou explorar comercialmente sem autorização escrita.

**Comercial:** w1capitalassessoria@protonmail.com  

LexisPredict — gabinete digital para quem vive de prazo, processo e operação.

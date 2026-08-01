# LexisPredict

### Plataforma de operações jurídicas e inteligência de carteira

> SaaS multi-tenant para gestão processual, prazos, atendimento, auditoria CNJ (**DataJud**), diário oficial (**DJEN**), documentos e equipe — feito para **rotina de gabinete com volume**, não para planilha improvisada.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/DataJud-CNJ-orange?style=for-the-badge" alt="DataJud" />
  <img src="https://img.shields.io/badge/DJEN-Diário-blue?style=for-the-badge" alt="DJEN" />
  <img src="https://img.shields.io/badge/AI-Integrated-purple?style=for-the-badge" alt="AI" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License" />
</p>

**Produção:** [private-assecom.vercel.app](https://private-assecom.vercel.app/)  
**Titular:** Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.  
**Contato comercial:** w1capitalassessoria@protonmail.com  
**Licença:** Proprietária — ver `LICENSE`

---

## Visão geral

O **LexisPredict** centraliza a operação de assessorias e bancas que convivem com:

- centenas ou milhares de processos;
- prazos e retornos de atendimento;
- planilhas legadas;
- andamentos no tribunal e publicações em diário;
- peças repetitivas;
- equipe multi-operador sob supervisão.

Ciclo contínuo:

**carteira → prazos → fila de contato → evidências → DataJud / DJEN → peças → relatório**

> Nascido de uso real em operação — não de protótipo de vitrine.

---

## Para quem é

- Assessorias financeiras e de **revisão bancária / crédito**
- Escritórios com **operação de volume e prazo**
- Equipes com **operadores + supervisão**
- Gestores que precisam de **KPI de pessoas**, não só de “processos no sistema”

**Não substitui** o PJe/e-SAJ nem a conferência fina no tribunal. Complementa com triagem, fila e controle de carteira.

---

## Fluxo operacional

```text
Importação CSV / cadastro
        │
        ▼
  Carteira de processos ──► Status, risco, prazo, retorno
        │
        ├──────────────────► Dashboard + Dossiê + Relatório
        │
        ├──────────────────► Fila de tarefas / meta diária
        │                         (BA → baixa tribunal → DJEN → andamento → prazo)
        │
        ├──────────────────► Scanner DataJud (e opcional DJEN)
        │                         │
        │                         ▼
        │              Andamentos, baixas, BA, publicações
        │
        ├──────────────────► Centro de Alertas / Notificações
        │
        ├──────────────────► Notas, WhatsApp, evidências
        │
        └──────────────────► Documentos (PDF) + IA de apoio

Módulos
Processos

Cadastro, busca e filtros (escritório, auditoria, texto)
Status automático e manual (Vencido, É Hoje, Atenção, No Prazo, Sem Prazo, Caso Crítico)
Último retorno, próximo prazo, observações
Flags: novo andamento pós-retorno, encerrado no tribunal, indício de busca e apreensão, publicação DJEN
Importação / exportação CSV
Consulta pontual DataJud + sincronização DJEN no detalhe
Sugestões de resposta e rascunho com IA

Dashboard e dossiê

KPIs de ativos, vencidos, hoje, execução
Telemetria forense: andamentos tribunal, publicações DJEN, baixas detectadas
Distribuição operacional e índice de risco
Fila prioritária (preview) e visão por escritório
Prognóstico de chance de encerramento (heurística)
Dossiê operacional consolidado (impressão)

Tarefas e atendimento

Fila crítica com prioridade unificada (BA → baixa tribunal → DJEN → andamento → score de prazo → tempo sem retorno)
Meta diária e contatados do dia
Resumo DJEN no card (texto limpo, sem HTML)
Registro de atendimento com próximo retorno e aplicação à carteira do cliente

DataJud (CNJ)

API pública DataJud por CNJ
Scanner em fila (1 a 1), progresso, pause / resume / cancel / retomar
Detecção de novo andamento após retorno, baixa/encerramento, indícios de BA
Telemetria e badges na carteira

DataJud ≠ PJe. A base pública pode atrasar ou divergir. Uso para triagem; casos críticos exigem conferência no tribunal.
DJEN (Diário de Justiça Eletrônico Nacional)

Consulta de comunicações oficiais por processo
Texto sanitizado (plainTextFromDjen) — sem HTML cru na UI
Resumos operacionais no Centro de Alertas e na fila de tarefas
Sincronização sob demanda no detalhe (e fluxos de scanner modular, quando habilitados)
Pode exigir região de função São Paulo (gru1) na Vercel por restrição de rede/CloudFront

Centro de Alertas

Vigilância unificada (prazos, DataJud, DJEN)
Cards com resumo legível e ações (gerir caso / ignorar)

Documentos

TipoSituaçãoProcuraçãoPDF/texto → extração → revisão → PDFHabilitaçãoAba dedicadaSubstabelecimentoCom/sem reserva; variantes CPCPeça de substabelecimentoComunicação ao juízoRevogaçãoAba dedicada
Banca de advogados (OAB por UF), extração assistida, OCR de apoio.
Inteligência artificial

Chat operacional, briefing de notas, extração documental
Rascunhos e scripts processuais com contexto de andamentos
Multi-provedor configurável

A IA é apoio. Não substitui leitura dos autos nem responsabilidade profissional.
Equipe e KPI

Multi-usuário por empresa_id
Cargos: Superadmin, Supervisor, Administrador, Operador, Visualizador
Escopo de carteira conforme perfil
Desempenho de operadores / advogados para supervisão

Comunicação e evidências

WhatsApp (Evolution API quando configurado)
Notas e evidências no dossiê
Onboarding (Guia do Sistema)

Importação

CSV em volume, normalização, dedupe por protocolo
Inferência de tribunal (CNJ) e classificação inicial de status

Camada de UI responsiva

Motor isolado (responsive-ui / classes ui.*) para celular, notebook e desktop
Sem alterar regras de negócio (prazos, scanners, auth)


Arquitetura e stack

CamadaTecnologiaFrontNext.js 15, React 19, TypeScript, Tailwind, shadcn/ui, ZustandBackServer Actions, Supabase Auth + PostgreSQLIAGenkit / multi-providerDocs@react-pdf/renderer, pdf-parse, TesseractDeployVercel
Fonte de verdade da carteira: Supabase. UI (filtros, meta diária, progresso de scan) pode usar armazenamento local.

Segurança e multi-tenant

Isolamento por empresa_id
Auth Supabase e controles por cargo
Actions sensíveis exigem sessão
Software proprietário — GitHub público ≠ open source


Status por área

ÁreaStatusProduçãoAtivoMulti-tenant / processos / prazosEstávelDashboard / dossiêEstável (métricas em evolução)Import CSVEstávelDataJud scannerAtivoDJEN + Centro de AlertasAtivoFila de tarefasAtivoDocumentosAtivo (modelos em expansão)IAAtivaWhatsAppConforme integraçãoUI responsivaAtiva (camada aditiva)

Limitações honestas

DataJud ≠ PJe; DJEN pode falhar por rede/geo (403) ou rate limit
Lotes grandes são sequenciais de propósito (estabilidade > velocidade)
Heurísticas de encerramento / BA / probabilidade não são garantia jurídica
Não é ERP jurídico completo nem protocolo nativo em tribunal
Foco: volume + prazo + triagem + equipe


Diferenciais

Feito para turno de operador, não só cadastro
Multi-tenant real e KPI de pessoas
Import pensado para legado em planilha
DataJud + DJEN + fila unificada no mesmo fluxo
Documentos e IA ligados à carteira
Dossiê executivo imprimível
Evolução sob controle do titular


Licença e contato
Copyright © 2026
Davi Alves Figueredo
W1 Capital Assessoria Financeira Ltda.
Todos os direitos reservados. Proibido copiar, modificar, distribuir ou explorar comercialmente sem autorização escrita. A publicação no GitHub não concede licença open source.
Comercial / parcerias: w1capitalassessoria@protonmail.com
LexisPredict — gabinete digital para quem vive de prazo, processo e operação.

LexisPredict Elite
Plataforma de operações jurídicas e inteligência de carteira
SaaS multi-tenant para gestão processual, prazos, atendimento, auditoria CNJ (DataJud), documentos e equipe — feito para rotina de gabinete com volume, não para planilha improvisada.

  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&#x26;logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&#x26;logo=typescript&#x26;logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&#x26;logo=supabase&#x26;logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Multi--Tenant-SaaS-blue?style=for-the-badge" alt="Multi-Tenant">
  <img src="https://img.shields.io/badge/DataJud-CNJ-orange?style=for-the-badge" alt="DataJud">
  <img src="https://img.shields.io/badge/AI-Integrated-purple?style=for-the-badge" alt="AI">
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License">

Produção: private-assecom.vercel.app
Titular: Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
Licença: Proprietária — ver LICENSE

Sumário

Visão geral
Para quem é
Fluxo operacional
Módulos
DataJud (CNJ)
Arquitetura e stack
Segurança e multi-tenant
Status por área
Limitações honestas
Diferenciais
Licença e contato


Visão geral
O LexisPredict Elite centraliza a operação de assessorias e bancas que convivem com:

centenas ou milhares de processos;
prazos e retornos de atendimento;
planilhas legadas;
andamentos no tribunal;
peças repetitivas;
equipe multi-operador sob supervisão.

No lugar de espalhar a verdade entre Excel, WhatsApp e PDFs, o sistema organiza um ciclo contínuo:
carteira → prazos → fila de contato → evidências → auditoria DataJud → peças → relatório
Nascido de uso real em operação — não de protótipo de vitrine.

Para quem é

Assessorias financeiras e de revisão bancária / crédito
Escritórios e bancas com operação de volume e prazo
Equipes com operadores + supervisão
Gestores que precisam de KPI de pessoas, não só de “processos no sistema”

Não substitui o PJe/e-SAJ nem a conferência fina no tribunal. Complementa a operação com triagem, fila e controle de carteira.

Fluxo operacional
textImportação CSV / cadastro
        │
        ▼
  Carteira de processos ──► Status, risco, prazo, retorno
        │
        ├──────────────────► Dashboard + Dossiê + Relatório
        │
        ├──────────────────► Fila de tarefas / meta diária
        │
        ├──────────────────► Scanner DataJud (nuvem)
        │                         │
        │                         ▼
        │                   Andamentos, baixas, alertas BA
        │
        ├──────────────────► Notas, WhatsApp, evidências
        │
        └──────────────────► Documentos (PDF) + IA de apoio

Módulos
Processos

Cadastro, busca e filtros (tribunal, advogado, status, texto)
Status automático e manual (Vencido, É Hoje, Atenção, No Prazo, Sem Prazo, Caso Crítico)
Último retorno e próximo prazo
Observações e dados de carteira
Campos DataJud: último movimento, data da consulta, novo andamento após retorno, encerrado no tribunal, indícios de busca e apreensão
Importação e exportação CSV
Consulta pontual de andamentos (clique na linha) e varredura em lote (scanner)

Dashboard e dossiê

KPIs de ativos, vencidos, vencem hoje, andamentos e baixas no tribunal
Telemetria forense DataJud alinhada à carteira
Distribuição operacional (incluindo Sem Prazo)
Fila prioritária de contato (preview)
Índice de risco e visão por escritório / unidade
Prognóstico de chance de encerramento (Alta / Muito Alta), com cliente e CNJ
Briefing neural (insights a partir de notas/evidências)
Dossiê operacional consolidado (telemetria, notes, rankings, impressão)

Tarefas e atendimento

Fila crítica orientada a urgência de prazo
Priorização com sinais DataJud e tempo sem retorno
Meta diária de atendimento
Registro de retorno sincronizado com a carteira

DataJud (CNJ)

Consulta à API pública DataJud por número CNJ
Scanner em nuvem (produção): fila sequencial 1 a 1, progresso persistido, pause / resume / cancel
Escopos de varredura: FULL, crítico, RESUME (inteligente)
Retries com backoff em timeout / rede
Detecção de:
novo andamento após o último retorno do operador
encerramento / baixa no tribunal (ex.: trânsito em julgado, baixa definitiva)
indícios de busca e apreensão

Telemetria no dashboard e badges na carteira
Cron opcional para lotes programados (sujeito a limites do plano Vercel)

Importante: a base pública do CNJ pode estar incompleta ou atrasada em relação ao sistema do tribunal (PJe/e-SAJ). O LexisPredict usa o DataJud para triagem rápida. Conferência no tribunal continua recomendada nos casos críticos.
“Tempo esgotado” no scanner não significa ausência de movimento — a consulta pontual na linha do processo usa o mesmo núcleo com margem de tempo maior.
Documentos
Hub de geração de peças com exportação PDF:

TipoSituaçãoProcuraçãoFluxo completo: PDF/texto → extração → revisão → selagem PDFHabilitaçãoAba dedicada (habilitação nos autos / advogado)SubstabelecimentoAba dedicada (com/sem reserva de poderes); modelo simples + variante com cláusula art. 272, §5º CPC (exclusão de contracapa / intimações)Peça de substabelecimentoPetição de comunicação ao juízoRevogação de procuraçãoAba dedicada

Banca de advogados (OAB por UF) configurável
Extração assistida por IA no fluxo de procuração
OCR / leitura de PDF de apoio

Inteligência artificial

Chat operacional
Análise de notas / evidências (briefing)
Extração de dados em documentos
Veredito / auditoria 3D com contexto de carteira e DataJud
Arquitetura multi-provedor configurável por ambiente

A IA é apoio operacional. Não substitui leitura dos autos nem responsabilidade do advogado.
Equipe e KPI

Multi-usuário por empresa_id
Cargos e hierarquia (ex.: Superadmin, Supervisor, Administrador, Operador, Visualizador)
Visão de carteira conforme perfil: Supervisor e Superadmin enxergam a empresa; demais perfis, escopo próprio (created_by), conforme regra vigente
Subárea de desempenho: operadores e advogados, comparativos para supervisão

Comunicação e evidências

Terminal WhatsApp (rotina de despacho / Evolution API quando configurado)
Notas internas e evidências (com reflexo no dossiê)
Onboarding guiado (Guia do Sistema) pelas principais abas
Exportações gerenciais

Importação inteligente

CSV em volume
Normalização de datas e textos
Deduplicação por protocolo
Inferência de tribunal (CNJ)
Classificação inicial de status / risco


Arquitetura e stack
textClientes (navegador)
        │
        ▼
Next.js 15 (App Router) + React 19
        │
┌───────┼───────────────┐
▼       ▼               ▼
Server  API Routes /    Fluxos
Actions Cron            de IA
│       │               │
▼       ▼               ▼
Supabase Auth    Jobs DataJud    Provedores de IA
PostgreSQL + RLS (fila + retries)
│
└──── Multi-tenant (empresa_id) ────┘

Laterais: DataJud CNJ · WhatsApp/Evolution · React-PDF · CSV · OCR

CamadaTecnologiaFrontNext.js 15, React 19, TypeScript, Tailwind, shadcn/ui, ZustandBackServer Actions, Supabase Auth + PostgreSQLIAGenkit / multi-providerDocs@react-pdf/renderer, pdf-parse, Tesseract (OCR)DeployVercel (produção), Git → CI
Estado de UI (tema, locale, filtros) pode persistir no cliente; fonte de verdade da carteira é o Supabase.

Segurança e multi-tenant

Isolamento por empresa_id
Autenticação Supabase
Controles por cargo / peso de papel
Row Level Security (RLS) no Postgres (quando habilitada nas políticas)
Scanner e actions sensíveis exigem sessão válida
Software proprietário — repositório público não implica licença open source


Status por área


ÁreaStatusPlataforma em produçãoAtivoMulti-tenantEstávelGestão processual e prazosEstávelDashboard / dossiêEstável (métricas em evolução contínua)Importação CSVEstávelDataJud scanner (nuvem)AtivoFila de tarefasAtivoEquipe + KPIAtivoDocumentos (procuração)EstávelDocumentos (habilitação / substabelecimento / revogação)Ativo (modelos em expansão)IAAtiva (evolução contínua)WhatsAppAtivo (conforme integração)Guia do Sistema (onboarding)Ativo

Limitações honestas

DataJud ≠ PJe. A base pública do CNJ pode atrasar, omitir ou divergir do sistema do tribunal.
Timeouts e instabilidade da API pública são esperados em lotes grandes; o scanner é sequencial de propósito (estabilidade > velocidade cega).
Varreduras FULL em carteiras de milhares de processos levam tempo.
Softwares jurídicos “completos” de mercado cobrem áreas (financeiro jurídico profundo, protocolo nativo PJe, etc.) que não são o foco deste produto.
O diferencial está na operação de volume + prazo + triagem CNJ + equipe, não em ser um ERP jurídico genérico.


Diferenciais

Feito para turno de operador, não só cadastro de processo
Multi-tenant real (empresa, perfis, isolamento)
Import pensado para legado em planilha
DataJud em nuvem com fila, telemetria e alertas de andamento / baixa / BA
KPI de pessoas (operadores / advogados) na supervisão
Documentos e IA no mesmo fluxo da carteira
Dossiê executivo imprimível (telemetria + evidências + prognóstico)
Evolução contínua sob controle do titular


Licença e contato
Copyright © 2026
Davi Alves Figueredo
W1 Capital Assessoria Financeira Ltda.
Todos os direitos reservados. É proibido copiar, modificar, distribuir, sublicenciar ou explorar comercialmente sem autorização expressa por escrito do titular. A publicação no GitHub não constitui licença open source.
Comercial / parcerias: w1capitalassessoria@protonmail.com
Produto: LexisPredict EliteLexisPredict Elite — gabinete digital para quem vive de prazo, processo e operação.

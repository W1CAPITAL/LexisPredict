# ⚖️ LexisPredict Elite

### Enterprise Legal Operations Platform

> Plataforma SaaS para gestão processual, operações jurídicas, inteligência operacional e automação documental.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Multi--Tenant-SaaS-blue?style=for-the-badge" alt="Multi-Tenant" />
  <img src="https://img.shields.io/badge/AI-Integrated-purple?style=for-the-badge" alt="AI" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License" />
</p>

---

## Visão Geral

O **LexisPredict Elite** é uma plataforma SaaS desenvolvida para escritórios de advocacia, assessorias financeiras e operações jurídicas que precisam centralizar processos, prazos, documentos, comunicação e inteligência artificial em um único ambiente.

No lugar de planilhas desatualizadas, conversas soltas no WhatsApp e PDFs espalhados, o LexisPredict organiza a rotina do gabinete em um fluxo contínuo: **carteira → prazos → atendimento → peças → auditoria**.

> Nascido de uso real em operação — não de protótipo de vitrine.

---

## Principais Recursos

- Gestão completa de processos e prazos
- Dashboard executivo orientado a ação
- Fila de tarefas e metas de atendimento
- IA integrada para apoio jurídico e operacional
- Geração automática de peças (procuração, habilitação, substabelecimento)
- Importação massiva e inteligente via CSV
- Integração com DataJud (CNJ) para triagem de andamentos
- WhatsApp operacional (rotina de despachos)
- Gestão de equipe multi-usuário com perfis de acesso
- **KPI e desempenho de operadores e advogados** (subárea em Equipe)
- Notas e evidências internas
- Arquitetura multi-tenant (isolamento por empresa)
- OCR e ferramentas de apoio documental
- Onboarding guiado e exportações gerenciais

---

## Funcionalidades

### Processos

- Cadastro, consulta e pesquisa rápida
- Status, risco e observações
- Controle de último retorno e próximo prazo
- Distribuição por tribunal (CNJ)
- Linha do tempo e histórico operacional
- Alertas de atualização quando há movimento no tribunal após o retorno registrado

### Tarefas e Atendimento

- Fila prioritária de contatos
- Foco em meta diária de atendimento
- Registro de retornos alinhado à carteira

### Documentos

Geração automática de:

- Procuração  
- Habilitação  
- Substabelecimento  
- Fluxos com revisão e exportação em PDF  

### Inteligência Artificial e Auditoria

- Veredito / auditoria com apoio DataJud + parecer técnico
- Extração e apoio em contratos e peças
- Chat operacional interno
- Arquitetura multi-provedor de IA (configurável por ambiente)

> **Nota operacional:** o DataJud (base pública CNJ) pode estar incompleto ou atrasado em relação ao PJe/site do tribunal. O LexisPredict usa o DataJud para triagem rápida; a conferência fina no sistema do tribunal continua recomendada.

### Dashboard Executivo

Indicadores em tempo real:

- Processos ativos, críticos e encerrados
- Próximos vencimentos e vencidos
- Visão por tribunal
- Acompanhamento da operação do dia

### Equipe (`/team`)

- Multiusuário por empresa
- Isolamento de dados (`empresa_id`)
- Cargos e hierarquia de permissões
- Provisionamento e gestão de operadores
- Distribuição de carteira

#### KPI e Desempenho (subárea da Equipe)

Dentro de **Equipe**, há uma subárea dedicada a **desempenho individual**:

- Acompanhamento de **operadores** (produção e ritmo de atendimento)
- Acompanhamento de **advogados** (carteira e indicadores de atuação)
- Visão comparativa para supervisão da banca operacional
- Apoio à gestão de meta e produtividade da equipe

Essa camada existe para o dia a dia de supervisores e gestores de operação — foco em **pessoas da equipe**, não em painéis genéricos de escritório.

### Importação Inteligente

Importação de grandes volumes via CSV, com:

- Normalização e saneamento de dados
- Deduplicação de protocolos
- Conversão e validação de datas
- Identificação automática de tribunais
- Classificação de risco e status

### Comunicação

- Terminal WhatsApp para rotina de gabinete
- Mensagens padronizadas e histórico operacional

### Outros Módulos

- Notas e evidências internas  
- OCR (documentos digitalizados)  
- Configurações e personalização visual  
- Onboarding / guia do sistema  
- Exportações e relatórios gerenciais  

---

## Arquitetura

```text
                      Internet
                          │
                          ▼
                Next.js 15 (App Router)
                          │
          ┌───────────────┴───────────────┐
          │                               │
   Server Actions                    IA Services
          │                               │
          ├──────────────┐                │
          ▼              ▼                ▼
    Supabase Auth   PostgreSQL      AI Providers
          │              │
          └──────── Multi-Tenant ─────────┘
                     (empresa_id + RLS)
Integrações laterais: DataJud (CNJ), WhatsApp/Evolution API, geração de PDF, importação CSV.

Stack
Front-end

Next.js 15 (App Router)
React
TypeScript
Tailwind CSS
shadcn/ui
Zustand

Back-end

Server Actions
Supabase (Auth + PostgreSQL)
Row Level Security (RLS)

Inteligência Artificial

Multi-provider
Chat / prompt / context builders
Fluxos de auditoria e extração

Documentos

React PDF
Extração de texto
OCR de apoio

Deploy

Vercel (produção)
Fluxo Git → deploy contínuo


Segurança
Arquitetura multi-tenant:

Isolamento por empresa_id
Row Level Security (RLS)
Autenticação Supabase
Controle por perfil e hierarquia de cargos
Auditoria de ações sensíveis (quando habilitada)


Público-alvo

Assessorias financeiras e de revisão bancária
Escritórios de advocacia (pequeno e médio porte)
Bancas com operação de volume e prazos
Equipes multi-operador com supervisão


Status do Projeto













































ÁreaStatusPlataformaEm produçãoMulti-tenantEstávelGestão processualEstávelImportação CSVEstávelDocumentos / peçasEstávelEquipe + KPI de operadores/advogadosAtivoIAAtiva (evolução contínua)DataJud / alertasAtivoDashboardEstável

Diferenciais

Feito para rotina de gabinete, não só cadastro de processos
Multi-tenant de verdade (empresa, perfis, isolamento)
Importação pensada para legado em planilha
IA e DataJud como apoio operacional (com limites explícitos)
KPI de operadores e advogados na área de Equipe
Interface executiva para uso diário longo
Código e produto sob controle proprietário, em evolução constante


Licença
Copyright © 2026
Davi Alves Figueredo
W1 Capital Assessoria Financeira Ltda.
Todos os direitos reservados.
Este software é proprietário.
É proibido copiar, modificar, distribuir, sublicenciar ou explorar comercialmente sem autorização expressa por escrito do titular.
A publicação deste repositório no GitHub não constitui licença open source.

Contato
Comercial / parcerias: w1capitalassessoria@protonmail.com
Produto: LexisPredict Elite
Autor: Davi Alves Figueredo

LexisPredict Elite — gabinete digital para quem vive de prazo, processo e operação.

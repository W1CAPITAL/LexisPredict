---
name: lexis-agency-orchestration
description: Especialistas por aba, evidência mínima e gates de revisão.
version: "1.0.0"
---
# Lexis Agency Orchestration

Inspiração: https://github.com/msitarzewski/agency-agents e https://github.com/addyosmani/agent-skills . Adaptação independente, não instalação integral de terceiros.

## Aplicação
- src/lib/agents/studio.ts: roles de API, PDF, privacidade, performance e atendimento, com planejamento sem LLM obrigatório.
- src/lib/agent-improvements/route-playbooks.ts: especialidades e evidência por módulo.
- /estudio-agentes: exploração de abas e auditação passiva HAR.

## Regras
1. Objetivo e rota antes de escolher especialistas.
2. Ferramenta e empresa autorizadas; least-privilege.
3. Fonte antes da conclusão: CNJ, DataJud/DJEN, documento ou comprovante quando aplicável.
4. Evitar equipes de agentes enormes e contexto repetido; usar regra determinística como primeira opção.
5. Contrato de saída explícito, revisão humana para clientes, valores, prazo, peças e envios.
6. Critérios: spec → plan → build → test → review → ship.
7. Falha de API não autoriza inventar fatos nem iniciar modelo local pesado automaticamente.
8. Papéis planejados não significam agentes autônomos executando em background.

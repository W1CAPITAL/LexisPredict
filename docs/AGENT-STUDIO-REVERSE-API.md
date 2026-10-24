# Estúdio de agentes — panorama por aba

## O que já está disponível
O módulo /estudio-agentes apresenta a matriz de módulos, rotas e especialidades, com links para as telas do Lexis e evidência mínima. O roteador do plugin agent-studio recebeu perfis para API, PDF, conformidade, performance e comunicação. O analisador de HAR roda no próprio navegador, sem servidor de inferência.

## Revisão do código por grupos de abas

| Abas | Especialistas e oportunidades |
| --- | --- |
| Dashboard / Analytics | KPIs, dedup, filtros e proveniência |
| Processos / Carteira / Encerrados | Mérito, cumprimento, DataJud/DJEN, registro oficial |
| Provas / Dossiês / Documentos | Evidência, contraprova, autoria, versão e revisão |
| WhatsApp / Mensagens | Rascunho, cliente correto, SAIR, confirmação de envio |
| Tarefas / Vencidos / Agenda | Consistência de datas, responsáveis e retorno |
| Report / Completo | Exportação, paginação PDF, contraste e performance |
| CRM / Vendas | Funil, último evento, enriquecimento autorizado |
| Financeiro / Planos | Conciliação, idempotência, confirmação de pagamento |
| Superagente / AI Lab | Roteamento, avaliação, budget de contexto, fallback leve |
| Settings / Supervisão | Acesso e RLS por empresa, trilha auditável |
| Integrações / Ferramentas | Contratos de API, testes e monitoramento sem replay |

As rotas completas e regras estão em src/lib/agent-improvements/route-playbooks.ts. O inventário foi feito sobre o código-fonte das rotas; isso não representa QA visual interativo de cada tela e estado autenticado.

## Como usar HAR
1. Abra um site próprio/autorizado e exporte DevTools → Network → Save all as HAR.
2. HAR bruto pode conter dados sensíveis; revise com cuidado e não compartilhe.
3. Abra /estudio-agentes#auditoria-api, confirme autorização e importe até 3 MiB.
4. Confira host, rota anonimizada, método, latência, 401/403, 429 e 5xx.
5. Exporte somente o resumo sanitizado, se necessário.

O modo não captura tráfego vivo, não usa sessão de terceiros, não instala reverse-api-engineer no servidor e não cria integração sem contrato revisado.

Fontes: https://github.com/msitarzewski/agency-agents (papéis), https://github.com/addyosmani/agent-skills (gates), https://github.com/kalil0321/reverse-api-engineer (HAR, sem comportamentos de bypass).

# LexisPredict — instruções para agentes técnicos

Fluxo: definir escopo → planejar → implementar pequeno → testar → revisar → publicar verificando Vercel READY.

1. Vercel hospeda Next.js; Supabase hospeda dados e controle de empresa. Qwen browser consome RAM do usuário.
2. Manter escopo por empresa, perfis e RLS.
3. Nunca inventar andamento, prazo, mérito, envio, pagamento ou dado de cliente.
4. Agentes de tarefa usam src/lib/agents/studio.ts e matriz src/lib/agent-improvements/route-playbooks.ts.
5. Critérios de fonte: CNJ, DataJud/DJEN, documentos, data da consulta e grau de certeza.
6. Para envio, alteração de cadastro e petição exigir confirmação e execução auditável.
7. Engenharia de API: somente HAR próprio/autorizado; não capturar cookies/tokens, reexecutar sessão, contornar login/WAF/CAPTCHA nem persistir HAR.
8. Não instalar centenas de agentes ou carregar modelos de navegador por padrão.
9. Rodar typecheck, Vitest, build, verificar runtime e plano de rollback.
10. Inspirado por Agency Agents e Agent Skills; Reverse API Engineer usado somente como referência para observação passiva de API.

Skills: skills/agency-orchestration/SKILL.md e skills/reverse-api-safe/SKILL.md.

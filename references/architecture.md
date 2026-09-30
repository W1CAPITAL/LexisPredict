# Arquitetura do autoaprimoramento

```text
Vercel CI / Supabase / App logs / Playwright / Agent traces
                         │
                         ▼
                 Improvement Observer
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           Repair    Performance     UX/AI
              │          │          │
              └──────────┼──────────┘
                         ▼
                 Candidate Change
                         │
                         ▼
                 Sandbox / Branch
                         │
          typecheck + unit + e2e + security
                         │
                         ▼
                    Draft PR
                         │
                    HUMAN GATE
                         │
                         ▼
                    Merge/Deploy
```

## Componentes recomendados

### 1. Observer
Entrada:
- GitHub Actions
- Vercel build/runtime
- Supabase errors/slow queries
- OpenInference/AgentOps
- Playwright
- feedback manual do usuário

Saída normalizada:
```json
{
  "category": "auth|db|performance|ux|ai|commercial",
  "severity": "P0|P1|P2",
  "evidence": [],
  "regression": true,
  "suggested_scope": []
}
```

### 2. Improvement planner
Sempre responde:
- hipótese;
- arquivos;
- risco;
- testes;
- métrica de sucesso;
- rollback.

### 3. Patch agent
Pode editar branch e criar migration **não destrutiva**. Não pode tocar produção.

### 4. Evaluator
Obrigatório:
- tenant isolation;
- auth/session hydration;
- plano/billing;
- process ownership;
- atendimento != edição;
- performance com 1, 200, 2.000 e 10.000 processos sintéticos;
- mobile/dark mode/contraste;
- DJEN/DataJud sem inventar sucesso.

### 5. PR gate
O PR deve conter:
- antes/depois;
- testes executados;
- riscos;
- migration;
- observabilidade;
- rollback;
- impacto em planos/cargos.

## Self-improvement seguro

O app não se "reescreve sozinho" em produção. A automação gera **candidatos de melhoria**. O humano decide o merge.

Isso evita:
- regressão silenciosa;
- elevação de permissão;
- fuga de tenant;
- mudança de preço/plano;
- treino indevido em PII;
- auto-merge de código que só passou em benchmark parcial.

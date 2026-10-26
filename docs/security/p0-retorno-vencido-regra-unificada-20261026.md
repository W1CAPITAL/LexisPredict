# P0 — Um retorno expirado conta como vencido (26/10/2026)

## Regra operacional
- **Vencidos no KPI principal = retornos ao cliente vencidos**: `proximo_retorno` anterior à data atual em Brasília, sem `ultimo_retorno` na mesma data ou depois do agendamento; processos encerrados não entram. Não é prazo judicial.
- **Status "Vencido" ou "Caso Crítico" no CRM = marcação manual/histórica**. É auditoria de cadastro, NÃO define o KPI de atrasos por data.
- **`proximo_prazo` legado = campo histórico independente**, que não prova perda de prazo judicial.
- As categorias nunca devem ser somadas; processo encerrado não deve gerar cobrança automática.

## Evidência agregada, somente leitura, no Supabase
Aos 26/10/2026: 18 agendamentos com retorno vencido, 10 status marcados (9 ativos, 1 encerrado manualmente). A interseção entre os 18 retornos efetivamente vencidos e os 9 status CRM ativos era **zero**; a classificação manual estava desalinhada. Esses são números de momento, não constantes.

## Implementação
- Migration `20261026_due_returns_are_overdue_kpi.sql` mantém exatamente a assinatura e as oito colunas da RPC `lexis_portfolio_snapshot` e altera somente a fórmula de `vencidos` para usar as datas do retorno (com a zona de Brasília).
- `src/app/actions/processos-kpis-action.ts` usa a mesma regra de vencimento por data da `/vencidos`, não compara mais `status === 'Vencido'`.
- Dashboard e `/processos` dizem **Retornos vencidos**, com alerta de que não significa prazo judicial perdido. A Central continua mostrando separadamente as marcações antigas.
- RLS, owner scope, totais ativos/encerrados, dados cadastrais, últimos retornos e notificações ficam intactos.

## Validação
- CI: TypeScript, Vitest, contrato comercial e build Next.js.
- Migração deve ser aplicada à base de produção (apenas redefinição da RPC) e conferida por consulta agregada logo em seguida; antes dessa implantação, o backend ainda exibirá a métrica antiga.
- Após deploy frontend, conferir dashboard, /processos, /vencidos e o mesmo tenant.

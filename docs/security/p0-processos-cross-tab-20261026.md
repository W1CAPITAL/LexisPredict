# P0 — Consistência de /processos após alterações (2026-10-26)

## Falhas reproduzidas pela inspeção do fluxo
- `load(true)` buscava a primeira página atualizada, mas mesclava `casesRef.current` e o cache anterior. Isso **ressuscitava registros excluídos** e versões antigas de processos, mesmo após confirmação do servidor.
- `loadMoreFromServer()` não comparava a geração da requisição: uma página em trânsito podia acrescentar dados antigos depois de uma exclusão, reatribuição ou atendimento.
- `/processos` não escutava `storage` das outras abas para atualização da lista; recarregava apenas em foco/intervalo de 90 s, enquanto os indicadores tinham intervalo próprio.
- `ReassignOwnerControl` persistia a nova titularidade, mas no retorno de sucesso da `/processos` apenas atualizava o formulário de edição; não invalidava as carteiras de outras abas.
- A invalidação indiscriminada de cache ao receber um evento externo poderia gerar notificações recíprocas infinitas entre abas.

## Correções
1. `reconcileCompanyPage(fresh,current,previous,force)`: quando `force=true`, aceita **somente dados confirmados pelo backend**. Na navegação normal mantém as demais páginas, deduplicando pelo identificador persistente. Uma exclusão não volta pelo cache.
2. `/processos` escuta `lexis_carteira_invalidation_v1` e `lexis_carteira_refresh_at` via `storage`, invalida o cache apenas localmente, atualiza listagem, busca e KPIs.
3. Formulários e gravações bloqueiam o refresh intrusivo; o sinal fica pendente até fechamento/fim da gravação.
4. Reatribuição aceita novo dono na UI e chama `syncedUpdate` para revogar caches e avisar as outras abas, **sem gravar campos não confirmados do formulário**.
5. Páginas adicionais retornadas depois de uma mutação são descartadas por número de geração (race guard).
6. `invalidateCarteiraCache({broadcast:false})` revoga caches sem escrever outro evento na `localStorage`, evitando tempestade entre abas.

## Cobertura e limitações
- Testes unitários verificam exclusão, atribuição, atualização de servidor, vazios autoritativos, deduplicação e supressão de rebroadcast.
- Perfis e RLS foram verificados no lote anterior; estas mudanças **não** alteram tabela, RLS, permissões, integração de WhatsApp ou dados de processos.
- A validação real de CRUD requer usuários de teste e processos **fictícios** em homologação. Testes de código não substituem esse E2E.

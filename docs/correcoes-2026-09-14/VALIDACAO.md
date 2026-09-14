# Validação desta entrega

Ambiente local: Node 24.19.0, Next 15.5.23, TypeScript 5.7.3, ESLint 9.39.5.
Base: `a09bab9d0c7642aaef9eb6ad9153c06230e15555`.

| Verificação | Resultado |
|---|---|
| Instalação inicial com `npm ci --ignore-scripts --no-audit --no-fund` | Concluída |
| Instalação das dependências de lint e atualização do lockfile | Concluída |
| `npm run test` | 86 testes passaram, em 15 arquivos |
| `npm run typecheck` | Passou, sem erros |
| `npm run lint` | Passou, sem erros |
| `npm run build` | Passou; 92 páginas estáticas geradas |
| Manifesto do Next | Inclui `server/src/middleware.js` e o matcher esperado |
| Smoke HTTP (`npm run test:e2e`) | Não concluído: o servidor local não iniciou por `uv_interface_addresses` no ambiente de execução |
| Rotas do novo menu | Todos os destinos têm página no repositório |
| Integridade do ZIP | Verificada por CRC e hashes SHA-256 do manifesto |

O build emite avisos não bloqueantes de dependências e de diretivas ESLint antigas sem uso. Eles não foram escondidos nem tratados como falhas corrigidas.

## Cobertura acrescentada

Vinte testes de regressão cobrem preservação de dono/crédito/datas, protocolo administrativo, limpeza de prazo, encerrado fora de vencidos, novidade após atendimento, classe e ordem de B.A., vínculo pelo CNJ oficial, deduplicação, risco sem baixa e sem soma duplicada, intervalos do DJEN, Retry-After e cancelamento.

Oito testes da ação de atendimento simulam o banco e a planilha: persistência das datas, crédito do supervisor sem transferência de dono, pendência de sincronização, limpeza do próximo retorno, datas inexistentes, conflito de edição, falha de gravação e bloqueio de perfil somente leitura. São testes com mocks, não prova de comunicação com os serviços reais.

Dois testes existentes usavam apenas `status: Vencido` sem prazo. As fixtures agora incluem prazo vencido, pois o cálculo recalcula o status a partir da data. O teste de planilha foi corrigido para exigir dono e atendente distintos; seu contrato anterior reproduzia a transferência indevida de dono.

## Validação que depende do ambiente publicado

Login com usuários reais em outro aparelho/Safari/PWA, RLS, triggers de auditoria, formato efetivo do webhook Apps Script, dados atuais da empresa e consultas DJEN/DataJud/Evolution não foram verificados ao vivo. Nenhum teste visual autenticado foi executado. Aplicar o pacote não corrige retroativamente proprietários, duplicatas ou auditorias já gravadas no banco.

Para conferir o atendimento em produção, registre um caso como operador e outro como supervisor; confira último/próximo retorno, crédito e dono após F5 e em outro aparelho. Se a planilha falhar, o aviso deve mostrar a pendência sem desfazer a gravação no app. “Tentar planilha” deve reenviar apenas o espelho.

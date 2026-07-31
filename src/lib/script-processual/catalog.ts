CORREÇÃO DO MOTOR DE SCRIPTS — classificação por JANELA, não só pelo último nome.

Problema real: processo com Liminar + Assistência Judiciária Gratuita (01/06) + Publicação/DJe + Expedição + Petição (10/06) recebeu texto "apenas atualização de rotina do tribunal". Isso está ERRADO.

REGRAS NOVAS (src/lib/script-processual — suggest + catalog; não mexer login/scanner/RLS além do necessário):

1) JANELA DE ANÁLISE
   - Ordenar movimentos por dataHora DESC.
   - Considerar os 20 mais recentes OU todos com data >= ultimoRetorno (se parseável), o que for mais amplo entre os dois (mínimo: 10 movimentos se existirem).
   - NUNCA decidir categoria só pelo movimento #1 se na janela houver ato de prioridade maior.

2) PRIORIDADE (maior vence; varrer a janela)
   P0 encerrado: baixa definitiva, trânsito em julgado, arquivado definitivamente, cancelada distribuição
   P1 liminar/tutela: LIMINAR, TUTELA, ANTECIPAÇÃO DE TUTELA, DEFERIDA/INDEFERIDA tutela
   P1 justiça gratuita: ASSISTÊNCIA JUDICIÁRIA, JUSTIÇA GRATUITA, GRATUIDADE
   P2 sentença: PROCEDENTE, IMPROCEDENTE, PARCIALMENTE, SENTENÇA (com cuidado)
   P2 recurso: APELAÇÃO, CONTRARRAZÕES, REMESSA 2º GRAU
   P3 contestação / réplica / especificação de provas / saneamento
   P3 cumprimento de sentença / execução
   P4 juntada de PETIÇÃO / petição (não é rotina; texto neutro)
   P5 citação / mandado / expedição de documento (pode ser formalidade; se na mesma janela houver P1/P2, a mensagem principal é P1/P2 e expedição é secundária)
   P6 ROTINA pura: mero expediente, ato ordinatório, certidão isolada, disponibilização DJe, publicação isolada, remessa/recebimento interno, inclusão juízo digital, movimentação não identificada

3) rotina_pos_retorno SÓ SE
   - ultimoRetorno parseável E
   - TODOS os movimentos com dataHora > ultimoRetorno forem P6
   - Se QUALQUER um for P0–P5 → NÃO usar script de “só rotina”

4) CASO TIPO ELISSAMA (liminar + AJG na janela + petição recente)
   - Categoria principal: liminar_e_ou_justica_gratuita (ou duas sugestões)
   - Texto deve mencionar que o juiz apreciou pedidos de liminar e/ou justiça gratuita
   - Pode citar que houve publicação/expedição e petição posterior, SEM inventar se a liminar foi deferida ou indeferida se o nome do movimento não disser
   - Se o movimento só diz "Liminar" sem deferida/indeferida → "o juiz analisou o pedido de liminar" (neutro)

5) CATÁLOGO — acrescentar/ajustar scripts:
   - liminar_analisada (neutro deferimento)
   - justica_gratuita_apreciada
   - liminar_e_jg_mesma_janela (combinado — como o exemplo do processo 1075481-32.2026.8.13.0024)
   - peticao_juntada (neutro)
   - rotina_pos_retorno (manter, mas só com regra 3)

6) UI: se houver 2 categorias fortes na janela, sugerir até 3 textos (ex.: completo + objetivo + só petição).

NÃO inventar resultado da liminar (deferida/indeferida) sem keyword explícita no texto do movimento.
NÃO classificar Petição como mero expediente.

AO FINAL: arquivos alterados + exemplo de saída para a cronologia:
01/06 Liminar + AJG + mero expediente; 03/06 Publicação; 09/06 Expedição; 10/06 Petição
→ NÃO pode sair "apenas rotina de cartório".

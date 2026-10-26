# P0 scanner — diagnóstico e correções (26/10/2026)

**0ms na nuvem:** eram eventos inventados por /api/datajud-status a partir de flags antigas da tabela processos, e reanexados a cada ciclo. Removido; só resultados realmente executados integram o log.

**DataJud não confirmado, DJEN OK:** consulta parcial, não conclusão de ambas as fontes; agora com detalhe de erro, duração real e aviso de reconsulta. HTTP 200 com zero hits no DataJud não equivale a encontrar um CNJ. Se as duas fontes falharem, scanner local não pode afirmar sucesso.

**IA:** hipóteses de Pollinations/Claude não podem sozinhas gravar baixa no tribunal, mérito, cumprimento, busca e apreensão ou evento judicial oficial. O merge passa a guardar sugestões em campos ai_* e a rotulá-las como não confirmadas, preservando evidências oficiais existentes.

**Dados reais conferidos, sem alteração de processos:** 680 casos possuem registro ai_engine; 394 também possuem flag de baixa (não necessariamente causada pela IA), e em 203 o motivo de baixa coincide textualmente com ai_evento_resumo. São candidatos a revisão e não erros comprovados. O caso 0800290-93.2026.8.12.0055 já tem precisa_revisar_encerramento=true; há também resumo DJEN sobre extinção/cancelamento e indício de cumprimento, então não apagar automaticamente. Outros CNJs citados receberam classificação IA, não certidão judicial.

**Validação:** testes unitários para fonte parcial, 0ms fictício e IA como sugestão; CI completo antes de merge. Consultas oficiais reprocessadas e auditoria individual dos 203 registros ficam pendentes de verificação de documentos. Nenhum processo é excluído, encerrado ou reclassificado por este lote.

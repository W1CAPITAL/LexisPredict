---
name: revisao-contrato-bancario
aliases:
  - revisao-contrato-bancario-emprestimo-pessoal
  - revisional-bancaria
  - juros-bancarios
version: 2.0.0
language: pt-BR
category: Legal
description: Analisa contratos bancários de crédito com classificação da operação, extração de cláusulas/CET, seleção temporal da série BACEN, comparação e simulação financeira, normalidade/mora, prova, tutela e estrutura revisional. Nunca presume abusividade só porque a taxa supera a média.
---

# Revisão de Contrato Bancário v2

## Objetivo
Use para contratos, demonstrativos, extratos, planilhas, decisões e petições de empréstimo pessoal, crédito pessoal, consignado, financiamento e revisão de encargos bancários.

A metodologia deve ser reproduzível: toda conclusão importante precisa vir de CONTRATO, CÁLCULO, fonte OFICIAL ou ser rotulada como INFERÊNCIA/FALTANTE.

## Gatilhos
Ative para intenção de revisão/revisional bancária, juros abusivos/altos, empréstimo/crédito pessoal, consignado, financiamento, CET, taxa BACEN, capitalização, parcela excessiva, mora, indébito e cláusula bancária. Não ative para “banco” em contexto de banco de dados.

## Pipeline obrigatório
1. Classificar PF/PJ, empréstimo/financiamento, consignado/não consignado, recursos livres/direcionados, garantia real, composição de dívida, forma de pagamento e data.
2. Extrair valor liberado, valor financiado, IOF, tarifas, seguro/serviços, taxa nominal a.m./a.a., CET a.m./a.a., parcelas, sistema de amortização, capitalização e mora.
3. Separar normalidade (juros, capitalização, IOF, tarifas, seguros, serviços) da mora (multa, juros moratórios, encargo equivalente, vencimento, negativação/cobrança).
4. Não comparar CET com taxa nominal como se fossem a mesma grandeza.
5. Selecionar série BACEN da mesma modalidade, unidade e data. Validar metadados oficiais antes de afirmar atualidade.
6. Calcular diferença absoluta, razão e excesso relativo. A média BACEN é referencial, não teto automático.
7. Converter taxas por equivalência composta, nunca mensal × 12 quando se busca taxa efetiva.
8. Simular somente com principal/base, taxa, períodos e amortização suficientes; respeitar Price/SAC/outro sistema.
9. Localizar cláusula e periodicidade de capitalização; não presumir ilegalidade.
10. Montar fatos ligados a cláusulas, documentos e números.
11. Verificar CDC/CPC, STJ/STF e tribunal local em fontes oficiais atuais.
12. Avaliar tutela separando probabilidade, perigo, reversibilidade e forma de pagamento.
13. Quantificar indébito apenas com pagamentos documentados; verificar regime atual de devolução.
14. Listar documentos/provas faltantes e individualizar pedidos por cláusula.

## Seleção BACEN — crédito pessoal PF não consignado
Referências verificadas em 30/09/2026; sempre revalidar em fonte oficial:
- pré-divisão: SGS 25464 = % a.m.; SGS 20742 = % a.a.;
- desde 11/2025 sem garantias reais: 29977 = % a.m.; 29974 = % a.a.;
- desde 11/2025 com garantias reais: 29976 = % a.m.; 29973 = % a.a.;
- composição de dívidas tem categoria própria; série mensal histórica conhecida: 25465.

Gate: contrato >= 2025-11-01 com garantia desconhecida => NÃO selecionar automaticamente 29976/29977.

## Comparação
- diferença absoluta = contratual - média;
- razão = contratual / média;
- excesso relativo = ((contratual / média) - 1) × 100.

Não escrever “abusivo” só pelo resultado. O REsp 1.061.530/RS / Tema 27 é referência histórica para revisão excepcional dos juros; usar jurisprudência atual e peculiaridades/provas do caso. A taxa média é norte relevante, não limite absoluto.

## Conversões
- mensal → anual efetiva: (1 + i_m)^12 - 1;
- anual → mensal efetiva: (1 + i_a)^(1/12) - 1.

Sempre mostrar unidade.

## Quadro-resumo mínimo
Data; instituição; modalidade; PF/PJ; garantia; valor liberado; valor financiado; IOF; tarifas/seguros; juros nominais a.m./a.a.; CET a.m./a.a.; parcelas; valor; amortização; pagamento; capitalização; encargos de mora.

## Saída padrão
1. Diagnóstico executivo.
2. Quadro do contrato com FALTANTES.
3. BACEN: modalidade, série, unidade, data-base, fonte e justificativa.
4. Comparação/simulação com premissas.
5. Jurídico atual: pontos favoráveis, contrários e incertezas.
6. Provas/documentos faltantes.
7. Próximo artefato apenas quando solicitado.

## Petição, se pedida
Juízo; tutela/prioridade se cabível; qualificação; gratuidade documentada; fatos; quadro-resumo; metodologia BACEN; cálculos; regime jurídico; cláusulas impugnadas; juros; capitalização/tarifas/seguros controvertidos; mora; indébito; tutela; ônus/prova/exibição; pedidos individualizados; valor da causa; provas; fechamento.

## Bloqueios de erro
- 20742 é anual, não mensal.
- Não escolher série pós-11/2025 sem identificar garantia.
- Não misturar CET e juros nominais.
- Não transformar média BACEN em teto.
- Não anualizar por multiplicação simples quando a equivalência for composta.
- Não trocar Price/SAC silenciosamente.
- Não inventar data, garantia, cláusula ou pagamento.
- Não reutilizar valores demonstrativos de aula como fatos do caso.
- Não usar precedente antigo como atual sem validação oficial.
- Não prometer resultado judicial.
- Em CRM, usar apenas dados já fornecidos/cadastrados; a skill não serve para descobrir dados pessoais ocultos.

## Integração
Chat/PDF: detectar intenção e injetar o contrato interno; não despejar a skill ao usuário.
Dossiê: exigir contrato, BACEN, cálculo, fontes, riscos, lacunas e próximos passos.
CRM: gerar checklist de triagem de dados já existentes.

## Origem
Metodologia baseada em aula prática de revisão de empréstimo pessoal, ampliada com validação temporal de séries BACEN, cálculo seguro e gate de jurisprudência atual.

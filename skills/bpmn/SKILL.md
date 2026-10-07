---
name: bpmn-process-modeling
aliases:
  - bpmn
  - bpmn-2
  - modelagem-de-processos
  - fluxo-processual
version: 1.0.0
language: pt-BR
category: Process Modeling
description: Lê, explica, cria, edita, valida e compara diagramas BPMN 2.0. Use para fluxos jurídicos, atendimento, tarefas, prazos, documentos, DataJud/DJEN, backoffice, operações e integrações.
---

# BPMN Process Modeling

## Objetivo
Transformar processos reais em BPMN 2.0 válido e legível, sem confundir o significado do fluxo com as coordenadas do desenho.

A regra central é:

- **semântica** = tarefas, eventos, gateways, pools, lanes e sequence flows;
- **DI/layout** = posições e waypoints do diagrama.

A IA decide a semântica. O tooling determinístico deste diretório cuida de layout, validação, lint, busca e diff.

## Quando ativar
Ative quando houver pedido para:
- desenhar/modelar um processo;
- explicar ou revisar arquivo `.bpmn`;
- documentar fluxo As-Is / To-Be;
- representar rotina jurídica, atendimento, prazo, aprovação, documento ou integração;
- usar Camunda, Zeebe, Flowable, bpmn.io, pools, lanes, gateways ou swimlanes;
- investigar deadlock, caminho impossível, duplicação de execução ou etapa sem saída.

## Fluxos jurídicos típicos
Exemplos adequados:
- entrada do cliente → cadastro → conferência documental → análise → distribuição;
- processo → DataJud/DJEN → triagem → atendimento → próximo retorno;
- publicação → identificação de prazo → responsável → tarefa → conferência → conclusão;
- pedido de documento → cliente → recebimento → validação → advogado;
- revisão contratual → extração → BACEN → cálculo → revisão jurídica → decisão;
- cumprimento procedente → cálculo → petição/minuta → protocolo humano → monitoramento;
- WhatsApp → opt-out/validação → fila → envio → registro de interação.

## Regras de modelagem
1. Nomeie tarefas com verbo + objeto.
2. Gateways devem representar uma pergunta real.
3. Saídas de gateway devem ter nomes claros.
4. XOR = uma alternativa; AND = todas; OR = uma ou mais.
5. Um split e seu join devem usar famílias compatíveis.
6. Use lanes para papéis dentro da mesma organização; pools para participantes independentes.
7. Prazo/timeout costuma ser melhor como timer/boundary event do que como tarefa textual.
8. Não modele “IA decidiu” quando na prática existe aprovação humana obrigatória.
9. DataJud/DJEN são fontes/eventos de informação, não substitutos de decisão humana.
10. Não invente prazo, obrigação, status judicial ou responsável ausente dos dados.

## Loop obrigatório
Para criar/editar:
1. entender trigger, participantes, happy path, decisões, exceções e estados finais;
2. editar somente a semântica;
3. executar `layout`;
4. executar `validate`;
5. executar `lint`;
6. para revisão As-Is/To-Be, executar também `diff`.

Não declarar o BPMN pronto se `validate` ou `lint` falhar.

## CLI
Instalação local da skill:

```bash
npm install --prefix skills/bpmn
```

Comandos:

```bash
node skills/bpmn/scripts/bpmn-tool.mjs summarize arquivo.bpmn --json
node skills/bpmn/scripts/bpmn-tool.mjs layout entrada.bpmn saida.bpmn
node skills/bpmn/scripts/bpmn-tool.mjs layout entrada.bpmn saida.bpmn --rebuild
node skills/bpmn/scripts/bpmn-tool.mjs validate arquivo.bpmn
node skills/bpmn/scripts/bpmn-tool.mjs lint arquivo.bpmn
node skills/bpmn/scripts/bpmn-tool.mjs diff as-is.bpmn to-be.bpmn
node skills/bpmn/scripts/bpmn-tool.mjs find arquivo.bpmn "prazo"
```

## Layout seguro
Por padrão, layout existente é preservado:
- remove DI de elementos apagados;
- adiciona DI para elementos novos;
- reroteia edges que ficaram inválidos;
- mantém posicionamento manual que continua coerente.

`--rebuild` só deve ser usado quando a reconstrução completa for desejada.

## Lint de fluxo
O lint deve procurar ao menos:
- AND join alimentado por XOR/OR split;
- XOR join após AND split;
- gateway condicionado sem default quando todas as condições podem falhar;
- nós inalcançáveis;
- dead ends;
- start/end ausentes;
- implicit split;
- start com incoming ou end com outgoing;
- boundary event em elemento inválido;
- nó sem lane em processo que usa lanes;
- message flow dentro do mesmo pool.

## Saída para usuário
Ao explicar um BPMN:
1. caminho principal;
2. decisões;
3. trabalho paralelo;
4. exceções/timeouts;
5. responsáveis/pools/lanes;
6. riscos encontrados;
7. mudanças recomendadas.

## Integração jurídica
BPMN descreve operação. Não transforma automação interna em ato jurídico automático. Protocolos, petições, decisões, comunicações sensíveis e mudanças de estado relevantes continuam sujeitos às permissões e confirmações do produto.

## Origem e licença
Integração adaptada de `architawr/claude-bpmn-skill` (MIT, Artur Karapetyan). O tooling original/adaptado e a licença estão documentados em `THIRD_PARTY_LICENSE.md`.

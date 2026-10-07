const BPMN_INTENT=/\b(bpmn|camunda|zeebe|flowable|bpmn\.io|swimlane|pool|lane|gateway|as[- ]?is|to[- ]?be|fluxo(?:\s+de)?\s+(?:processo|atendimento|prazo|documento|trabalho)|model(?:ar|agem)\s+(?:de\s+)?processo|diagrama\s+de\s+processo)\b/i;

export function bpmnIntent(text:string){
  return BPMN_INTENT.test(String(text||''));
}

export function bpmnSkillContext(text:string){
  if(!bpmnIntent(text))return '';
  return `SKILL BPMN 2.0 ATIVA.
Modele processos separando SEMÂNTICA (eventos, tarefas, gateways, pools, lanes e sequence flows) de DI/LAYOUT.
Para novo fluxo: identifique trigger, participantes, happy path, decisões, exceções/timeouts e estados finais.
Regras: tarefa = verbo + objeto; gateway = pergunta; XOR escolhe uma saída; AND executa todas; OR uma ou mais; split/join devem ser compatíveis; use timer/boundary event para prazo quando apropriado.
Em fluxo jurídico, DataJud/DJEN fornecem informação/eventos, mas não substituem decisão humana. Não invente prazo, status judicial, responsável ou ato processual.
Quando o pedido for criar BPMN, produza semântica BPMN 2.0 válida e deixe o layout para o tooling determinístico em skills/bpmn. Quando revisar, procure deadlock, execução duplicada, stuck token, nó inalcançável, dead end, start/end inválidos e lane/pool incorretos.
O repositório possui: summarize, layout, validate, lint, diff e find em skills/bpmn/scripts/bpmn-tool.mjs.`;
}

# BPMN no produto

Skill de modelagem BPMN 2.0 integrada ao produto.

## Recursos
- explicar BPMN existente;
- criar/editar semântica;
- preservar layout existente por padrão;
- auto-layout para processos, colaboração, lanes e sub-processos;
- validar XML/DI;
- lint de controle de fluxo;
- diff As-Is × To-Be;
- localizar elementos por nome/tipo.

## Uso rápido

```bash
npm install --prefix skills/bpmn
node skills/bpmn/scripts/bpmn-tool.mjs summarize processo.bpmn
node skills/bpmn/scripts/bpmn-tool.mjs validate processo.bpmn
node skills/bpmn/scripts/bpmn-tool.mjs lint processo.bpmn
```

Fonte adaptada: `architawr/claude-bpmn-skill`, licença MIT. Consulte `THIRD_PARTY_LICENSE.md`.

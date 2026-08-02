# Melhoria de evento_resumo — src/app/actions/case-actions.ts

## Objetivo
Notificações e capa devem mostrar **o que aconteceu de fato**, não só tags.

## Trecho recomendado (após montar patch de DataJud/DJEN)

Substitua a atribuição final de `eventResumo` por algo nesta linha:

```ts
  // Preferir motivo descritivo (BA, baixa, sentença) ou snippet real
  if (ba.indicio && ba.motivo) {
    eventResumo = ba.motivo;
    eventTipo = 'ba';
  } else if (enc.encerrado && enc.motivo) {
    eventResumo = enc.motivo;
    eventTipo = eventTipo || 'transito_ou_baixa';
  } else if (patch.djen_ultimo_resumo) {
    // snippet legível (não só keywords)
    eventResumo = String(patch.djen_ultimo_resumo).substring(0, 180);
  } else if (upd.nomeUltimo) {
    eventResumo = upd.nomeUltimo;
  }

  // Keywords curtas ficam só para telemetria interna (opcional)
  // patch.evento_tags = summarizeDjenKeywords(...);

  patch.evento_tipo = eventTipo;
  patch.evento_resumo = eventResumo;
```

## Variáveis esperadas no fluxo atual
- `ba` = resultado de `analisarBuscaApreensao(dataJud)`
- `enc` = resultado de `detectarEncerradoNoTribunal(movimentos)`
- `upd` = resultado de `detectarAtualizacaoPosRetorno(...)`

Isso faz a lista de alertas mostrar textos como:
- "Classe processual confirma Busca e Apreensão: ..."
- "RITO DE EXTINÇÃO: Identificada sentença de extinção..."
em vez de apenas `BA | SENTENÇA | TRÂNSITO/BAIXA`.

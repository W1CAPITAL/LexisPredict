# Simulation — LexisPredict v4

Motor de cenarios para comparar opcoes sob incerteza.

## Motor

`src/lib/simulation/scenario-engine.ts` executa Monte Carlo local com:
- seed reproduzivel;
- distribuicao triangular por fator;
- pesos;
- P10/P50/P90;
- media;
- taxa em que cada opcao terminou no topo.

Nao usa LLM e nao depende de API.

## Uso correto

Entrada por opcao:
- `baseScore`;
- fatores com `min`, `likely`, `max`;
- `weight`.

Use quando ha premissas quantitativas explicitas e varias opcoes.

## Uso incorreto

- Nao chamar resultado de probabilidade real de processo judicial, eleicao, saude ou qualquer evento sem modelo empirico validado.
- Nao esconder premissas.
- Nao usar precisao decimal como sinal de certeza.

## Interpretacao

1. Verificar se as premissas fazem sentido.
2. Comparar P10/P50/P90, nao apenas media.
3. Observar sensibilidade dos fatores.
4. Em decisao importante, rodar Council X10.
5. Abrir terceiro lado: existe uma opcao C que reduz a incerteza?

MiroFish-Offline e neuroparticles sao referencias de laboratorio para simulacoes multiagente/evolutivas; nao sao dependencia do produto.

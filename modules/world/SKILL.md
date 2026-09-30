# World Sandbox — LexisPredict v4.1

Laboratório de mundo procedural e agentes.

## Fundamentos

Inspirado por Craft e clones voxel:
- mundo por seed;
- chunks gerados sob demanda;
- biomas;
- recursos;
- edições criativas;
- agentes com inventário, energia e objetivos;
- simulação reproduzível.

Inspirado por DouZero:
- episódios;
- políticas de ação;
- competição/cooperação podem ser adicionadas como estratégias;
- avaliação separada de treinamento.

## Motor

`src/lib/simulation/world-engine.ts`.

O mundo é virtualmente não pré-alocado: coordenadas distantes geram chunks quando solicitadas.

## World Lab

`/world-lab`.

Ferramentas criativas:
- construir;
- floresta;
- água;
- ferro;
- limpar.

As edições ficam no browser por seed e são passadas ao motor. Não entram no banco jurídico.

## Agentes

Objetivos atuais:
- explore
- gather
- build

Estado:
- posição;
- energia;
- inventário;
- estruturas;
- distância.

Próximas extensões devem entrar como plugins/policies, não hardcode gigante no motor.

## Limite conceitual

É sandbox de simulação/criatividade, não previsão do mundo real. Resultados de agentes e mundo procedural não viram evidência jurídica.

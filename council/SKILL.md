---
name: lexis-council
description: Multi-perspectiva local ou multi-provider (inspirado em karpathy/llm-council). Use when council, segunda opiniao, trade-off, arquitetura.
---

# Lexis Council X10

## Rodada 1 (cega)

Para cada lente, system prompt curto:

```
Voce e a lente {NOME}. Responda so sob esse angulo.
Pergunta: {Q}
Criterio de pronto: {DONE}
Formato: 5-10 linhas, 1 recomendacao clara, 1 risco.
Nao mencione outras lentes.
```

Lentes padrao Lexis: Ops carteira | Juridico | Custo/token | Offline | GTM.

## Rodada 2 (sintese)

```
Voce sintetiza o council.
Consenso (o que todas/concordam):
Divergencia:
Recomendacao unica (1 paragrafo):
Proximos 3 passos:
Riscos residual:
```

## Local vs multi-provider

- **Local:** mesmo modelo, prompts de lente diferentes (sempre disponivel).
- **Multi-provider:** so se API keys existirem (Gemini, OpenAI, etc.). Nao inventar chave.

Gravar em `decisions/YYYY-MM-DD-council-<slug>.md`.


## Council X10 + terceiro cerebro

Para decisoes de alto impacto, use 10 lentes independentes:

1. Operacao/carteira
2. Juridico/produto
3. Evidencia/fontes
4. Dados/RLS/LGPD
5. Seguranca/abuso
6. Custo/token/infra
7. Offline/resiliencia
8. UX/acessibilidade
9. QA/testes/reversibilidade
10. Negocio/GTM

### Rodada 3 — terceiro lado

Depois de tese e antitese, abra uma lente que nao escolha nenhum dos dois lados.

Perguntas:
- Qual premissa compartilhada pelos dois lados pode estar errada?
- Existe uma opcao C menor, reversivel ou deterministica?
- O que muda se nenhuma API/modelo estiver disponivel?
- O que a evidencia atual nao permite concluir?
- Qual decisao pode ser adiada sem custo real?

A sintese final deve separar: fatos, inferencias, decisoes, riscos e testes de validacao.

### Gate de evidencia

Nao declarar sucesso de implementacao sem uma evidencia verificavel: teste, typecheck, build, diff, resposta de endpoint, log ou resultado funcional.

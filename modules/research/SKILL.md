# Research — LexisPredict v4

Pesquisa orientada por evidencia para web, fontes oficiais e documentos publicos.

## Ordem

1. Formular a pergunta em uma frase.
2. Fazer recall para evitar pesquisa repetida.
3. Preferir fontes oficiais/primarias.
4. Usar Firecrawl quando configurado:
   - search para descobrir fontes;
   - scrape para extrair markdown limpo.
5. Usar Scrapling/Chrome DevTools somente como sidecar autorizado quando Firecrawl nao resolver.
6. Gravar evidencia: fonte, claim, trecho e data observada.
7. Separar fato, inferencia, conflito e lacuna.
8. Passar pelo quality gate.

## Firecrawl

Env:
- `FIRECRAWL_API_KEY` para cloud;
- `FIRECRAWL_BASE_URL` para instancia self-host.

O adapter bloqueia localhost, IPs privados e esquemas nao HTTP(S).

## Regras

- Nao contornar login, paywall, captcha ou permissao.
- Nao tratar snippet como prova quando a pagina completa estiver disponivel.
- Em tema juridico, preferir tribunal/CNJ/diario oficial quando aplicavel.
- Em informacao recente, registrar data da fonte.
- Nao inventar citacao ou URL.

## Criterio de pronto

Uma pesquisa esta pronta quando:
- as fontes principais estao identificadas;
- conflitos relevantes foram explicitados;
- a resposta distingue fato de analise;
- existe evidencia suficiente para as afirmacoes centrais.

# Enrichment é opcional

`ENRICHMENT_LOOKUP_ENABLED`, `ENRICHMENT_LOOKUP_URL` e `ENRICHMENT_LOOKUP_TOKEN`
**não são obrigatórios**.

- Sem eles: DJEN revisional, filtros F1/F2, carteira/CNJ e Sherlock funcionam normalmente.
- Com eles: o app pode, se você ligar o toggle, pedir tel/e-mail/CPF/endereço à **sua** API.

## Env (tudo opcional)

```bash
# deixe de fora ou false — comportamento padrão
ENRICHMENT_LOOKUP_ENABLED=false

# só se quiser usar a sua API
# ENRICHMENT_LOOKUP_ENABLED=true
# ENRICHMENT_LOOKUP_URL=https://sua-api.exemplo/lookup
# ENRICHMENT_LOOKUP_TOKEN=seu-token
# ENRICHMENT_LOOKUP_TIMEOUT_MS=8000
```

Não configure nada se não for usar. O scan não depende disso.

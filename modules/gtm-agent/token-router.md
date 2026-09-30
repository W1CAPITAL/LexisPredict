# Token router — intent → caminho

## Intents com ZERO modelo

- carteira_list, case_get, case_save
- kpi_ativos, kpi_vencidos, kpi_atendidos_semana
- ranking_atendentes
- escopo_mine_vs_empresa (cargo)
- export_csv
- auth_login (Supabase)
- watermark_strip_local (script OpenCV / repo local em asset proprio)

Implementacao: server action / SQL. O chat do agente so confirma "feito" com template fixo.

## Intents SLM (mini/nano / 5.5 baixo)

- rascunho_post_linkedin
- comentario_linkedin
- email_cliente_curto
- classificar_intencao_usuario (este router)
- resumir_log_scanner (sem inventar CNJ)

## Intents LLM medio

- objecao_venda complexa
- comparar_duas_arquiteturas
- texto institucional longo

## Intents LLM forte (raro)

- debug de regressao multi-arquivo
- desenho de RLS / multi-tenant novo
- negociacao comercial sob medida

## Pseudocodigo

```
def route(user_text, cargo):
    intent = classify_local(user_text)  # regex + keywords; senao SLM
    if intent in ZERO:
        return run_lexis_action(intent)
    if intent in SLM:
        return call_model(tier="mini", max_tokens=400)
    if intent in LLM_MED:
        return call_model(tier="mid", max_tokens=800)
    return call_model(tier="strong", max_tokens=2000)
```

## Meta de custo

- >= 70% das perguntas do painel Agente → ZERO token
- >= 25% → SLM
- <= 5% → LLM forte

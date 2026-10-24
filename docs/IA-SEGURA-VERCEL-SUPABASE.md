# IA segura no LexisPredict — Vercel, Supabase e PCs com 8 GB

## Diagnóstico do travamento
O motor `onnx-community/Qwen2.5-0.5B-Instruct` antes era baixado pelo navegador via Hugging Face e inicializado com Transformers.js. Apesar de pequeno em parâmetros, o modelo precisa de pesos, cache, ativação, memória de inferência e runtime WebGPU/ONNX. A implementação antiga tentava WASM/CPU quando GPU falhava; em PC de 8 GB, o navegador e o sistema podem ficar sem memória e travar.

**Hospedar o Next.js na Vercel não transfere execução do modelo local para a Vercel.** Supabase é a fonte de dados e registros, não um serviço GPU de inferência. Para LLM remoto sem consumir a RAM do operador, é necessário um worker/servidor dedicado com memória suficiente, fora de funções serverless, por exemplo Colibri ou MiniCPM com API privada HTTPS.

## Alterações nesta versão
- Qwen 0.5B é **experimental e desativado por padrão por sessão**; preferência salva antiga é restaurada como `local_only`.
- Nenhum fallback automático dos motores online dispara o carregamento de Qwen.
- Ativação requer seleção de Qwen E switch explícito de consentimento.
- Worker exige WebGPU; sem WebGPU, retorna erro legível, **sem fallback CPU/WASM**.
- Memória indicada pelo navegador abaixo de 8 GB bloqueia o experimento.
- Entrada/histórico e `max_new_tokens` limitados para reduzir carga; um único worker ativo.
- Cancelamento e saída de aba encerram o worker. Limites não garantem operação perfeita no hardware mais fraco.

## Modo recomendado
| Motor | Onde executa | Tokens pagos? | Carga no PC | Estado |
| --- | --- | --- | --- | --- |
| Motor Lexis (scripts) | Navegador + server actions leves | Não | Baixa | Padrão leve, determinístico |
| IA configurada no servidor | Provedor/worker externo | Conforme infraestrutura | Baixa | Opcional |
| Qwen 0.5B experimental | Navegador do operador | Não | **Alta** | Apenas com opt-in e WebGPU |
| Supabase | Banco/Postgres | Plano Supabase | Baixa | Dados, não modelo |
| Vercel | Next.js/serverless | Plano Vercel | Baixa | UI e APIs, não GPU dedicada |

## Fluxo de contingência sem travar
1. Em `/chat` / Superagente, escolha **Motor Lexis (scripts)** para consultas determinísticas.
2. Em `/report`, use KPIs calculados a partir do banco, sem Qwen.
3. Se precisar de interpretação aberta por LLM sem ocupar a máquina, configure um endpoint remoto com recursos dedicados. Não afirme disponibilidade sem health check e geração real.
4. Não habilite Qwen no PC com travamentos recorrentes. O switch experimental pode ser deixado desligado permanentemente.
5. Não usar WebGPU experimental em massa nem várias guias carregando pesos simultaneamente.

## Notas operacionais
- Reinicie/feche abas que carregaram modelo antigo para libertar RAM e GPU.
- Hard reload para carregar worker atualizado `/workers/lexis-local-llm.worker.mjs`.
- A verificação do worker acontece no navegador de cada operador, não no build da Vercel.
- Sem API externa, respostas abertas complexas dependem da qualidade de algoritmos locais/skills e podem ficar limitadas; não prometer LLM completo com zero custo de compute.

# Colibri no LexisPredict

O Colibri é um motor de inferência **self-hosted** de [JustVugg/colibri](https://github.com/JustVugg/colibri). O código do LexisPredict pode conversar com ele por HTTPS, mas a Vercel **não executa o motor nem armazena os pesos** (a menor instalação exige vários GB de RAM e disco).

## Estado do projeto W1 em 08/10/2026

A implantação na Vercel ainda não possui `COLIBRI_BASE_URL`. Portanto, o modo **Colibri próprio** não pode gerar respostas até haver servidor real ativo. Não basta configurar `COLIBRI_MODEL=auto`; precisa existir um modelo carregado no Colibri.

## Instalação do modelo menor

Use as instruções oficiais de [AI_SETUP](https://github.com/JustVugg/colibri/blob/main/docs/AI_SETUP.md). Na máquina ou VPS com RAM/disco adequados:

1. Instale o Colibri, selecione um modelo que caiba no hardware; entre os menores suportados há **Qwen3-Coder-30B-A3B** (download cerca de 19 GB, RAM mínima 8 GB, recomendada 18 GB) e OLMoE (7B, mais passos de conversão).
2. Execute `coli serve` e teste `GET /v1/models`. O servidor anuncia o ID do modelo realmente carregado.
3. Publique a API por um proxy HTTPS com autenticação (não exponha a porta local na Internet aberta). Restrinja acesso aos IPs do seu servidor ou implemente chave forte `COLI_API_KEY`.
4. Configure **Environment Variables** server-side na Vercel para o projeto `private`, no escopo `production`:
   - `COLIBRI_BASE_URL=https://seu-host-seguro.example/v1` (URL real do Colibri)
   - `COLIBRI_API_KEY=<chave privada no servidor>`
   - `COLIBRI_MODEL=auto` (detecção automática via `/v1/models`) ou ID efetivo do modelo.
   - `COLIBRI_TIMEOUT_MS=35000` (opcional).
5. Faça redeploy da produção. Usuários autenticados podem consultar `GET /api/ai/colibri-status`, que retorna só `configured`, `reachable` e ID do modelo (nunca URL ou chave).

No Assistente, `Colibri próprio` é **exclusivo**: se falhar, mensagens e documentos **não serão enviados a outros provedores**. No modo automático, Colibri configurado tem prioridade; em perguntas simples, se ele não estiver pronto, pode usar um provedor externo leve Groq **identificado como Groq** (modelo `GROQ_LIGHT_MODEL` ou `llama-3.1-8b-instant`), desde que haja `GROQ_API_KEY`. Para assuntos complexos a cascata normal mantém modelos mais capazes.

### Problemas comuns

- `configured=false`: falta `COLIBRI_BASE_URL` ou URL inválida; produção exige HTTPS.
- `reachable=false`: Colibri não iniciou o modelo, proxy inacessível, chave incorreta ou /v1/models não respondeu.
- `COLIBRI_INDISPONIVEL`: não é uma resposta gerada nem uma "simulação" de Colibri.
- Se o modelo não tiver ID fixo, deixe `COLIBRI_MODEL=auto`; o LexisPredict resolve `/v1/models` e mantém cache de 60 segundos.

**Importante:** não cole tokens no repositório ou em mensagens. Use as variáveis sensíveis da Vercel.

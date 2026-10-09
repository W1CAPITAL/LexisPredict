# Assistente LexisPredict — Colibri + MiniCPM + Needle 3

## Arquitetura (sem falsas promessas de inferência)

- **Colibri (JustVugg/colibri)**: serviço C self-hosted que transmite especialistas MoE do SSD, podendo rodar modelos muito grandes se o host tiver disco, RAM, CPU e tempo suficientes. Fornece `/v1/models` e `/v1/chat/completions`. O Colibri não executa automaticamente os pesos do MiniCPM.
- **MiniCPM5 (OpenBMB/MiniCPM)**: LLM separado e menor, servido por Ollama, vLLM, SGLang ou llama.cpp através de API OpenAI-compatible. Texto em `MiniCPM5-1B`/2B; visão apenas com modelo **MiniCPM-V** carregado e reconhecido como vision no endpoint.
- **Needle 3 (cactus-compute/needle)**: motor de ~8–29 MB de **seleção de ferramentas/extração**, NÃO gerador de respostas livres. Serviço Python opcional do repositório em `services/needle-router/server.py` utiliza `pip install cactus-needle`, monta um `needle.Needle` com apenas ferramentas read-only e devolve `function_calls` e `confidence`. O backend nunca executa comandos arbitrários ou envia WhatsApp pelo modelo.
- **Base interna Lexis**: RAG local determinístico sobre `src/lib/knowledge/index.json`, funcionando sem Needle, sem servidores externos e sem transferência de documentos/CPF.
- **Qwen navegador**: fallback privado já presente em `/chat`, identificado como `LOCAL_BROWSER`; usa memória do dispositivo e exige download inicial.

## Configuração Vercel: só valores verdadeiros

Depois de iniciar serviços persistentes com acesso HTTPS, definir Environment Variables privadas no projeto `prj_HlN5Y4UXmlQq9FRjiiqSv89n05GO`:

```dotenv
COLIBRI_BASE_URL=https://seu-host-colibri-real/v1
COLIBRI_API_KEY=chave-real-definida-no-coli
COLIBRI_MODEL=auto

MINICPM_BASE_URL=https://seu-host-minicpm-real/v1
MINICPM_API_KEY=chave-do-proxy-ou-servico
MINICPM_MODEL=auto

NEEDLE_ROUTER_URL=https://seu-host-needle-real
NEEDLE_ROUTER_TOKEN=token-de-24+-caracteres

# Modelo local/browser não precisa dessas variáveis.
```

Nunca configurar URLs de exemplo como variáveis reais: isso impede respostas e pode enviar dados para terceiros não autorizados. Nunca expor chaves como `NEXT_PUBLIC_*`.

## Host Colibri: um modelo de verdade

Repositório: https://github.com/JustVugg/colibri
Guia: https://github.com/JustVugg/colibri/blob/main/docs/AI_SETUP.md

1. Na máquina/VPS com acesso ao SSD, rodar `python3 c/setup_hw.py --json` e `python3 c/coli setup --list --json`.
2. Selecionar o modelo que cabe no hardware, conferir tamanho e confirmar download. O modelo menor do catálogo atual exige pelo menos vários GB de RAM e dezenas de GB de SSD; modelos MoE enormes podem ser MUITO lentos.
3. Instalar com `python3 c/coli setup --yes --model <id-escolhido> --no-start`, conforme a recomendação do detector.
4. Iniciar `coli serve` e configurar `COLI_API_KEY`. Primeiro verificar `curl http://127.0.0.1:8000/v1/models`; depois testar um `/v1/chat/completions` real.
5. Publicar atrás de proxy HTTPS autenticado (sem deixar porta C pública). O hostname HTTPS vai para `COLIBRI_BASE_URL`.

## MiniCPM separado e leve

Repositório: https://github.com/OpenBMB/MiniCPM
A documentação atual do MiniCPM5 mostra, por exemplo:

```sh
pip install "vllm>=0.21"
vllm serve openbmb/MiniCPM5-1B --port 8001
```

Ou seguir o guia do próprio repositório para Ollama/llama.cpp, caso não haja GPU. Verificar o modelo via `GET /v1/models` e uma resposta `POST /v1/chat/completions` antes de fornecer o endpoint ao LexisPredict. Recomenda-se proxy HTTPS e autenticação separados dos do Colibri.

## Needle 3 privado

```sh
python3 -m pip install cactus-needle
export NEEDLE_ROUTER_TOKEN='<segredo-forte-aleatorio>'
python3 services/needle-router/server.py
```

O serviço inicia localmente em `127.0.0.1:8751`; um proxy HTTPS autenticado é necessário antes de configurar `NEEDLE_ROUTER_URL` na Vercel. A rota `POST /route` aceita `{ "query": "Explicar competência absoluta" }`, devolve lista de chamadas sem mutações e somente escolhe termos para a busca na base interna. O LexisPredict exige `confidence >= 0.65` quando essa medida é fornecida.

## Verificação de saúde

Com sessão LexisPredict autenticada: `GET /api/ai/engine-status` informa separadamente Colibri, MiniCPM, Needle e o LLM local do navegador, sem expor segredos ou URLs. `configured=true` não implica resposta do modelo: para usar, deve haver `reachable=true` com modelo ativo.

## Ordem e sigilo

1. Para texto: Colibri configurado → MiniCPM configurado → motores comerciais da cascata (somente no modo automático).
2. Colibri e MiniCPM **selecionados explicitamente** não enviam conteúdo para serviços comerciais. Na UI, quando o motor privado falha, o Qwen pode tentar gerar **no próprio navegador**, com rótulo diferente.
3. Needle é apenas um classificador de ferramentas; a informação textual é recuperada localmente, com fonte atribuída, nunca inventada.
4. Se uma consulta contém anexos, CNJ, CPF ou termos que sinalizam dados pessoais, Needle NÃO recebe essa pergunta.
5. Revisão humana é obrigatória para decisões jurídicas, valores, petições e comunicações ao cliente.

**Infraestrutura atual:** antes de aplicar uma URL real e iniciar os serviços, Colibri/MiniCPM/Needle estão **integrados no código, não em execução**. Não se pode alocar GPU ou um processo nativo persistente no runtime serverless da Vercel.

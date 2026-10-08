# LexisPredict — Colibri próprio + LLM local sem créditos

O LexisPredict tem **dois mecanismos diferentes** e mostra sempre quem respondeu:

- **Colibri (servidor)**: API OpenAI-compatible do projeto oficial `JustVugg/colibri` executando em uma **máquina/VPS com modelo carregado**, fora da Vercel. Requer `COLIBRI_BASE_URL` HTTPS e, se configurado no servidor, `COLIBRI_API_KEY` na Vercel.
- **Lexis Local LLM (navegador)**: Qwen2.5-0.5B-Instruct ONNX q4, usando Transformers.js e Web Worker. As perguntas são processadas no navegador; os pesos são baixados do Hugging Face na primeira utilização e ficam em cache quando suportado. Não é o motor C Colibri.
- **LOCAL_RESPOSTA_RAPIDA**: saudações de reconhecimento determinístico (ex.: "OLÁ MARILENE"). Não é um LLM nem uma chamada à nuvem.

### Rodar agora com o LLM local

Abra `/chat`, selecione **Lexis Local LLM · Qwen 0.5B**, envie texto. Na primeira execução, autorize o download e aguarde o indicador de progresso. Em computadores com GPU compatível, usa WebGPU; caso contrário tenta CPU via WASM. É necessário navegador atualizado, memória e conexão para baixar o modelo. Perguntas subsequentes podem usar o cache. Sem esses requisitos, o app exibirá um erro claro; **não garante funcionamento em aparelhos fracos**. Imagens não são suportadas pelo Qwen textual. PDFs podem fornecer texto extraído, limitado por contexto e memória.

Quando o Colibri exclusivo falha, o assistente pode usar o Qwen **no navegador**, identificando `LOCAL_BROWSER`, sem enviar o prompt a outro provedor de inferência. Outros provedores online na cascata permanecem separados.

### Instalar o Colibri de verdade no Windows / VPS

O Colibri NÃO é um provedor hospedado pronto para usar. Sua API precisa de um processo de inferência com modelo em disco. Consulte o guia oficial [AI_SETUP](https://github.com/JustVugg/colibri/blob/main/docs/AI_SETUP.md).

1. No Windows: baixe o repositório `https://github.com/JustVugg/colibri` e abra `START-HERE.bat`. No Linux/Mac: `git clone https://github.com/JustVugg/colibri.git && cd colibri && ./start-here.sh`.
2. Confira o hardware com `python3 c/setup_hw.py --json` e os modelos compatíveis com `python3 c/coli setup --list --json`. **Antes de baixar um modelo (19GB+ para alguns menores), confira espaço, RAM e confirme expressamente o download**. OLMoE ou a opção que a ferramenta recomendar pode ser adequada; não force GLM 744B em hardware insuficiente.
3. Inicie `coli serve` com chave `COLI_API_KEY` forte e o modelo escolhido. Valide `GET http://127.0.0.1:8000/v1/models`. Somente permita acesso público através de proxy HTTPS autenticado, não publique diretamente a porta.
4. Configure no projeto Vercel do LexisPredict: `COLIBRI_BASE_URL=https://host-real/v1`, `COLIBRI_API_KEY=...` (se a API exigir), `COLIBRI_MODEL=auto`. As variáveis são privadas de servidor, nunca `NEXT_PUBLIC_*`.
5. Após redeploy, consulte o status do Colibri na tela Motores. Conectado só significa que o servidor respondeu `/v1/models`; teste uma geração real no chat.

**Ambiente W1:** a inspeção de variáveis da Vercel não encontrou `COLIBRI_BASE_URL`. Nenhum código pode criar memória GPU/RAM, baixar pesos e manter `coli serve` em execução dentro de uma função serverless Vercel. É preciso indicar uma máquina/VPS ou conectar a existente.

### Diagnóstico

- `LOCAL_RESPOSTA_RAPIDA`: resposta determinística para saudação; disponível sem rede de inferência.
- `LOCAL_BROWSER:onnx-community/Qwen2.5-0.5B-Instruct`: modelo real no navegador, sem API de inferência.
- `colibri:<modelo>`: resposta gerada pelo Colibri remoto configurado.
- `MOTORES_E_LOCAL_INDISPONIVEIS`: Colibri/provedores falharam e o download/carga local também; exibir os motivos e não fingir sucesso.

Os arquivos `public/workers/lexis-local-llm.worker.mjs` e `src/lib/ai/browser-local-llm.ts` são separados da rota de servidor e não carregam pesos no build do Next.js.

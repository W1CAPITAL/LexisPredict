# LexisPredict — IA local em primeiro lugar (22/10/2026)

## Política
- Padrão: Qwen3 0.6B em Web Worker no navegador (ONNX/Transformers.js).
- Alternativa: Gemma 3 270M no navegador.
- Alternativa: LFM2.5 350M via Ollama local, `LiquidAI/lfm2.5-350m`.
- Agentes, skills, recuperação de evidências e regras jurídicas existentes continuam operando como funções do aplicativo. A LLM é somente um componente de geração; nunca equivale ao conjunto de especialistas nem substitui validação humana.
- Cascata de APIs terceirizadas **bloqueada por padrão**, mesmo com API keys antigas presentes. Habilitar conscientemente no servidor com `LEXIS_EXTERNAL_AI_ENABLED=1`.
- Consultas a DataJud, DJEN, Supabase e outras APIs **de dados** são independentes de APIs de **inferência de IA**.
- `COLIBRI_BASE_URL` e `MINICPM_BASE_URL` podem conectar motor próprio de inferência em servidor. Os pesos não rodam em funções serverless da Vercel.

## Como usar
1. Abra Assistente LexisPredict: novo padrão `local_llm`, com Qwen3 0.6B.
2. No primeiro uso, permita baixar os pesos e o runtime público de inferência; após cache adequado, texto é processado no dispositivo, sem envio do prompt a provedores de IA.
3. Selecione Gemma no menu se quiser um modelo menor.
4. Para LFM, instale Ollama no computador e `ollama pull LiquidAI/lfm2.5-350m`. O navegador precisa de CORS específico para a origem do site (configuração OLLAMA_ORIGINS; não permitir `*` em produção).
5. Se precisar atender usuários sem GPU/memória ou executar trabalhos em lote, hospede um servidor de inferência próprio, proteja-o com TLS, autenticação e rate limits.

## Avisos
- A escolha do modelo no navegador não substitui automaticamente *todas* as rotas server-side de investigação, visão e geração de documentos; validar cada superfície antes de promover a branch.
- Modo local não significa desconexão total da internet: o carregamento inicial usa Hugging Face/CDN e consultas a tribunais usam seus próprios endpoints.
- Os modelos de texto pequenos não devem tomar decisões jurídicas, concluir processos ou enviar WhatsApp sem fluxos determinísticos, prova da movimentação e autorização.
- Não publicar pesos no GitHub. Conferir licenças dos modelos e dos conversores antes de redistribuir.
- Antes de mesclar: npm run typecheck, npm test, npm run build, smoke no Chrome WebGPU/WASM e Ollama opcional.

# Pipeline de Reels — W1 Capital / LexisPredict

**Implementação em 07/11/2026.** O Open-Higgsfield permanece o gerador multiprovedor de clipes via API do AI Lab; o novo [W1 Reel Studio](https://github.com/W1CAPITAL/SITE/tree/main/scripts/reel-studio) é o editor final de MP4, com cortes reais, áudio de voz e trilha licenciada. O código foi isolado do bundle da Vercel: FFmpeg, modelos de vídeo e VoiceStudio não devem carregar no servidor Next.js.

## Ferramentas realmente analisadas

- https://github.com/TechBeme/open-higgsfield — MIT; instância privada, provedor conectado e orçamento definido; integrado no AI Lab como gerador opcional de cenas.
- https://github.com/sirioberati/Genjustsu-Open-Source-Workflow — MIT; Replicate para depth/SAM e Enhancor/Seedance para vídeo, com máscara revisada por toda a cena.
- https://github.com/abdullayevziyodulla/open-genjutsu — MIT; alternativas Oxen, Replicate, Lec e Wan; preserve o original e a validação completa dos frames.
- https://github.com/Anil-matcha/open-genjutsu — MIT; motion reference via MuAPI com Seedance ou Wan, exportando o vídeo resultante.
- https://github.com/debpalash/VoiceStudio — AGPL-3.0; use exclusivamente como serviço **independente** por API de voz local, não copie o código ao Lexis. Instale uma engine pt-BR e ouça o resultado.

## Procedimento de execução

1. Criar uma pasta de mídia local e gravar as telas reais do LexisPredict/sites W1 com dados sensíveis anonimizados.
2. Se o roteiro precisa de personagem em movimento, rodar um dos Genjutsu em serviço local e aprovado. Conferir a máscara e o resultado **no clipe inteiro**; não usar aproximações com contato visual não conferido. Exportar o MP4.
3. Usar Open-Higgsfield para trechos ilustrativos criativos, jamais para fingir que uma interface de cliente é real.
4. Sintetizar pelo VoiceStudio conectado em localhost (ou gravar voz real), escutar o WAV sem música e reprovar se robótico, abafado ou desanimado. Não forçar velocidade ou empilhar memes.
5. Preparar o manifesto do W1 Reel Studio, com gancho <=2 s, cenas reais, marcação de licenças e origem, CTA e timings de legendas. Para qualquer clipe Genjutsu, marcar aprovação de vídeo inteiro e autoria/consentimento.
6. Rodar editor em ambiente com FFmpeg/libass/H.264, conferir render MP4 vertical, legendas em português, loudness e áudio em celular/fones, pedir revisão humana antes da publicação.
7. Somente após aprovar produção real, agendar/publicar no Instagram conectado; nunca assumir métricas, viralização ou vendas garantidas.

## Restrições inegociáveis

- Todos os provedores generativos, motores de voz e instalações podem precisar de créditos, GPU, chave privada, conta ou downloads adicionais. Repositório GitHub, sozinho, não ativa um modelo.
- A integração do Open-Higgsfield é restrita a superadministrador, protegida por Cloudflare Access, e fica desligada por padrão até autenticação/provedor/armazenamento serem validados.
- Open Genjutsu é local e não possui autenticação para hospedagem pública; não criar rotas de proxy públicas sem isolamento.
- A licença de software não dá direitos de usar imagem, voz ou trilhas de qualquer pessoa. Não treinar/clonar a voz de terceiros sem permissão.
- Os repositórios externos são **fontes técnicas consultadas**, não cópias vendidas como W1. A implantação inclui código autoral de integração e referências, não os modelos e dependências de terceiros.
- O editor é testado com vídeos sintéticos para confirmar montagem técnica; **isso não confirma um Reel publicitário final**, nem que exista TTS brasileiro de qualidade ativo.

A documentação do SITE e o guia de implantação do Open-Higgsfield no Lexis são as fontes de operação. Para uso diretamente nesta conversa, um executor e credenciais devem estar conectados ao ChatGPT; commits não criam ferramentas utilizáveis pelo assistente automaticamente.

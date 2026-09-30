# Media Gen — LexisPredict v4

Modulo de imagem, video e demos. Prioridade: local/self-host, workflows reproduziveis e zero dependencia pesada no Vercel.

## Roteamento

| Pedido | Caminho |
|---|---|
| slideshow/demo de telas | browser capture + ffmpeg |
| text-to-image | ComfyUI image workflow |
| image edit / inpaint | ComfyUI workflow dedicado |
| text/image-to-video | ComfyUI video workflow |
| upscale | Upscayl/worker opcional |
| anime/estilizacao | workflow ComfyUI ou lab AnimeGAN |
| demo comercial | captura real + ffmpeg; generativo apenas como B-roll |

## ComfyUI

Configurar:
- `COMFYUI_BASE_URL`
- `COMFYUI_TOKEN` opcional
- `COMFYUI_IMAGE_WORKFLOW_JSON`
- `COMFYUI_VIDEO_WORKFLOW_JSON`

Os workflows devem estar no formato API do ComfyUI.

Placeholders:
- `{{PROMPT}}`
- `{{NEGATIVE_PROMPT}}`
- `{{WIDTH}}`
- `{{HEIGHT}}`
- `{{SEED}}`
- `{{FRAMES}}`

A fila e o status ficam em `/ai-lab`.

## Hierarquia

```
1. ffmpeg / captura real               -> deterministico
2. ComfyUI local/self-host              -> imagem/video/edicao
3. Upscayl e workers especializados     -> pos-processamento
4. providers externos configurados      -> fallback explicito
```

Modelos e checkpoints nao entram no GitHub nem no bundle do app.

## Fluxo imagem

1. Definir objetivo e proporcao.
2. Se existir referencia visual autorizada, preservar identidade/estrutura.
3. Escolher workflow.
4. Gerar com seed registrada.
5. Verificar prompt, texto, anatomia/layout e artefatos.
6. Upscale somente depois de aprovar conteudo.

## Fluxo video

1. Roteiro e duracao.
2. Separar cenas.
3. Preferir captura real para features do produto.
4. ComfyUI para B-roll, transicoes ou cena generativa.
5. Montar/legendar com ffmpeg/editor.
6. Conferir frames, texto e consistencia antes de publicar.

## Seguranca e privacidade

- nao enviar dados juridicos sensiveis para providers externos sem autorizacao;
- mascarar PII em demos;
- nunca expor token do ComfyUI no browser;
- custom workflow via API e restrito a superadmin;
- saida generativa nao vira evidencia juridica.

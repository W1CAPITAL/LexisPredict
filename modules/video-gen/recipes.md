# Receitas Media — LexisPredict v4

## A. Demo real de produto

1. Capturar Painel → Processo → Tarefa → Supervisao.
2. Cortar partes mortas.
3. Texto curto em tela.
4. ffmpeg para 9:16 e 16:9.
5. ComfyUI somente para B-roll/transicao, nao para falsificar telas do produto.

## B. Text-to-image via ComfyUI

Workflow API deve conter placeholders.

Exemplo conceitual:
```json
{
  "6": { "inputs": { "text": "{{PROMPT}}" }, "class_type": "CLIPTextEncode" },
  "7": { "inputs": { "text": "{{NEGATIVE_PROMPT}}" }, "class_type": "CLIPTextEncode" },
  "3": { "inputs": { "seed": "{{SEED}}" }, "class_type": "KSampler" }
}
```

O workflow real depende dos nodes/modelos instalados no servidor.

## C. Text/Image-to-video via ComfyUI

Usar workflow com `{{FRAMES}}`, `{{WIDTH}}`, `{{HEIGHT}}` e seed. A fila retorna `promptId`; consultar historico no AI Lab.

## D. Upscale

Gerar primeiro em resolucao razoavel; depois enviar a worker Upscayl/SUPIR/SeedVR quando configurado. Nao desperdic ar VRAM fazendo varias geracoes gigantes antes de aprovar composicao.

## E. Reel

- 12–25 s
- 3–6 cenas
- texto grande
- prova real do produto
- CTA no final
- remover qualquer PII de prints

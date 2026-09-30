# Install Lexis Unified Skill

1. Extrair este zip em:
   - Claude/Cursor skills: `~/.claude/skills/lexis-unified/` ou pasta de skills do projeto
   - Grok/segundo-cerebro: `/home/workdir/.grok/skills/lexis-unified/`

2. Garantir scripts executaveis:
   ```bash
   chmod +x scripts/*.sh scripts/*.py 2>/dev/null
   ```

3. Vault (opcional):
   ```bash
   export LEXIS_VAULT="$HOME/lexis-vault"
   mkdir -p "$LEXIS_VAULT"/{inbox,notes,decisions,projects,runs,people,prompts}
   ```

4. No agente, invocar pela description do SKILL.md (`lexis-unified`).

Skills antigas (autoimprove, gtm, ecosystem, self-improve, segundo-cerebro isoladas) podem ser removidas para evitar conflito — o unificado ja as incorpora como modulos.

## Video-gen (v2.1)

Novo modulo `modules/video-gen/`:
- Image-to-video a partir de prints do Lexis
- Demos de app / repo / site
- Receitas prontas (Reels, grafo, screen recording)
- Ferramentas: Agnes Video Generator (gratuito), ffmpeg, Invideo AI Nexus

Ver `modules/video-gen/SKILL.md` e `recipes.md`.

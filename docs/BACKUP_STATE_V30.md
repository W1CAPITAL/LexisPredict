# MANIFESTO DE BACKUP - LEXISPREDICT v30.0 ELITE
## ESTADO DO SISTEMA: HANDCRAFTED CORPORATE EDITION

Este documento serve como ponto de restauração oficial para o sistema LexisPredict da W1 Capital, sob a gestão de Davi Alves Figueredo.

### 1. CONFIGURAÇÕES DE SEGURANÇA (MASTER)
- **Senha Mestre:** `Ashley@25472053`
- **Mecanismo de Trava:** Double-Lock (Nível 1: Admin Portal / Nível 2: System Code).
- **Sessão:** Persistência em LocalStorage via `lexisPredict_admin_session`.

### 2. NÚCLEO TÉCNICO (IA & DATAJUD)
- **Motores Ativos:** Gemini 1.5 Flash, Grok (Llama 3.3), Claude 3.5 Sonnet.
- **Normalização de Schema:** Função `normalizarResultado` blindada contra falhas de chaves JSON (ex: analise_interna -> resumoTecnico).
- **Integração DataJud:** API Key `cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==` configurada e funcional.
- **Histórico:** Exibição de 5 últimos movimentos reais com timestamp oficial.

### 3. IDENTIDADE VISUAL (SaaS PREMIUM)
- **CSS:** Tailwind com cores sólidas (`bg-card`, `bg-sidebar`).
- **Tema:** Remoção de Glassmorphism/Glows em favor de solidez corporativa.
- **Copyright:** "2026 W1 Capital. Todos os direitos reservados."
- **Assinatura:** "Relatório Consolidado • FUNDADOR DAVI ALVES FIGUEREDO"

### 4. COMPONENTES CRÍTICOS
- **Notes & Updates:** Motor de visualização cristal com upscaler via filtros de GPU.
- **Unified Master Report:** Exportação PDF multimídia (Texto + Imagens de evidência).
- **Urgency Engine:** Algoritmo de priorização baseado em distância matemática de prazos.

### 5. ARQUIVOS PROTEGIDOS NO SNAPSHOT
- `src/app/settings/page.tsx` (Logic & Portal)
- `src/ai/flows/veredito-ai-flow.ts` (Intelligence)
- `src/lib/datajud.ts` (Connection)
- `src/app/report/page.tsx` (Audit PDF)

---
**ASSINATURA DE INTEGRIDADE:**
*Auditado e Selado por Davi Alves Figueredo em 2026.*

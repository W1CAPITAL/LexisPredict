# Open-Higgsfield — integração protegida W1 / LexisPredict

**Estado:** código integrado na branch de revisão; geração real **não está ativa** até uma instância Open-Higgsfield independente, protegida e com provedor habilitado ser implantada. Não declarar vídeo gerado apenas porque a interface existe.

## Origem e licença
- Projeto upstream: https://github.com/TechBeme/open-higgsfield (MIT, Copyright 2026 TechBe).
- Usa **as APIs públicas oficiais** do projeto, sem copiar o aplicativo inteiro, mexer no seu código nem incorporar seus modelos pesados ao LexisPredict.
- Endpoint interno: `/api/media/open-higgsfield`, somente superadministrador autenticado em Supabase.
- Interface: `/ai-lab/higgsfield`, com acesso via `/ai-lab`.
- Contratos: `GET /api/ready`, `GET /api/models`, `POST /api/generate` (FormData), `GET /api/tasks/:id` e download em `/api/download/:id`.
- A rota de geração só aceita requisições com Origin exata do aplicativo, sem origem cross-site, e não faz retry (evita cobranças duplicadas).
- A API do W1 nunca aceita URL de provedor vinda do browser. Links/credenciais são exclusivamente de variáveis de ambiente no servidor.

## Segurança obrigatória
O Open-Higgsfield upstream não tem login. **Nunca publique uma instância funcional aberta na Internet**: qualquer visitante poderia ver histórico/configuração e disparar gerações pagas. Coloque o Open-Higgsfield em um hostname HTTPS protegido por **Cloudflare Access**, habilite service tokens para tráfego de LexisPredict e mantenha uma política de usuários autorizados para o painel web.

Armazene no servidor LexisPredict (Vercel, Render, conforme o deploy escolhido):

```dotenv
OPEN_HIGGSFIELD_BASE_URL=https://studio.suaempresa.com.br
OPEN_HIGGSFIELD_ACCESS_CLIENT_ID=<segredo-no-servidor>
OPEN_HIGGSFIELD_ACCESS_CLIENT_SECRET=<segredo-no-servidor>
OPEN_HIGGSFIELD_GENERATION_ENABLED=false
```

Configure no Open-Higgsfield: `APP_ORIGIN` exatamente igual ao URL, `GENERATION_ENABLED=false` enquanto valida, `PROVIDER_CONFIG_ENCRYPTION_KEY` forte, perfil durável de armazenamento/worker adequado ao host. Na Vercel, o upstream exige PostgreSQL, storage durável e Workflow configurado; não apenas um deploy estático. Siga `docs/production.md` do upstream e seus scripts de migração. Conecte pelo menos um provedor com cota e orçamento definidos. Provider API keys permanecem **somente** no ambiente da instância Open-Higgsfield, nunca no Lexis e nunca no GitHub.

Depois de testar autenticação, persistência, `GET /api/ready`, modelo conectado, créditos/cotas e download, altere `GENERATION_ENABLED=true` no upstream e `OPEN_HIGGSFIELD_GENERATION_ENABLED=true` no LexisPredict. O sinalizador do Lexis é um **bloqueio de envio**, não um limite de cobrança. Desative-o imediatamente para suspender novos pedidos.

## Uso
1. Entre como superadministrador no LexisPredict e abra AI Lab → Open-Higgsfield.
2. O cartão mostra disponibilidade real e lista apenas modelos de vídeo conectados ao upstream.
3. Escreva o prompt, escolha formato/duração permitidos e pressione Gerar vídeo (pode ter custo).
4. Consulte o status pela tarefa. Em caso de resultado incerto, verifique o histórico do upstream antes de tentar novamente.
5. Baixe o arquivo apenas após confirmação. Faça montagem, voz, mixagem e revisão no pipeline editorial externo.

**Limites atuais:** integração de texto-para-vídeo, não substitui captura real de projetos, não fornece voz brasileira automaticamente, não instala o upstream no Lexis e não concede automaticamente ferramentas de acesso ao ChatGPT. Falta ativar um worker/serviço externo acessível ao processo que for executar geração.

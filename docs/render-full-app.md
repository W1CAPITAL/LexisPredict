# LexisPredict completo sem o limite de funções do Hobby Vercel

## Diagnóstico verificado em 10/11/2026

O deploy de produção `4a7514a57babc009f186eeefec69603f93027eba` compilou o Next.js, mas foi recusado na fase de publicação com `exceeded_serverless_functions_per_deployment`. O Vercel Hobby usado pela empresa permite 12 funções por deploy; este repositório possui dezenas de rotas de API e páginas processadas no servidor. As duas contas conectadas à Vercel estavam no plano Hobby.

Não reduzir o número de funções removendo integrações, autenticação, cron, PDFs, DJEN/DataJud ou controles de tenant. Alterar `vercel.json`, fazer `--force` ou limpar cache não resolve a limitação do plano.

## Alternativa gratuita preparada (prévia, não produção crítica)

Existe uma **segunda** definição de implantação em `deploy/render-full-app.yaml`, separada do `render.yaml` da ponte WA.Auto. A nova configuração executa todo o Next.js como **um único servidor Node.js**, de modo que o limite de 12 funções individuais da Vercel deixa de se aplicar.

Passos para habilitar a prévia após conferir a conta/workspace Render correto:

1. Em Render, acessar **New → Blueprint**, vincular `W1CAPITAL/LexisPredict` e definir **Blueprint Path** = `deploy/render-full-app.yaml`.
2. Revisar os detalhes do serviço `lexispredict-full-app`, plano **Free**, sem deploy automático.
3. Fornecer as variáveis exigidas **diretamente no Render**, sem compartilhá-las no GitHub ou nos chats: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `WA_DAILY_CRON_SECRET`. Outras chaves de IA e integrações que estiverem em uso devem ser configuradas no serviço para as respectivas funções.
4. Criar o serviço e executar um deploy manual, conferindo o log e abrindo `https://<host-render>/api/health`. O retorno `ok: true` e `supabaseEnv: true` confirma que a aplicação iniciou e possui as variáveis básicas, **não** comprova login, funcionamento do DJEN, nem todos os fluxos.
5. Validar login, autorização de empresa, OAB, consultas DJEN/DataJud, relatórios/PDF, Hermes e WhatsApp com usuários de teste antes de anunciar o novo domínio. Configurar URLs de redirecionamento autorizadas no Supabase Auth, se usadas, e CSP quando necessário.
6. **Somente após os testes**, alterar os destinos do `pg_cron`/Supabase, inclusive `lexis-hermes-due-returns` e `lexis-hermes-company-meeting`, e o `LEXIS_URL` do serviço WA.Auto, do domínio Vercel antigo para o endereço estável escolhido. Não migrar crons para um serviço que ainda não responde.
7. Não desligar o domínio atual até que os testes e a mudança de DNS sejam confirmados.

### Limitações do Render Free

- O Render Free possui **0,1 CPU e 512 MB RAM**. O Next.js completo e o carregamento de PDF/IA podem ultrapassar esse limite: é necessário confirmar consumo real e tempo de resposta.
- Após **15 minutos sem tráfego**, a instância pode hibernar; o primeiro acesso após hibernação pode levar cerca de um minuto. Não é adequado para os agendamentos com baixa latência do Hermes e retornos judiciais.
- O filesystem é temporário: manter dados e relatórios persistentes no Supabase ou armazenamento externo, jamais em arquivos locais.
- O próprio Render recomenda instâncias gratuitas para testes e prévias, **não produção**. Não existe garantia de operação ininterrupta, mesmo com as tarefas `pg_cron` agendadas fora do navegador.
- O plano gratuito pode ainda limitar horas, banda e minutos de build. Não tentar contornar as regras de plano com múltiplas contas ou requisições artificiais de keep-alive.

### Estratégia para produção de verdade

Se os 512 MB/0,1 CPU não comportarem o aplicativo ou for preciso disponibilidade contínua, usar um servidor/serviço Node.js com recursos e uptime compatíveis. O objetivo é manter **uma instância de Next.js completa** em vez de apagar APIs para atingir 12 funções. Alternativamente, migrar para Vercel Pro envolve custo e não deve ocorrer sem aprovação.

A última implantação Vercel estável permanece válida até migração. Este blueprint não altera automaticamente `render.yaml`, Supabase, DNS nem as chaves da operação.

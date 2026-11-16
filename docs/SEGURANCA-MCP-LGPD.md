# Segurança MCP / LGPD — LexisPredict + INFINITUM

**Escopo:** LexisPredict é um produto jurídico proprietário e não deve confiar em instruções de um modelo de IA para impor autorização. A conexão externa Killa AI/INFINITUM utiliza OAuth 2.1, conta pessoal, MFA/AAL2, autorização expressa de aplicativo e vínculo validado a empresa + processo.

## Credenciais e visibilidade no navegador

- Chave \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` ou publishable é intencionalmente pública; **não** é uma credencial privilegiada. Exigir RLS, políticas por empresa e autenticação.
- Chaves \`service_role\`, \`sb_secret_\`, tokens de serviço, senhas, JWT secrets e chaves privadas **nunca** entram em \`NEXT_PUBLIC_\`, bundles, HTML ou prompts; devem permanecer no backend e ser rotacionadas se houver vazamento.
- Mesmo com RLS, uma chave administrativa com \`bypassrls\` pode ler ou escrever dados e modificar políticas. Não é tecnicamente possível impedir um controlador com privilégios completos no próprio banco.
- O Supabase Auth emite tokens por usuário/aplicativo; um texto em uma conversa não concede permissões nem autoriza troca de empresa.

## Limites para apps MCP e LLMs

O MCP remoto do INFINITUM está em \`https://agentinfinitum.vercel.app/mcp\`. A publicação e a ativação OAuth no projeto específico devem ser confirmadas independentemente. Cada usuário deve autenticar individualmente, não compartilhar tokens e receber apenas os dados autorizados da própria empresa. Sem vínculo legítimo entre conversa WhatsApp e processo, pesquisa e envio ficam bloqueados.

A migração \`20261116160000_killa_oauth_readonly_guard.sql\` aplica **RLS RESTRICTIVE** para negar INSERT/UPDATE/DELETE de tokens com \`auth.jwt()->>'client_id'\` em todas as tabelas públicas com RLS, mesmo quando alguém altera o código frontend ou tenta chamar a Data API diretamente. Adicionalmente, três RPCs privilegiadas e relacionadas ao atendimento (\`reserve_office_agent_reply\`, \`finalize_office_agent_reply\`, \`register_office_agent_return\`) recusam OAuth com \`client_id\`; anon deixa de ter EXECUTE nas duas RPCs que ainda expunham o grant.

Tokens de funcionário que não sejam OAuth continuam sujeitos às permissões usuais de empresa, cargo e RLS. Outras funções SECURITY DEFINER devem ser reavaliadas em cada mudança, pois podem ultrapassar RLS por desenho. Em tabelas futuras, migrações devem aplicar políticas de proteção equivalentes antes de expor qualquer dado.

## QR e registro dos atendimentos

O pareamento é individual e exibido somente na página autenticada \`https://agentinfinitum.vercel.app/mcp/pair\`; a IA obtém um link e o estado, não o QR, código de pareamento, credenciais ou sessões. Nunca publique QR em logs ou arquivos CSV.

O KPI “atendido pelo OpenBot” deve se basear em \`office_agent_reply_events\` aceitos pelo WA.Auto, com identificador do provedor e operador autenticado; não contar rascunhos, respostas imaginadas nem pesquisas. Envio aceito não prova leitura/entrega. No INFINITUM nativo a tabela de confirmações pode não existir; nesse caso o indicador informa indisponibilidade em vez de inventar dados.

## LGPD, engenharia reversa e IA

Aplicar Lei 13.709/2018 (LGPD): base e finalidade, mínimo necessário, segregação, controle de retenção, resposta a incidentes, auditoria e consentimento/contrato quando exigido. Dados processuais podem envolver informações financeiras, de saúde e de menores; tratamentos por fornecedores de IA requerem avaliação e contratos apropriados.

Foram revisadas as ideias de \`morluto/rea\`, \`qybaihe/bla\`, \`Afloat16/anti-rea-forge\`, \`MockirDev/antirea\`, \`zhcalvin/DeRea\` e \`goul4rt/lgpd-skills\`. Ferramentas de análise auxiliam threat modeling; “stop prompts”, injeções de prompt que tentam enganar uma LLM e ofuscação não garantem prevenção de engenharia reversa. É mais eficaz não enviar segredo/código privilegiado ao navegador, limitar acesso via RLS/backend e auditar dependências.

## Licenciamento

**LexisPredict permanece proprietário**, conforme [LICENSE](../LICENSE) e [LICENSE.md](../LICENSE.md). Este documento de engenharia não modifica a licença. Integração com código MIT do INFINITUM não concede direitos de cópia do LexisPredict nem compartilha sua base de clientes ou segredos. Respeitar exceções obrigatórias da legislação aplicável.

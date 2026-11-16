# Segurança, acesso e comunicação responsável — LexisPredict

© 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.

**Relato privado:** utilize o canal de segurança privado do repositório (quando disponível) ou canal oficial privado W1 Capital. Nunca publique dados reais de clientes, números de processos, senhas, MFA, tokens JWT, QR de WhatsApp, chaves privilegiadas ou instruções de exploração em issues.

O middleware e as rotas protegidas verificam autenticação Supabase, perfil, empresa, cargo e pacote. RLS por empresa e usuário deve estar ativo no PostgreSQL. O MCP externo **não pode** inferir o processo pelo telefone apenas ou misturar carteiras de empresas. Tokens OAuth com \`client_id\` não devem escrever via Data API nem via RPC privilegiada de atendimento. Ver [regras detalhadas MCP/LGPD](docs/SEGURANCA-MCP-LGPD.md).

A chave pública do Supabase é visível no navegador por definição. **Nunca** publicar uma chave \`service_role\` ou \`sb_secret_\`, JWT signing secret, senha, token WA.Auto ou credencial privada. Revogue/rotacione imediatamente uma chave privilegiada exposta.

A LGPD (Lei 13.709/2018) exige minimização, finalidade e controle de acesso, gestão de retenção e incidentes. O código rodando no navegador é inspecionável; não existe proteção absoluta contra engenharia reversa, sobretudo para repositórios públicos ou alguém com privilégios administrativos no banco.

É proibido enviar backlogs, logs internos, prompts, chaves e informações de outros clientes por WhatsApp ou MCP. Somente respostas validadas e envios aceitos pelo provedor podem ser registrados como atendimentos.

**Licença:** produto proprietário, nos termos de [LICENSE](LICENSE) e [LICENSE.md](LICENSE.md), respeitadas as limitações impostas pela legislação aplicável.

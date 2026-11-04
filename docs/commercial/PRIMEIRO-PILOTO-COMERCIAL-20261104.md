# LexisPredict — primeiro piloto comercial seguro

**Atualizado: 04/11/2026.** Ainda não aprovado para assinaturas automáticas. O banco principal contém dados jurídicos reais: nunca usá-lo como ambiente de testes de novos escritórios.

## O que foi constatado

A interface de cadastro, ações de provisionamento e planos existem no código. O Supabase real contém campos de cobrança e planos, porém **não contém** as tabelas comerciais:
- public.assinaturas
- public.solicitacoes_assinatura
- public.commercial_audit_log
- public.commercial_signup_attempts

O GitHub já possui migrations comerciais de 21/09/2026, incluindo:
- supabase/migrations/20260921_commercial_billing_and_minimum_rls.sql
- supabase/migrations/20260921_commercial_self_service_and_first_run.sql
- supabase/migrations/20260921_commercial_signup_rate_limit_store.sql
- supabase/migrations/20260921_commercial_hardening_roles_billing_owner.sql

**Não aplicar indiscriminadamente essas migrations antigas à produção.** Algumas alteram planos, perfis, políticas de processos e roles que podem ter evoluído desde então. Comparar o schema atual, preparar um patch mínimo revisado e testá-lo em banco isolado.

O cheque anterior de ambiente somente conferia variáveis de conexão, não provava que o banco e as assinaturas funcionavam. A mensagem foi ajustada.

## Proteções desta etapa

1. Novos cadastros públicos ficam **desativados por padrão**: a variável de servidor LEXIS_COMMERCIAL_SIGNUP_ENABLED só aceita a string exata "true". Deixá-la ausente ou false em produção até completar a validação.
2. O cadastro não recupera contas órfãs alterando a senha de um e-mail fornecido no formulário. Duplicidade exige login ou recuperação oficial de titularidade.
3. A criação de novo usuário não define email_confirm=true automaticamente. Ainda será necessário implementar/verificar o fluxo de confirmação de e-mail ou convite seguro.
4. Limites de tentativas falham **fechados** se consultas ou registros no banco falharem.
5. Antes de criar um usuário de Auth, o servidor consulta existência de tabelas e colunas comerciais por HEAD com LIMIT 0, sem obter qualquer registro do cliente.
6. A interface avisa que implantação é assistida, não cobrança automática.
7. Há testes para o guardião, as sondagens, as falhas e a ausência da recuperação insegura.

**A variável ativada sozinha não aprova comercialização.** Ela não valida e-mail, cobrança, isolamento, restauração ou titularidade.

## Ensaio obrigatório sem dados reais

### 1. Infraestrutura isolada

Criar Supabase de staging e implantação preview, observando cotas e custos antes de provisionar. Nunca copiar processos, contratos, WhatsApp, documentos, dados de clientes ou arquivos jurídicos da produção. Usar exclusivamente registros inventados.

### 2. Duas organizações fictícias

Depois de implementar um fluxo de convite/OTP ou confirmação de e-mail revisado, criar duas organizações sintéticas, Alfa e Beta, cada qual com seu usuário e carteira fictícia. Verificar:

- Alfa não consegue ler, listar, pesquisar, atualizar nem exportar processos, contatos, documentos, tarefas e cobranças de Beta.
- Operador não consegue executar ações Superadmin nem falsificar empresa_id, usuário ou plano por API direta.
- Trocar o ID de uma URL, Server Action, RPC ou payload deve negar acesso a recursos alheios.
- Um usuário revogado perde acesso sem esperar indefinidamente pela expiração de token.
- Uma conta com status pending não libera serviços pagos; ativação exige autorização registrada.
- Importação, XLSX/CSV e relatórios PDF respeitam as políticas e o escopo do escritório.

### 3. Segurança

No Supabase Security Advisor foram identificados avisos sobre funções SECURITY DEFINER acessíveis a anon e authenticated. Revisar código, signatures, triggers, grants e chamadas da aplicação **antes** de qualquer REVOKE em produção. As funções podem ser necessárias a workflows jurídicos existentes. Ativar controles adequados de senhas e avaliar autenticação forte. Referência: https://supabase.com/docs/guides/database/database-linter.

### 4. Processo de venda assistida

Confirmar CNPJ/entidade emissora da W1, contrato, LGPD, operação de cobrança, cancelamento, portabilidade, retenção, suporte e backup testado. Estado billing_status=active **não é recibo de pagamento**.

Somente após aprovação técnica, demonstrar um escritório sintético e oferecer a um interessado uma implantação do Essencial. Referência existente no software: R$ 197/mês; sugestão ainda não aprovada de implantação: R$ 490.

## Consulta segura e somente leitura

O seguinte SQL confirma somente a existência de objetos, sem consultar dados pessoais:

    select
      to_regclass('public.assinaturas') is not null as assinaturas,
      to_regclass('public.solicitacoes_assinatura') is not null as solicitacoes,
      to_regclass('public.commercial_audit_log') is not null as auditoria_comercial,
      to_regclass('public.commercial_signup_attempts') is not null as rate_limit_store;

Mesmo retornando true para todos os objetos, **isso não substitui** os testes negativos de isolamento, autenticação, cobrança e restauração.

## Próximo marco verificável

Um teste repetível em staging com duas organizações, permissões revisadas, fluxo de confirmação do usuário e um orçamento aprovado. Até lá, **venda consultiva e demonstrações conceituais, sem criar usuário ou cobrar assinatura automática**.

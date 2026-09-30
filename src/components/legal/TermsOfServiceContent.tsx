import React from "react";

export function TermsOfServiceContent() {
  return (
    <div className="max-h-[65vh] space-y-6 overflow-auto pr-4 text-sm leading-relaxed text-foreground/80">
      <div>
        <h2 className="text-lg font-black tracking-tight text-foreground">
          Termos de Uso, Licença, Privacidade e Consentimento
        </h2>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          LexisPredict Commercial · última atualização: 21 de setembro de 2026
        </p>
      </div>

      <section className="rounded-2xl border bg-muted/20 p-4">
        <p><strong>Licenciante:</strong> LexisPredict, titularidade de Davi Alves Figueredo e operação comercial associada à W1 Capital quando aplicável.</p>
        <p className="mt-2"><strong>Licenciado:</strong> pessoa física ou jurídica que cria conta, contrata ou utiliza a plataforma.</p>
        <p className="mt-2"><strong>Contato comercial para ativação de plano:</strong> WhatsApp (13) 99119-9349.</p>
      </section>

      <p className="rounded-xl border-l-4 border-primary bg-primary/5 p-4 font-semibold">
        Ao marcar o aceite, criar uma conta ou usar o serviço, você declara que leu e concorda com estes Termos e com o tratamento de dados necessário para executar o serviço contratado.
      </p>

      <div className="space-y-5">
        <p><strong>1. Objeto e natureza do serviço</strong><br />
        O LexisPredict é uma plataforma SaaS de apoio operacional jurídico, gestão de carteira, tarefas, documentos, automações, CRM, relatórios e integrações. O sistema não presta advocacia, não substitui revisão profissional e não garante resultado judicial.</p>

        <p><strong>2. Planos, contratação e ativação</strong><br />
        A seleção de um plano no cadastro representa solicitação comercial. A liberação efetiva depende de confirmação e ativação. O usuário pode entrar em contato pelo WhatsApp (13) 99119-9349 após escolher o plano. Preços, módulos e limites exibidos no aplicativo podem ser atualizados para novas contratações; condições já contratadas seguem o instrumento aplicável.</p>

        <p><strong>3. Conta, empresa e permissões</strong><br />
        Cada empresa utiliza um tenant próprio. O administrador é responsável por convidar usuários adequados, proteger credenciais e revisar permissões. O compartilhamento indevido de credenciais pode gerar suspensão preventiva.</p>

        <p><strong>4. Modo convidado</strong><br />
        O modo convidado existe apenas para demonstração. Ele não cria conta, empresa ou assinatura no Supabase. Informações inseridas durante a demonstração devem permanecer apenas no cache/local storage do navegador e podem ser apagadas a qualquer momento, inclusive ao limpar dados do navegador ou sair do modo convidado. O modo convidado não deve ser usado como repositório permanente nem para dados sensíveis reais.</p>

        <p><strong>5. Dados, LGPD e consentimento</strong><br />
        O usuário/empresa é responsável pela base legal dos dados que inserir. O LexisPredict trata dados apenas para autenticação, hospedagem, execução dos módulos contratados, segurança, suporte e auditoria operacional. Dados de terceiros não devem ser usados para finalidade incompatível com a LGPD. O usuário pode solicitar informações sobre seus dados e exercer direitos previstos em lei pelos canais de contato disponibilizados pelo serviço.</p>

        <p><strong>6. Dados judiciais públicos</strong><br />
        Dados do CNJ, DataJud, DJEN e tribunais podem ser usados para acompanhamento de carteira e apoio operacional quando houver finalidade legítima. Publicidade processual não autoriza prospecção abusiva, venda de bases pessoais, tratamento de processos em segredo de justiça ou contorno de CAPTCHA e controles de acesso.</p>

        <p><strong>7. Prazos e conferência profissional</strong><br />
        Alertas, classificações, IA, filas e datas são recursos auxiliares. A conferência de prazos, decisões, intimações e movimentações em fonte oficial permanece responsabilidade do profissional responsável. Nenhuma automação deve ser usada como única fonte para ato processual crítico.</p>

        <p><strong>8. Inteligência artificial</strong><br />
        Resumos, classificações, previsões, minutas e respostas geradas por IA podem conter erro, omissão ou interpretação incompleta. Todo conteúdo jurídico gerado deve ser revisado antes de uso externo ou protocolo.</p>

        <p><strong>9. Propriedade intelectual</strong><br />
        A licença é limitada, não exclusiva, intransferível e válida enquanto houver autorização de uso. É vedado copiar o produto para criar solução concorrente, remover avisos de autoria, sublicenciar, revender código ou realizar engenharia reversa além do que a lei expressamente permitir.</p>

        <p><strong>10. Disponibilidade, integrações e terceiros</strong><br />
        Serviços de terceiros, tribunais, DataJud, DJEN, provedores de IA, Vercel e Supabase podem apresentar indisponibilidade, limites ou alterações. Salvo contrato específico, não há garantia de disponibilidade contínua ou SLA específico.</p>

        <p><strong>11. Assinatura, suspensão e cancelamento</strong><br />
        A assinatura pode ser suspensa por inadimplência, fraude, abuso, risco de segurança ou violação contratual. Antes de qualquer bloqueio financeiro, o sistema deve se basear em um estado real de empresa/assinatura no servidor; ausência de empresa em instalação nova não equivale a inadimplência. Cancelamentos e alterações de plano seguem o ciclo comercial vigente.</p>

        <p><strong>12. Responsabilidade</strong><br />
        Na máxima extensão permitida em lei, o LexisPredict não responde por danos indiretos decorrentes de uso inadequado, dado inserido incorretamente, indisponibilidade de fonte externa ou decisão tomada sem conferência profissional. Nada neste termo exclui responsabilidade que a lei não permita limitar.</p>

        <p><strong>13. Segurança e retenção</strong><br />
        A plataforma pode registrar eventos técnicos e de auditoria necessários para segurança e operação. O usuário deve manter cópias e políticas internas compatíveis com suas obrigações profissionais e legais.</p>

        <p><strong>14. Aceite eletrônico</strong><br />
        O aceite por checkbox, cadastro, login ou uso continuado constitui manifestação eletrônica de concordância. Quando houver atualização material destes Termos, o aplicativo poderá solicitar novo aceite.</p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs">
        <strong>Consentimentos destacados:</strong> você confirma que possui autorização/base legal para os dados inseridos; entende que recursos de IA e automação exigem revisão humana; e reconhece que o modo convidado é temporário e local, sem persistência contratual.
      </div>

      <p className="border-t pt-5 text-[10px] text-muted-foreground">
        Foro e legislação aplicável: Brasil, observadas LGPD, Marco Civil da Internet, Lei de Software, legislação autoral e normas aplicáveis ao exercício profissional e ao Poder Judiciário.
      </p>
    </div>
  );
}

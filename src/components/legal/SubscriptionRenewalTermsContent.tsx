import Link from "next/link";

export const RENEWAL_TERMS_VERSION = "2026-10-24";

type Props = {
  planName?: string;
  cycle?: "mensal" | "anual";
  displayedAmount?: string;
  expiresLabel?: string | null;
};

export function SubscriptionRenewalTermsContent({
  planName,
  cycle,
  displayedAmount,
  expiresLabel,
}: Props) {
  const details = planName && cycle && displayedAmount;
  return (
    <article className="space-y-5 text-sm leading-relaxed text-slate-700">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.15em] text-violet-600">LexisPredict Commercial · versão {RENEWAL_TERMS_VERSION}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Termo de solicitação de renovação de assinatura</h2>
        <p className="mt-2 text-slate-600">
          Este termo complementa os <Link href="/termos" className="font-semibold text-violet-700 underline underline-offset-2">Termos de Uso do LexisPredict</Link> e deve ser lido antes de solicitar a renovação.
        </p>
      </div>

      {details ? (
        <div className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 sm:grid-cols-2">
          <p><strong>Plano atual:</strong> {planName}</p>
          <p><strong>Ciclo solicitado:</strong> {cycle === "anual" ? "Anual" : "Mensal"}</p>
          <p><strong>Preço público de referência:</strong> {displayedAmount} por {cycle === "anual" ? "ano" : "mês"}</p>
          <p><strong>Validade atualmente cadastrada:</strong> {expiresLabel || "Não informada"}</p>
          <p className="sm:col-span-2 text-xs text-slate-600">O valor efetivo, benefícios e eventuais condições particulares precisam ser apresentados e confirmados antes da cobrança.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <section>
          <h3 className="font-bold text-slate-950">1. Partes e finalidade</h3>
          <p>O pedido é feito pelo representante autorizado da empresa assinante da plataforma LexisPredict. A operação comercial é conduzida pelo responsável indicado na contratação, conforme os Termos de Uso e proposta vigente. Este documento registra uma intenção de renovação, não um pagamento.</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-950">2. Plano, duração e valores</h3>
          <p>A solicitação usa o plano atualmente vinculado à empresa e o ciclo mensal ou anual escolhido. Antes de efetivar a renovação, o comercial deve confirmar o valor total, a periodicidade, a data de início e término do novo período, os módulos incluídos e as formas de pagamento. Preços exibidos no painel são referências públicas e não substituem condições contratuais individualmente negociadas.</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-950">3. Sem renovação ou cobrança automática por este aceite</h3>
          <p>Marcar a caixa de ciência e solicitar a renovação não autoriza débito, não altera a validade da assinatura e não ativa renovação automática. A efetivação depende de confirmação comercial das condições e aprovação do titular/responsável habilitado. Qualquer cobrança recorrente futura exige consentimento próprio e informação prévia adequada.</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-950">4. Continuidade do serviço e acesso aos dados</h3>
          <p>Até a decisão comercial, permanecem as condições e o status de acesso já registrados para a empresa. O simples pedido de renovação não desbloqueia assinatura vencida, não migra dados e não altera permissões. Em caso de encerramento, a disponibilização e exportação de dados seguem o contrato aplicável e a legislação vigente.</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-950">5. Alterações, desistência e cancelamento</h3>
          <p>O assinante poderá solicitar esclarecimentos, desistir do pedido pendente ou discutir alteração de plano pelos canais comerciais indicados no aplicativo. Cancelamento e eventual direito de arrependimento observarão a contratação concreta, as regras aplicáveis e a legislação brasileira. Não se presume multa ou prazo de fidelidade sem previsão contratual expressa.</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-950">6. Registro eletrônico e privacidade</h3>
          <p>Ao enviar o pedido, o sistema registra a identificação do usuário autenticado, a empresa, a data/hora, a versão deste termo, o plano e o ciclo selecionados para fins de auditoria comercial e segurança. O registro é restrito à finalidade de contratação e preservação da prova do pedido, observado o tratamento de dados descrito nos Termos de Uso.</p>
        </section>
        <section>
          <h3 className="font-bold text-slate-950">7. Confirmação final</h3>
          <p>A renovação só estará confirmada após a manifestação do comercial e a aceitação das condições finais aplicáveis. Se houver divergência entre o preço público e uma proposta válida já contratada, o caso deverá ser esclarecido antes da aprovação.</p>
        </section>
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">Este termo é um modelo operacional para pedidos de renovação e deve passar por revisão jurídica antes do uso como instrumento contratual definitivo.</p>
    </article>
  );
}

/**
 * Captação inbound 100% gratuita — sem Google Ads, sem Meta Ads, sem CNPJ.
 * Compartilhe o link: https://seu-dominio/#captacao
 * Opt-in LGPD + triagem BACEN SGS (API pública).
 */
import { useMemo, useState, type FormEvent } from 'react';

type BacenResp = {
  ok?: boolean;
  label?: string;
  data?: string;
  taxaMediaMensal?: number | null;
  taxaMediaAnualApprox?: number | null;
  error?: string;
};

const LS_KEY = 'leadcheck_inbound_leads_v1';

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function InboundCaptacao({ officeWhatsapp }: { officeWhatsapp?: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState('veiculos');
  const [contractYm, setContractYm] = useState('');
  const [taxaContrato, setTaxaContrato] = useState('');
  const [consent, setConsent] = useState(false);
  const [bacen, setBacen] = useState<BacenResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  const waOffice = onlyDigits(officeWhatsapp || import.meta.env.VITE_OFFICE_WHATSAPP || '');

  const gap = useMemo(() => {
    const t = Number(String(taxaContrato).replace(',', '.'));
    const m = bacen?.taxaMediaMensal;
    if (!Number.isFinite(t) || m == null) return null;
    return { contrato: t, media: m, acima: t > m, fator: m > 0 ? t / m : null };
  }, [taxaContrato, bacen]);

  async function loadBacen() {
    setBusy(true);
    setMsg('');
    try {
      const q = new URLSearchParams({
        produto: interest === 'consignado' ? 'consignado' : interest === 'pessoal' ? 'pessoal' : 'veiculos',
        data: contractYm || '',
      });
      const r = await fetch(`/api/bacen-sgs?${q}`);
      const j = (await r.json()) as BacenResp;
      setBacen(j);
      if (!r.ok) setMsg(j.error || 'BACEN indisponível no momento');
    } catch (e: any) {
      setMsg(e?.message || 'Falha ao consultar BACEN');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!consent) {
      setMsg('Marque o consentimento para contato (LGPD).');
      return;
    }
    setBusy(true);
    const body = {
      name,
      phone: onlyDigits(phone),
      email: email || null,
      interest,
      contractYm: contractYm || null,
      taxaContrato: taxaContrato ? Number(String(taxaContrato).replace(',', '.')) : null,
      taxaMediaBacen: bacen?.taxaMediaMensal ?? null,
      consent: true,
      source: 'inbound_form_gratuito',
      source_url: typeof window !== 'undefined' ? window.location.href : null,
      notes: gap
        ? `Comparativo: contrato ${gap.contrato}% a.m. vs BACEN ${gap.media}% a.m.`
        : '',
    };
    try {
      const r = await fetch('/api/inbound-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok && !j.ok) {
        setMsg(j.error || 'Não foi possível enviar');
        setBusy(false);
        return;
      }
      // backup local sempre (grátis, offline)
      try {
        const prev = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        const next = Array.isArray(prev) ? prev : [];
        next.unshift({ ...body, consent_at: new Date().toISOString(), stored: j.stored });
        localStorage.setItem(LS_KEY, JSON.stringify(next.slice(0, 200)));
      } catch {
        /* */
      }
      setDone(true);
      setMsg('Pedido registrado. Em breve a equipe entra em contato pelo WhatsApp informado.');
    } catch (err: any) {
      setMsg(err?.message || 'Falha de rede');
    } finally {
      setBusy(false);
    }
  }

  const waHref =
    waOffice && done
      ? `https://wa.me/55${waOffice}?text=${encodeURIComponent(
          `Olá, enviei meus dados no formulário de análise revisional. Nome: ${name}. Telefone: ${phone}.`,
        )}`
      : waOffice
        ? `https://wa.me/55${waOffice}`
        : null;

  if (done) {
    return (
      <div className="inbound-wrap">
        <div className="inbound-card">
          <h1>Pedido recebido</h1>
          <p className="muted">
            Seu consentimento foi registrado. Não usamos listas frias nem anúncios pagos obrigatórios — você
            chegou por link público.
          </p>
          {waHref && (
            <a className="inbound-btn primary" href={waHref} target="_blank" rel="noreferrer">
              Abrir WhatsApp da equipe
            </a>
          )}
          <button type="button" className="inbound-btn" onClick={() => (window.location.hash = '')}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inbound-wrap">
      <div className="inbound-card">
        <p className="eyebrow">Análise educativa · gratuita · LGPD</p>
        <h1>Viabilidade de revisão de juros</h1>
        <p className="muted">
          Compare a taxa do seu contrato com a média do Banco Central (API pública). Sem promessa de
          resultado. Sem Google Ads. Sem CNPJ. Você só é contatado se autorizar abaixo.
        </p>

        <form onSubmit={onSubmit} className="inbound-form">
          <label>
            Nome completo *
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} />
          </label>
          <label>
            WhatsApp *
            <input
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              required
            />
          </label>
          <label>
            E-mail (opcional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Tipo de crédito
            <select value={interest} onChange={(e) => setInterest(e.target.value)}>
              <option value="veiculos">Financiamento de veículo</option>
              <option value="pessoal">Crédito pessoal</option>
              <option value="consignado">Consignado</option>
            </select>
          </label>
          <label>
            Mês/ano do contrato
            <input
              type="month"
              value={contractYm}
              onChange={(e) => setContractYm(e.target.value)}
            />
          </label>
          <label>
            Taxa do contrato (% ao mês, se souber)
            <input
              value={taxaContrato}
              onChange={(e) => setTaxaContrato(e.target.value)}
              placeholder="Ex.: 2,15"
            />
          </label>

          <button type="button" className="inbound-btn" disabled={busy} onClick={() => void loadBacen()}>
            {busy ? 'Consultando…' : 'Consultar média BACEN (grátis)'}
          </button>

          {bacen?.taxaMediaMensal != null && (
            <div className="inbound-bacen">
              <strong>{bacen.label}</strong>
              <div>
                Média BACEN em {bacen.data}: <b>{bacen.taxaMediaMensal}% a.m.</b>
                {bacen.taxaMediaAnualApprox != null && (
                  <span> (~{bacen.taxaMediaAnualApprox}% a.a. equivalente)</span>
                )}
              </div>
              {gap && (
                <div className={gap.acima ? 'warn' : 'ok'}>
                  {gap.acima
                    ? `Sua taxa informada (${gap.contrato}% a.m.) está acima da média. Isso não garante revisão — é só um indicativo educativo (STJ: abusividade exige distância relevante da média).`
                    : `Sua taxa informada não está acima da média BACEN deste recorte. Ainda assim, um advogado pode analisar cláusulas específicas.`}
                </div>
              )}
              <small>Fonte: Banco Central — SGS (público, sem cadastro).</small>
            </div>
          )}

          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Autorizo o contato da equipe pelo WhatsApp/telefone informados, apenas para análise
              educativa de viabilidade e eventual proposta de honorários, nos termos da LGPD. Li que
              não há promessa de êxito judicial.
            </span>
          </label>

          {msg && <p className="inbound-msg">{msg}</p>}

          <button type="submit" className="inbound-btn primary" disabled={busy || !consent}>
            {busy ? 'Enviando…' : 'Enviar e autorizar contato'}
          </button>
        </form>

        <p className="fineprint">
          Publicidade passiva (Provimento OAB 205/2021): este formulário não envia mensagens a quem não
          pediu. Compartilhe o link no Instagram, WhatsApp Status ou site — sem Google Ads / Meta Ads.
        </p>
      </div>
    </div>
  );
}

export default InboundCaptacao;

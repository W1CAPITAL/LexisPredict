/**
 * Inbound lead com opt-in — grátis.
 * POST JSON: name, phone, email?, interest?, contractYm?, taxaContrato?, consent: true
 * Sem Google Ads, sem CNPJ. Grava no Supabase se configurado; senão devolve payload para o cliente guardar local.
 */
type VercelRequest = { method?: string; body?: any; headers?: Record<string, string | string[] | undefined> };
type VercelResponse = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => VercelResponse;
  json: (b: unknown) => void;
};
import { createClient } from '@supabase/supabase-js';

function digits(s: string) {
  return String(s || '').replace(/\D/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const name = String(body.name || '').trim();
  const phone = digits(body.phone || '');
  const email = String(body.email || '').trim() || null;
  const interest = String(body.interest || 'revisional').trim();
  const contractYm = String(body.contractYm || '').trim() || null;
  const taxaContrato = body.taxaContrato != null ? Number(body.taxaContrato) : null;
  const taxaMediaBacen = body.taxaMediaBacen != null ? Number(body.taxaMediaBacen) : null;
  const consent = body.consent === true || body.consent === 'true' || body.consent === 1;
  const source = String(body.source || 'inbound_form_gratuito');
  const notes = String(body.notes || '').trim();

  if (!name || name.length < 3) return res.status(400).json({ error: 'Nome completo obrigatório' });
  if (phone.length < 10 || phone.length > 13) {
    return res.status(400).json({ error: 'Telefone/WhatsApp válido obrigatório (DDD + número)' });
  }
  if (!consent) {
    return res.status(400).json({
      error: 'Consentimento obrigatório (LGPD). Marque a autorização para contato.',
    });
  }

  const consentAt = new Date().toISOString();
  const score =
    40 +
    (phone ? 25 : 0) +
    (email ? 5 : 0) +
    (taxaContrato != null && taxaMediaBacen != null && taxaContrato > taxaMediaBacen * 1.3 ? 20 : 0) +
    (contractYm ? 10 : 0);

  const detailParts = [
    `Interesse: ${interest}`,
    contractYm ? `Contrato: ${contractYm}` : null,
    taxaContrato != null ? `Taxa contrato (a.m.): ${taxaContrato}%` : null,
    taxaMediaBacen != null ? `Taxa média BACEN (a.m.): ${taxaMediaBacen}%` : null,
    notes || null,
    'Opt-in formulário público gratuito — sem anúncio pago obrigatório',
  ].filter(Boolean);

  const payload = {
    name,
    phone,
    email,
    company: null as string | null,
    source,
    source_url: String(body.source_url || '').trim() || null,
    source_detail: detailParts.join(' | '),
    status: 'novo',
    score: Math.min(100, score),
    interest,
    notes: notes || null,
    consent_at: consentAt,
    consent_source: 'formulario_captacao_publica',
    dedupe_key: `inbound:${phone}`,
  };

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const ownerId = process.env.INBOUND_OWNER_ID || process.env.VITE_INBOUND_OWNER_ID || null;

  if (url && (serviceKey || (anonKey && ownerId))) {
    try {
      const client = createClient(url, serviceKey || anonKey!);
      const row = {
        ...payload,
        owner_id: ownerId || '00000000-0000-0000-0000-000000000001',
      };
      const { data, error } = await client
        .from('leads')
        .upsert(row, { onConflict: 'owner_id,dedupe_key', ignoreDuplicates: false })
        .select('id,name,phone,score,consent_at')
        .maybeSingle();
      if (error) {
        // ainda devolve ok local se RLS bloquear
        return res.status(200).json({
          ok: true,
          stored: 'local_recommended',
          warning: error.message,
          lead: payload,
        });
      }
      return res.status(200).json({ ok: true, stored: 'supabase', lead: data || payload });
    } catch (e: any) {
      return res.status(200).json({
        ok: true,
        stored: 'local_recommended',
        warning: e?.message,
        lead: payload,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    stored: 'client_only',
    lead: payload,
    hint: 'Configure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ou ANON + INBOUND_OWNER_ID para gravar no CRM. Sem isso o front guarda localmente.',
  });
}

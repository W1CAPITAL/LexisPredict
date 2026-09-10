/**
 * Leads de CONSUMIDORES (quem comprou / contratou), não vendedores.
 */
export const CONSUMER_PRODUCTS = [
  { id: "financiamento_veiculo", label: "Financiamento de veículo", keywords: ["financiamento", "parcela do carro", "alienação", "alienacao"] },
  { id: "refinanciamento", label: "Refinanciamento de veículo", keywords: ["refinanciamento", "refinanciar"] },
  { id: "emprestimo_pessoal", label: "Empréstimo pessoal", keywords: ["empréstimo pessoal", "emprestimo pessoal", "crédito pessoal"] },
  { id: "consignado", label: "Consignado", keywords: ["consignado", "desconto em folha", "inss"] },
  { id: "consorcio", label: "Consórcio", keywords: ["consórcio", "consorcio", "contemplação"] },
  { id: "seguro_auto", label: "Seguro de carro", keywords: ["seguro auto", "seguro do carro", "sinistro"] },
  { id: "revisional", label: "Revisão de juros / contrato", keywords: ["juros abusivos", "revisão de contrato", "taxa abusiva", "revisional"] },
] as const;

export type ConsumerProductId = (typeof CONSUMER_PRODUCTS)[number]["id"];

const SELLER_RE =
  /\b(vendo|vende-se|vende se|anuncio|anúncio|à venda|a venda|concession[aá]ria|revenda|seminovos?|loja de|estoque de ve[ií]culos?|compramos seu|troco seu)\b/i;
const CONSUMER_RE =
  /\b(minha parcela|meu financiamento|financiamento do (meu|carro)|estou devendo|n[aã]o consigo pagar|juros altos|quero revisar|consignado|paguei (o )?seguro|sinistro|cons[oó]rcio|refinanciar (o )?carro|emprestimo pessoal|empréstimo pessoal)\b/i;
const B2B_TITLE_RE =
  /\b(head of sales|vice president.?sales|sales manager|marketing operations|sdr|bdr|account executive)\b/i;

export function isSellerSignal(text: string): boolean {
  return SELLER_RE.test(text) || B2B_TITLE_RE.test(text);
}
export function isConsumerSignal(text: string): boolean {
  return CONSUMER_RE.test(text);
}
export function detectConsumerProduct(text: string): ConsumerProductId | null {
  const t = text.toLowerCase();
  for (const p of CONSUMER_PRODUCTS) {
    if (p.keywords.some((k) => t.includes(k.toLowerCase()))) return p.id;
  }
  if (/ve[ií]culo|carro|moto|financi/.test(t)) return "financiamento_veiculo";
  return null;
}

export function scoreConsumerLead(input: {
  name?: string | null; phone?: string | null; email?: string | null;
  interest?: string | null; notes?: string | null; source?: string | null;
  snippet?: string | null; consent_at?: string | null; title?: string | null; company?: string | null;
}): { score: number; product: ConsumerProductId | null; rejectReason?: string } {
  const blob = [input.interest, input.notes, input.snippet, input.title, input.company, input.source].filter(Boolean).join(" ");
  if (isSellerSignal(blob) || B2B_TITLE_RE.test(String(input.title || ""))) {
    return { score: 0, product: null, rejectReason: "vendedor/loja/B2B — fora do ICP consumidor" };
  }
  let score = 0;
  const product = detectConsumerProduct(blob);
  if (input.name && String(input.name).trim().split(/\s+/).length >= 2) score += 15;
  if (String(input.phone || "").replace(/\D/g, "").length >= 10) score += 30;
  if (input.email) score += 8;
  if (input.consent_at) score += 25;
  if (product) score += 20;
  if (isConsumerSignal(blob)) score += 15;
  if (product === "revisional" || product === "financiamento_veiculo" || product === "consignado") score += 5;
  if (input.company && !isConsumerSignal(blob) && !product) score = Math.max(0, score - 20);
  return { score: Math.min(100, score), product };
}

export function consumerIntentQueries(cidade = "São Paulo"): string[] {
  return [
    `financiamento carro parcela alta ${cidade}`,
    `juros abusivos financiamento veículo ${cidade}`,
    `não consigo pagar parcela do carro ${cidade}`,
    `revisão de contrato financiamento ${cidade}`,
    `consignado INSS margem ${cidade}`,
    `empréstimo pessoal juros altos ${cidade}`,
    `refinanciamento veículo dívida ${cidade}`,
    `consórcio contemplado problemas ${cidade}`,
  ];
}

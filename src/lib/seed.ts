import { Company, Person, Deal, Note } from "./types";

const now = () => new Date().toISOString();
const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

export const SEED_COMPANIES: Company[] = [
  { id: "c1", name: "Atlas Financeira", domain: "atlasfin.com.br", industry: "Financeiro", employees: "51-200", city: "São Paulo", country: "BR", createdAt: d(40), updatedAt: d(2) },
  { id: "c2", name: "Norte Jurídico", domain: "nortejuridico.com", industry: "Jurídico", employees: "11-50", city: "Curitiba", country: "BR", createdAt: d(30), updatedAt: d(1) },
  { id: "c3", name: "Banco Horizonte", domain: "horizon.com.br", industry: "Bancos", employees: "1000+", city: "Rio de Janeiro", country: "BR", createdAt: d(60), updatedAt: d(5) },
  { id: "c4", name: "Vita Saúde", domain: "vitasaude.app", industry: "Saúde", employees: "201-500", city: "Belo Horizonte", country: "BR", createdAt: d(20), updatedAt: d(3) },
  { id: "c5", name: "Orbital Logística", domain: "orbital.log", industry: "Logística", employees: "51-200", city: "Campinas", country: "BR", createdAt: d(15), updatedAt: d(0) },
];

export const SEED_PEOPLE: Person[] = [
  { id: "p1", companyId: "c1", name: "Marina Costa", email: "marina@atlasfin.com.br", phone: "11999990001", role: "COO", createdAt: d(38), updatedAt: d(2) },
  { id: "p2", companyId: "c1", name: "Rafael Nunes", email: "rafael@atlasfin.com.br", role: "Jurídico", createdAt: d(35), updatedAt: d(4) },
  { id: "p3", companyId: "c2", name: "Ana Paula Reis", email: "ana@nortejuridico.com", phone: "41988880002", role: "Sócia", createdAt: d(28), updatedAt: d(1) },
  { id: "p4", companyId: "c3", name: "Carlos Mendes", email: "carlos.mendes@horizon.com.br", role: "Gerente de Contas", createdAt: d(50), updatedAt: d(5) },
  { id: "p5", companyId: "c4", name: "Julia Prado", email: "julia@vitasaude.app", phone: "31977770003", role: "Head Comercial", createdAt: d(18), updatedAt: d(3) },
  { id: "p6", companyId: "c5", name: "Bruno Lima", email: "bruno@orbital.log", role: "CEO", createdAt: d(12), updatedAt: d(0) },
];

export const SEED_DEALS: Deal[] = [
  { id: "d1", companyId: "c1", name: "Plataforma de cobrança", amount: 120000, currency: "BRL", stage: "negotiation", closeDate: d(-20), createdAt: d(30), updatedAt: d(1) },
  { id: "d2", companyId: "c2", name: "Monitoramento processual", amount: 48000, currency: "BRL", stage: "proposal", closeDate: d(-10), createdAt: d(22), updatedAt: d(2) },
  { id: "d3", companyId: "c3", name: "Integração DataJud", amount: 250000, currency: "BRL", stage: "qualified", createdAt: d(45), updatedAt: d(5) },
  { id: "d4", companyId: "c4", name: "CRM clínico", amount: 89000, currency: "BRL", stage: "won", closeDate: d(3), createdAt: d(16), updatedAt: d(3) },
  { id: "d5", companyId: "c5", name: "Roteirização", amount: 61000, currency: "BRL", stage: "lead", createdAt: d(8), updatedAt: d(0) },
  { id: "d6", companyId: "c1", name: "Expansão filiais", amount: 75000, currency: "BRL", stage: "lead", createdAt: d(5), updatedAt: d(1) },
];

export const SEED_NOTES: Note[] = [
  { id: "n1", companyId: "c1", personId: "p1", body: "Kickoff alinhado. Marina pediu dashboard de inadimplência até o fim do mês.", createdAt: d(2), author: "Você" },
  { id: "n2", companyId: "c1", dealId: "d1", body: "Proposta revisada com desconto de 8% se fechamento em 30 dias.", createdAt: d(1), author: "Você" },
  { id: "n3", companyId: "c2", personId: "p3", body: "Demo do scanner DataJud. Gostaram da fila de contato.", createdAt: d(1), author: "Você" },
  { id: "n4", companyId: "c3", body: "Compliance interno ainda revisando contrato de dados CNJ.", createdAt: d(5), author: "Você" },
  { id: "n5", companyId: "c4", dealId: "d4", body: "Contrato assinado. Onboarding marcado para semana que vem.", createdAt: d(3), author: "Você" },
  { id: "n6", companyId: "c5", personId: "p6", body: "Primeiro contato. Interesse em rota + SLA de entregas.", createdAt: d(0), author: "Você" },
];

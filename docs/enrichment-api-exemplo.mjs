/**
 * Exemplo mínimo de API (Node 18+).
 * Rode: ENRICHMENT_TOKEN=segredo node enrichment-api-exemplo.mjs
 * Depois no Vercel:
 *   ENRICHMENT_LOOKUP_ENABLED=true
 *   ENRICHMENT_LOOKUP_URL=https://seu-host/v1/enrich
 *   ENRICHMENT_LOOKUP_TOKEN=segredo
 *
 * Aqui você liga SUA base (CRM, planilha, provedor contratado).
 * Não use scraper ilegal de CPF.
 */
import http from "node:http";

const TOKEN = process.env.ENRICHMENT_TOKEN || "troque-este-token";
const PORT = Number(process.env.PORT || 8787);

/** Mock: troque por consulta real ao seu banco */
async function consultarSeuBackend({ nome, cnj }) {
  // Exemplo de resposta no formato que o Lexis já normaliza:
  if (!nome) return { ok: false, error: "nome obrigatório" };

  // return { ok: false, error: "não encontrado" };

  return {
    ok: true,
    fonte: "crm-interno-exemplo",
    confianca: 0.5,
    telefone: null,
    email: null,
    cpf: null,
    cnpj: null,
    complemento: null,
    cep: null,
    bairro: null,
    municipio: null,
    uf: null,
    situacao: null,
    dt_situacao_cadastral: null,
    "situacao especial": null,
    entidade_federativo_responsavel: null,
    // Se for PJ tipo Receita:
    // telefone: "(61) 4149-290",
    // email: "gecol@caixa.gov.br",
    // cep: "70.092-900",
    // bairro: "ASA SUL",
    // municipio: "BRASILIA",
    // uf: "DF",
    // situacao: "ATIVA",
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== "POST" || !String(req.url || "").startsWith("/v1/enrich")) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const auth = String(req.headers.authorization || "");
  if (auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  let json = {};
  try {
    json = JSON.parse(body || "{}");
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "json inválido" }));
    return;
  }
  const out = await consultarSeuBackend(json);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(out));
});

server.listen(PORT, () => {
  console.log(`Enrichment API em http://127.0.0.1:${PORT}/v1/enrich`);
  console.log(`Token: Bearer ${TOKEN}`);
});

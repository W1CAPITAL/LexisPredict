'use server';

/**
 * MOTOR DE EXTRAÇÃO — documentos jurídicos
 * NÃO normaliza gênero: se o texto diz "casada", retorna "casada".
 */

const DOCUMENTS_KEY = process.env.XAI_DOCUMENTS_API_KEY;
const MAIN_KEY = process.env.XAI_API_KEY;

const SYSTEM_PROMPT = `Você é um especialista em extração de dados jurídicos.

Extraia os dados do texto e retorne APENAS JSON válido:

{
  "outorgante": {
    "nome": "",
    "nacionalidade": "",
    "estado_civil": "",
    "profissao": "",
    "rg": "",
    "cpf": "",
    "endereco": "",
    "email": "",
    "qualificacao": ""
  },
  "outorgados": [{ "nome": "", "oab": "", "nacionalidade": "", "estado_civil": "" }],
  "poderes_especificos": "",
  "instituicao_financeira": "",
  "processo_numero": "",
  "cidade": "",
  "data": ""
}

Regras CRÍTICAS:
- NÃO normalize gênero. Se o documento diz "casada", use "casada" (não "casado" nem "casado(a)" se não estiver assim).
- NÃO force "brasileiro" se o texto diz "brasileira".
- NÃO invente dados. Campo ausente = string vazia.
- Nomes podem permanecer como no documento (preferência: maiúsculas se já estiverem).
- "qualificacao" = parágrafo completo de qualificação se existir no texto, senão vazio.`;

export async function extrairDadosDocumentosAction(texto: string) {
  const apiKey = DOCUMENTS_KEY || MAIN_KEY;

  if (!apiKey) {
    console.warn("[docs-extract] Sem chave xAI. Fluxo manual.");
    return { outorgante: {}, outorgados: [], processos: [] };
  }

  if (!texto || texto.trim().length < 30) {
    return { outorgante: {}, outorgados: [], processos: [] };
  }

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: texto },
        ],
        temperature: 0.05,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error(`[docs-extract] API ${response.status}`);
      return { outorgante: {}, outorgados: [], processos: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { outorgante: {}, outorgados: [], processos: [] };

    const jsonString = content.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonString);
  } catch (error: any) {
    console.error("[docs-extract]", error.message);
    return { outorgante: {}, outorgados: [], processos: [] };
  }
}

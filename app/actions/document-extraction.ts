'use server';

/**
 * MOTOR DE EXTRAÇÃO DEDICADO - GROK BETA (apenas para documentos jurídicos)
 * 
 * Esta função deve ser usada EXCLUSIVAMENTE em:
 * - Procuração
 * - Substabelecimento  
 * - Habilitação + Procuração
 * 
 * Usa a chave XAI_DOCUMENTS_API_KEY + modelo grok-4.5 (Grok Beta)
 */

const DOCUMENTS_KEY = process.env.XAI_DOCUMENTS_API_KEY;
const MAIN_KEY = process.env.XAI_API_KEY;

const SYSTEM_PROMPT = `Você é um especialista em extração de dados jurídicos da GET Assessoria Financeira.

Extraia os dados do texto abaixo com máxima precisão e retorne APENAS um JSON válido no formato:

{
  "outorgante": {
    "nome": "",
    "nacionalidade": "brasileiro(a)",
    "estado_civil": "",
    "profissao": "",
    "rg": "",
    "cpf": "",
    "endereco": "",
    "email": ""
  },
  "outorgados": [{ "nome": "", "oab": "" }],
  "poderes_especificos": "",
  "instituicao_financeira": "",
  "processo_numero": "",
  "cidade": "São Paulo",
  "data": ""
}

Regras:
- Nomes completos devem estar em MAIÚSCULO.
- Extraia o máximo de informações possível.
- Se não encontrar algum campo, deixe como string vazia.
- Nunca invente dados.`;

export async function extrairDadosDocumentosAction(texto: string) {
  const apiKey = DOCUMENTS_KEY || MAIN_KEY;

  if (!apiKey) {
    console.warn("[Grok Beta] Nenhuma chave xAI encontrada. Retornando dados vazios para fluxo manual.");
    return { outorgante: {}, processos: [] };
  }

  if (!texto || texto.trim().length < 30) {
    return { outorgante: {}, processos: [] };
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
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error(`[Grok Beta] Erro API: ${response.status}`);
      return { outorgante: {}, processos: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) return { outorgante: {}, processos: [] };

    const jsonString = content.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonString);

  } catch (error: any) {
    console.error("[Grok Beta - Documentos] Erro:", error.message);
    return { outorgante: {}, processos: [] };
  }
}

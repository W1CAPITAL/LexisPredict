"use server";

/**
 * Chat operacional — tom profissional, sem assinatura de marca em texto ao cliente.
 * Base de conhecimento: use knowledge_docs no futuro; por ora system prompt fixo + histórico.
 */

export async function perguntarChatbotIndependente(
  prompt: string,
  history: any[],
  model: string
) {
  const isXAI = model === "xai";
  const apiKey = isXAI ? process.env.XAI_API_KEY : process.env.GROQ_API_KEY;
  const url = isXAI
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";
  const modelName = isXAI ? "grok-4.5" : "llama-3.3-70b-versatile";

  if (!apiKey) {
    return { sucesso: false, resposta: "API Key não configurada no servidor." };
  }

  const system = `Você é assistente operacional de uma equipe jurídica/financeira brasileira.
Regras:
- Respostas claras, em português, profissionais.
- NÃO invente andamentos, sentenças ou prazos de processos reais.
- NÃO cite nome de empresa, marca ou escritório em textos que o usuário possa copiar para o cliente.
- Se faltar dado do processo, peça CNJ ou indique usar a Consulta de processo / carteira.
- Scripts ao cliente: linguagem leiga, sem jargão desnecessário, sem prometer resultado.
- Priorização: baixa no tribunal > sentença > audiência > cumprimento > nova movimentação > prazo.`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: system },
          ...history.slice(-8).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Resposta vazia.");

    return {
      sucesso: true,
      resposta: text,
      engine: model.toUpperCase(),
      tokens: data.usage?.total_tokens || 0,
    };
  } catch (error: any) {
    return {
      sucesso: false,
      resposta: `Falha na comunicação: ${error.message}. Verifique os motores em Configurações.`,
    };
  }
}

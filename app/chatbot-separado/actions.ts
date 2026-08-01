"use server";
/**
 * @fileOverview Server Actions isoladas para o Chatbot Independente.
 * Realiza chamadas diretas às APIs sem dependências externas de lib/ai.
 */

export async function perguntarChatbotIndependente(prompt: string, history: any[], model: string) {
  const isXAI = model === 'xai';
  const apiKey = isXAI ? process.env.XAI_API_KEY : process.env.GROQ_API_KEY;
  const url = isXAI 
    ? 'https://api.x.ai/v1/chat/completions' 
    : 'https://api.groq.com/openai/v1/chat/completions';
  
  const modelName = isXAI ? 'grok-4.5' : 'llama-3.3-70b-versatile';

  if (!apiKey) {
    return { sucesso: false, resposta: "API Key não configurada no servidor." };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { 
            role: 'system', 
            content: 'Você é um Consultor Estratégico Sênior da W1 Capital. Sua missão é fornecer insights jurídicos e operacionais precisos, diretos e profissionais. Assine como Setor Processual.' 
          },
          ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048
      }),
      // Timeout de 30 segundos
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) throw new Error("Resposta vazia da Unidade Neural.");

    return {
      sucesso: true,
      resposta: text,
      engine: model.toUpperCase(),
      tokens: data.usage?.total_tokens || 0
    };

  } catch (error: any) {
    console.error("[INDEPENDENT CHAT ERROR]", error.message);
    return { 
      sucesso: false, 
      resposta: `Falha na comunicação: ${error.message}. Verifique os motores em Configurações.` 
    };
  }
}

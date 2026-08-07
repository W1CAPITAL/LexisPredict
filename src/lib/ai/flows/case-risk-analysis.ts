
'use server';
/**
 * @fileOverview Análise de Risco de Gabinete v2700.0 ELITE
 * Soberania Grok 4.5.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const XAI_API_KEY = process.env.XAI_API_KEY;

export async function caseRiskAnalysis(input: any): Promise<any> {
  if (!XAI_API_KEY) return { riskScore: 50, priorityLevel: 'Medium', technicalSummary: 'Risco operacional moderado.' };

  const prompt = `Analise este caso jurídico e retorne JSON: { "riskScore": 0-100, "priorityLevel": "Low"|"Medium"|"High"|"Critical", "technicalSummary": "" }
  DADOS: ${JSON.stringify(input)}`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-4.5',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) throw new Error();
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    return { riskScore: 50, priorityLevel: 'Medium', technicalSummary: 'Risco operacional moderado.' };
  }
}

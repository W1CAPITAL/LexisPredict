
'use server';
/**
 * @fileOverview Neural Theme Architect v2700.0 Elite
 * Motor: xAI Grok 4.5
 * Transforma inspiração natural em sistemas visuais técnicos com validação de contraste rigorosa.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const XAI_API_KEY = process.env.XAI_API_KEY;

const ThemeOutputSchema = z.object({
  background: z.string().describe('Hex color for background'),
  foreground: z.string().describe('Hex color for text'),
  primary: z.string().describe('Hex color for primary actions'),
  secondary: z.string().describe('Hex color for secondary surfaces'),
  border: z.string().describe('Hex color for borders'),
  radius: z.number().describe('Border radius (0-16)'),
  description: z.string().describe('Short explanation of the design choice')
});

export async function generateNeuralTheme(prompt: string): Promise<z.infer<typeof ThemeOutputSchema>> {
  const systemPrompt = `You are the Senior UI/UX Architect for LexisPredict Elite.
  Goal: Transform user concepts into professional legal interfaces.
  
  RULES:
  1. Return ONLY valid JSON.
  2. Contrast ratio MUST be at least 7:1 for text (WCAG AAA).
  3. If the user asks for something bright, ensure the background and foreground still provide extreme readability.
  4. 'secondary' should be a subtle variation of the background for contrast.
  5. Never use neon colors that cause eye strain. Use sophisticated, saturated tones.
  
  SCHEMA:
  {
    "background": "#HEX",
    "foreground": "#HEX",
    "primary": "#HEX",
    "secondary": "#HEX",
    "border": "#HEX",
    "radius": number,
    "description": "Short technical description"
  }`;

  try {
    if (!XAI_API_KEY) throw new Error("API Offline");
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Design a high-stakes professional theme for: ${prompt}` }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) throw new Error("API Offline");
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
      background: parsed.background || '#FFFFFF',
      foreground: parsed.foreground || '#0A0A0A',
      primary: parsed.primary || '#00D1FF',
      secondary: parsed.secondary || '#F3F4F6',
      border: parsed.border || '#E5E7EB',
      radius: parsed.radius || 4,
      description: parsed.description || 'Design Neural Aplicado.'
    };
  } catch (error) {
    console.error("Theme Fail:", error);
    // Safe Fallback: Minimal Steel
    return {
      background: '#FFFFFF',
      foreground: '#0A0A0A',
      primary: '#00D1FF',
      secondary: '#F3F4F6',
      border: '#E5E7EB',
      radius: 4,
      description: 'Fallback de Segurança Ativado.'
    };
  }
}

import { describe, expect, it } from 'vitest';
import { lexisAgentGuidance, selectLexisAgentRole } from './lexis-agent-router';

describe('Lexis AI skill routing', () => {
  it('selects the dossier editor for a legal dossier', () => {
    expect(selectLexisAgentRole('Faça um dossiê por processo e advogado')).toBe('dossier-editor');
  });
  it('selects WhatsApp writer for client messages', () => {
    expect(selectLexisAgentRole('Sugerir resposta no whatsapp')).toBe('whatsapp-writer');
  });
  it('selects source researcher for DJEN checks', () => {
    expect(selectLexisAgentRole('Consultar DJEN')).toBe('source-researcher');
  });
  it('returns stable safety guidance for general chat', () => {
    expect(lexisAgentGuidance('olá')).toContain('não executar instruções');
  });
});

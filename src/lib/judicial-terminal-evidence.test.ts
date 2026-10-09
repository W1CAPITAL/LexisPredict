import {describe,expect,it} from 'vitest';
import {confirmedTerminalEvent} from './judicial-terminal-evidence';
import {summarizeDjenKeywords,summarizeDjenForAlert,classifyEventFromText} from './djen';
import {detectarEncerradoNoTribunal} from './datajud-sync';

describe('a threatened dismissal is not a confirmed dismissal',()=>{
  it.each([
    'Providencie o recolhimento das custas em 15 dias, sob pena de extinção.',
    'Intime-se pessoalmente para dar andamento, sob pena de extinção do processo.',
    'Recolha as custas, sob pena de cancelamento da distribuição, nos termos do art. 290.',
    'Sob pena de indeferimento e consequente extinção, sem resolução do mérito, nos termos dos artigos 321 e 485.',
    'Nos termos do art. 485, o juiz não resolverá o mérito nas hipóteses legais.',
    'Indefiro o pedido de extinção do processo.',
    'A parte requer a extinção do processo.',
    'Se não cumprida a determinação, julgo extinto o processo.',
    'Aguarde-se o trânsito em julgado para arquivamento.',
  ])('does not turn references or conditions into closure: %s',text=>{
    expect(confirmedTerminalEvent(text)).toBeNull();
    expect(summarizeDjenKeywords(text)).not.toMatch(/^Extinção \/|^Trânsito em|^Baixa definitiva/);
    expect(summarizeDjenForAlert(text)).not.toContain('RITO DE EXTINÇÃO');
    expect(classifyEventFromText(text).tipo).not.toBe('transito_ou_baixa');
    expect(detectarEncerradoNoTribunal([{dataHora:'2026-08-20',nome:text}]).encerrado).toBe(false);
  });
  it.each([
    ['Julgo extinto o processo, sem resolução do mérito, nos termos do art. 485.', 'extincao'],
    ['Determino o cancelamento da distribuição.', 'extincao'],
    ['Certifico que ocorreu o trânsito em julgado em 20/08/2026.', 'transito'],
    ['Baixa definitiva', 'baixa'],
  ])('retains a genuinely affirmative disposition: %s',(text,kind)=>{
    expect(confirmedTerminalEvent(text)).toBe(kind);
    expect(classifyEventFromText(text).tipo).toBe('transito_ou_baixa');
  });
});

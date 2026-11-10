import { describe, expect, it } from 'vitest';
import { extrairAudienciasOficiais } from '@/lib/audiencias-monitor';
describe('audiencias oficiais', () => {
  it('não converte prazo de contestação ou retorno em audiência', () => {
    expect(extrairAudienciasOficiais('Prazo final do banco para contestação: 11/11/2026.')).toEqual([]);
    expect(extrairAudienciasOficiais('Ambas as partes informem se têm interesse na realização de audiência virtual visando conciliação. Prazo: 11/11/2026.')).toEqual([]);
  });
  it('lê data e hora de uma audiência efetivamente designada', () => {
    const a=extrairAudienciasOficiais('DESPACHO: designo audiência de conciliação para o dia 19/11/2026 às 13:00. O ato será realizado de forma virtual.');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({tipo:'conciliacao',data:'2026-11-19',hora:'13:00',modalidade:'virtual',situacao:'publicada'});
  });
  it('lê horário local de Mato Grosso sem converter fuso automaticamente', () => {
    const a=extrairAudienciasOficiais('Certidão: designar Audiência de Conciliação VIRTUAL para o dia 24/11/2026, às 14h00min (MT). A audiência será via Microsoft Teams.');
    expect(a[0].data).toBe('2026-11-24');
    expect(a[0].hora).toBe('14:00');
  });
  it('conserva início e fim de sessão plenária virtual e não inventa audiência oral', () => {
    const a=extrairAudienciasOficiais('INTIMAÇÃO DE PAUTA DE SESSÃO VIRTUAL DE JULGAMENTO. O julgamento ocorrerá com início às 09:00 horas do dia 04-11-2026 e término às 09:00 horas do dia 11-11-2026.');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({tipo:'sessao_virtual',data:'2026-11-04',dataFim:'2026-11-11',hora:'09:00',horaFim:'09:00'});
  });
  it('aceita data por extenso sem confundir data da publicação', () => {
    const a=extrairAudienciasOficiais('Certifico que foi designada audiência de conciliação para o dia 12 de novembro de 2026, às 10h30.');
    expect(a[0].data).toBe('2026-11-12');
  });
  it('não transforma designação sem data em evento agendado', () => {
    const a=extrairAudienciasOficiais('Evento 30 - Audiência de conciliação/mediação designada - art. 334 CPC');
    expect(a[0]).toMatchObject({data:null,situacao:'data_pendente'});
  });
});

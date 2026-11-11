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
  it('não confunde prazo anterior à sessão com término do julgamento virtual', () => {
    const notice='PAUTA DE SESSÃO VIRTUAL DE JULGAMENTO. Os autos serão julgados eletronicamente em sessão virtual com início em 24/11/2026 às 00:00. Eventual oposição ao julgamento virtual deverá ser requerida até 10/11/2026.';
    const a=extrairAudienciasOficiais(notice);
    expect(a).toHaveLength(1);
    expect(a[0].data).toBe('2026-11-24');
    expect(a[0].dataFim).toBeNull();
    expect(a[0].horaFim).toBeNull();
  });
  it('não confunde última data sem indicação de encerramento com fim da sessão', () => {
    const a=extrairAudienciasOficiais('SESSÃO VIRTUAL DE JULGAMENTO. Início em 24/11/2026. Publicação 25/11/2026; inscrições até 26/11/2026.');
    expect(a[0].data).toBe('2026-11-24');
    expect(a[0].dataFim).toBeNull();
  });
  it('prioriza a data expressa de início da sessão sobre a data anterior da publicação', () => {
    const notice='PUBLICAÇÃO EM 10/11/2026. PAUTA DE SESSÃO VIRTUAL DE JULGAMENTO. O julgamento terá início às 00:00 do dia 24/11/2026. Oposição até 22/11/2026.';
    const out=extrairAudienciasOficiais(notice);
    expect(out[0]).toMatchObject({tipo:'sessao_virtual',data:'2026-11-24',dataFim:null,hora:'00:00'});
  });
  it('não toma o término de prazo da sustentação oral como fim da sessão', () => {
    const notice='INTIMAÇÃO DE PAUTA DE SESSÃO VIRTUAL DE JULGAMENTO. Início da sessão às 10:00 do dia 24/11/2026. O término do prazo para requerimento de sustentação oral será às 18:00 do dia 26/11/2026.';
    const out=extrairAudienciasOficiais(notice);
    expect(out[0].data).toBe('2026-11-24');
    expect(out[0].dataFim).toBeNull();
  });
  it('não produz intervalo invertido em extrato oficial de sessão virtual e prazo anterior', () => {
    const notice='PAUTA DE JULGAMENTOS. Os autos serão julgados eletronicamente em sessão virtual com início em 31/08/2026. Eventual pedido de destaque deverá ser apresentado até 18/08/2026.';
    const out=extrairAudienciasOficiais(notice);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({data:'2026-08-31',dataFim:null,horaFim:null});
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

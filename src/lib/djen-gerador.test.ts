import { afterEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { extractCpfFromDjenText } from "./djen-cpf-extract";
import { extractVeiculoFromDjenText } from "./djen-veiculo-extract";
import { extractEmailFromDjenText, extractTelefonePorContexto, djenBuscaTexto, dataPublicacaoNaJanela, cnjOficial } from "./djen-client";
import { extractNomeCompletoFromDjen, type ProcessoDjenReal } from "./revisional-tribunal-filtros";
import { xlsxProcessosDjenReal } from "./xlsx-lista-cnj";
afterEach(() => vi.unstubAllGlobals());
describe("Dados publicados", () => {
  it("extrai CPF válido e preserva zeros do RENAVAM", () => {
    const t = 'CPF/MF nº 529.982.247-25; placa ABC1D23; RENAVAM nº 00123456789; email contato@example.org; telefone (11) 99999-1234';
    expect(extractCpfFromDjenText(t)).toBe('52998224725');
    expect(extractVeiculoFromDjenText(t)).toEqual({ placa: 'ABC1D23', renavam: '00123456789' });
    expect(extractEmailFromDjenText(t)).toBe('contato@example.org');
    expect(extractTelefonePorContexto(t)).toBe('(11) 99999-1234');
  });
  it("não usa CPF inválido, mascarado ou RENAVAM como CPF/telefone", () => {
    expect(extractCpfFromDjenText('CPF 111.111.111-11')).toBe('');
    expect(extractCpfFromDjenText('CPF ***.982.247-**; RENAVAM 52998224725')).toBe('');
    expect(extractTelefonePorContexto('CPF: 52998224725')).toBe('');
    expect(extractTelefonePorContexto('RENAVAM: 52998224725')).toBe('');
    expect(extractTelefonePorContexto('Advogado: Fulano, telefone (11) 99999-1234')).toBe('');
  });
  it("aceita placa antiga e considera todos os contatos até achar um válido", () => {
    expect(extractVeiculoFromDjenText('Placas: abc-1234')).toEqual({ placa: 'ABC-1234', renavam: '' });
    expect(extractTelefonePorContexto('CPF 52998224725; telefone (31) 3333-1234')).toBe('(31) 3333-1234');
  });
  it("não troca autor banco por réu", () => {
    expect(extractNomeCompletoFromDjen({ destinatarios: [{nome:'Banco Exemplo S.A.',polo:'A'}, {nome:'Pessoa Exemplo',polo:'P'}] })).toBe('Banco Exemplo S.A.');
    expect(extractNomeCompletoFromDjen({texto:'Autor: Banco Exemplo S.A. Réu: Pessoa Exemplo'})).toBe('Banco Exemplo S.A.');
    expect(extractNomeCompletoFromDjen({destinatarios:[{nome:'Pessoa Exemplo',polo:'P'}]})).toBe('');
  });
});
describe("DJEN público e datas", () => {
  const opts = {texto:'busca e apreensao',dataInicio:'2026-08-16',dataFim:'2026-09-15',siglaTribunal:'TJMG'};
  it.each([['','vazio'],['<html>Bloqueado</html>','HTML/WAF'],['null','sem uma lista'],['{"mensagem":"erro"}','sem uma lista'],['invalid','não é JSON']])('resposta %s é erro claro', async (body,message) => {
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(body)));
    const result=await djenBuscaTexto(opts);
    expect(result.ok).toBe(false); expect(result.error).toContain(message);
  });
  it("usa os parâmetros oficiais, incluindo tribunal e datas", async () => {
    const fetchMock=vi.fn(async (_input: string | URL | Request)=>new Response(JSON.stringify({items:[],count:0})));
    vi.stubGlobal('fetch',fetchMock);
    expect((await djenBuscaTexto(opts)).ok).toBe(true);
    const url=new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe('https://comunicaapi.pje.jus.br');
    expect(url.searchParams.get('dataDisponibilizacaoInicio')).toBe(opts.dataInicio);
    expect(url.searchParams.get('dataDisponibilizacaoFim')).toBe(opts.dataFim);
    expect(url.searchParams.get('siglaTribunal')).toBe('TJMG');
  });
  it("limites inclusivos, rejeita data inválida e nunca extrai CNJ do teor", () => {
    expect(dataPublicacaoNaJanela('2026-08-16',opts.dataInicio,opts.dataFim)).toBe(true);
    expect(dataPublicacaoNaJanela('2026-09-15T12:00:00',opts.dataInicio,opts.dataFim)).toBe(true);
    expect(dataPublicacaoNaJanela('2022-09-15',opts.dataInicio,opts.dataFim)).toBe(false);
    expect(dataPublicacaoNaJanela('2026-02-31','2026-01-01','2026-12-31')).toBe(false);
    expect(cnjOficial({texto:'Processo 1000000-00.2026.8.26.0100'})).toBe(null);
  });
});
it("XLSX com 17 colunas, texto seguro, filtros e cabeçalho congelado", async () => {
  const row = { processo:'0000000-00.2026.8.26.0100', nome_completo:'=EXEMPLO()', telefone:'(11) 99999-1234', email:'teste@example.org', cpf:'01234567890', placa:'ABC1D23',renavam:'00123456789',sem_advogado:'SIM',tipo_ba:'veiculo',ba_inicio:'SIM',flags:'BA_VEICULO | SEM_ADVOGADO',classe:'Busca e Apreensão',tribunal:'TJSP',data:'2026-09-15',situacao_hint:'Inicial',link:'https://comunica.pje.jus.br',assunto_ou_teor:'Teor & <texto>\u0000' } as ProcessoDjenReal;
  const blob=await xlsxProcessosDjenReal([row]);
  const zip=await JSZip.loadAsync(await blob.arrayBuffer());
  const xml=await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  expect(xml).toContain('r="Q1"'); expect(xml).toContain('Email');expect(xml).toContain('00123456789');
  expect(xml).toContain('teste@example.org'); expect(xml).toContain('state="frozen"');expect(xml).toContain('autoFilter ref="A1:Q2"');
  expect(xml).not.toContain('<f>');expect(xml).not.toContain('\u0000');
  expect(await zip.file('xl/workbook.xml')!.async('string')).toContain('name="BA_DJEN"');
});

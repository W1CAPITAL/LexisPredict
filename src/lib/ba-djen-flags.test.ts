import { describe, it, expect } from "vitest";
import { isBaCriminalOuTrafico, isBaVeiculoOuFiduciaria, isPublicacaoBuscaApreensao, isBaInicioProcesso, isSemAdvogadoNoTeor, queriesBaInicio, queriesBaVeiculo, queriesBaCriminal } from "./ba-djen-flags";
const classe = "Busca e Apreensão em Alienação Fiduciária";
const janela = { dataInicio: "2026-08-16", dataFim: "2026-09-15" };
describe("Modos B.A.", () => {
  it.each(["Ação penal", "Inquérito", "CP, art. 157", "CPP", "Tráfico", "Lei 11.343", "Arma de fogo", "Homicídio", "Roubo", "Furto", "Latrocínio", "Júri", "Execução penal", "Delegacia: mandado de busca", "Mandado domiciliar", "Apreensão de drogas", "Apreensão de arma"])("isola %s mesmo com veículo", texto => {
    const t = `Busca e apreensão de veículo. ${texto}.`;
    expect(isBaCriminalOuTrafico(t)).toBe(true);
    expect(isBaVeiculoOuFiduciaria(t, classe)).toBe(false);
    expect(isPublicacaoBuscaApreensao(classe, t)).toBe(false);
    expect(isPublicacaoBuscaApreensao(classe, t, { modoCriminal: true })).toBe(true);
  });
  it.each(["veículo", "alienação fiduciária", "fiduciário", "banco", "financiamento", "DL 911", "procedimento comum"])("aceita contexto %s", contexto => {
    expect(isPublicacaoBuscaApreensao("", `Busca e apreensão: ${contexto}`)).toBe(true);
  });
  it("não presume veículo para B.A. genérica ou assunto sem B.A.", () => {
    expect(isPublicacaoBuscaApreensao("", "Busca e apreensão de documentos")).toBe(false);
    expect(isPublicacaoBuscaApreensao("", "Financiamento de automóvel")).toBe(false);
    expect(isPublicacaoBuscaApreensao("Busca e Apreensão Cível", "Intime-se.")).toBe(true);
  });
  it("consultas ASCII separadas", () => {
    expect([...queriesBaVeiculo(), ...queriesBaInicio(), ...queriesBaCriminal()].every(q => /^[\x00-\x7f]+$/.test(q))).toBe(true);
    expect(queriesBaVeiculo().some(q => /criminal|trafico/.test(q))).toBe(false);
  });
});
describe("Ato inicial, não histórico", () => {
  it.each(["Distribuição do processo.", "Autos distribuídos em 16/08/2026.", "Petição inicial protocolada em 15/08/2026.", "Cite-se o réu.", "Citação do requerido.", "Defiro a liminar de busca e apreensão.", "Liminar deferida.", "Expedição de mandado de busca e apreensão.", "Expeça-se mandado de busca e apreensão.", "Petição inicial protocolada.", "Processo em fase inicial.", "Defiro a busca e apreensão.", "Determino a apreensão do veículo.", "Mantenho a liminar. Cite-se novamente.", "Mantenho a liminar. Cite-se o requerido."])("aceita %s", t => {
    expect(isBaInicioProcesso(t, classe, janela)).toBe(true);
  });
  it.each(["Leilão do veículo. Cite-se.", "Hasta pública. Liminar deferida.", "Consolidação da propriedade após liminar.", "Arrematação do veículo.", "Cumprimento de sentença, após distribuição.", "Execução de título.", "Sentença improcedente. Liminar deferida em 2020.", "Julgo procedente o pedido.", "Trânsito em julgado.", "Mantenho a liminar de busca e apreensão.", "Intime-se o autor sobre o andamento.", "Petição inicial juntada para consulta.", "Mandado de busca e apreensão devolvido sem cumprimento.", "Foi deferida a liminar em 2020. Intime-se sobre o andamento.", "Distribuído em 2022. Intime-se.", "Distribuição em 12/02/2022. Intime-se.", "Republicação de despacho: defiro a liminar de busca e apreensão.", "Jurisprudência: defiro a liminar de busca e apreensão.", "O autor requer a citação e a busca e apreensão.", "Indefiro a liminar. Aguarde-se.", "Intime-se para informar a data de distribuição.", "Vistos. Citado em 2020, o réu pede prazo. Intime-se."])("rejeita %s", t => {
    expect(isBaInicioProcesso(t, classe, janela)).toBe(false);
  });
  it("descarta relatório e citação literal", () => {
    expect(isBaInicioProcesso('Consta a decisão “Defiro a liminar de busca e apreensão”. Intime-se.', classe, janela)).toBe(false);
    expect(isBaInicioProcesso('Distribuição em 2020. Ante o exposto, intime-se sobre o laudo.', classe, janela)).toBe(false);
  });
});
describe("Representação apenas no teor", () => {
  it.each(["Sem advogado", "Não consta advogado", "Causa própria", "Jus postulandi", "Autor: Banco Exemplo. Cite-se."])("sinaliza %s", t => expect(isSemAdvogadoNoTeor(t)).toBe(true));
  it.each(["OAB/SP 123456", "OAB/MG nº 12345", "OAB 12345/SP", "Advogado nomeado, inscrição 12345", "Sem advogado. Autor com OAB/SP 123456."])("inscrição prevalece: %s", t => expect(isSemAdvogadoNoTeor(t)).toBe(false));
});

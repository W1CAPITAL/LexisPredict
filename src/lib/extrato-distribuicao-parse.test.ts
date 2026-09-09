import { readFileSync } from "fs";
import { join } from "path";
import { parseExtratoDistribuicao } from "./extrato-distribuicao-parse";

describe("parseExtratoDistribuicao gold Silwany", () => {
  it("extrai CNJ, partes, valor, OAB, tribunal", () => {
    const texto = readFileSync(
      join(__dirname, "../../docs/gold/extrato-silwany.txt"),
      "utf8"
    );
    // fallback inline se path de teste diferir
    const t =
      texto ||
      `Número do Processo: 5001032-25.2026.8.01.0006
Nome: DIEGO GOMES DIAS
OAB/Sigla: SP370898
SILWANY ALVES FAINO - AUTOR X BANCO DO BRASIL SA - RÉU
Valor da Causa: R$ 82.890,98
Orgão Julgador: Juízo da Vara Única da Comarca de Acrelândia - Cível`;

    const e = parseExtratoDistribuicao(t);
    expect(e.protocolo).toBe("5001032-25.2026.8.01.0006");
    expect(e.autor).toMatch(/SILWANY/i);
    expect(e.reu).toMatch(/BANCO DO BRASIL/i);
    expect(e.valor_causa).toBeCloseTo(82890.98, 0);
    expect(e.advogado_oab_uf).toBe("SP");
    expect(e.advogado_oab).toBe("370898");
    expect(e.tribunal_hint).toBe("TJAC");
    expect(e.confianca).toBeGreaterThanOrEqual(80);
  });
});

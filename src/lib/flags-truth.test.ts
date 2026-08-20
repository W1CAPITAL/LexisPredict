import { describe, expect, it } from "vitest";
import {
  applyFlagsTruth,
  extractClasseProcessual,
  isCumprimentoRecebidoTruth,
  meritoExclusivo,
  novidadeAposRetorno,
  replicaPendenteTruth,
} from "./flags-truth";
import { isBuscaApreensaoReal } from "./ba-real";
import { getSinalCapa } from "./sinal-capa";

describe("Lote A — flags confiáveis", () => {
  it("1. B.A. só com classe + mandado", () => {
    expect(
      isBuscaApreensaoReal({
        classe: "Procedimento Comum Cível",
        evento_resumo: "Ação de busca e apreensão (jurisprudência nesse sentido)",
      } as any)
    ).toBe(false);
    expect(
      isBuscaApreensaoReal({
        classe_processual: "Busca e Apreensão",
        evento_resumo: "Mandado de busca expedido",
      } as any)
    ).toBe(true);
  });

  it("2. não marca procedente e improcedente juntos", () => {
    const m = meritoExclusivo({
      is_procedente: true,
      is_improcedente: true,
      evento_resumo: "Julgo improcedente o pedido",
    });
    expect(m.is_procedente && m.is_improcedente).toBe(false);
    expect(m.is_improcedente).toBe(true);
  });

  it("3. cumprimento recebido mata aberto", () => {
    const c = applyFlagsTruth({
      em_cumprimento_sentenca: true,
      cumprimento_ativo: true,
      evento_resumo: "Alvará levantado. Obrigação satisfeita.",
    } as any);
    expect(isCumprimentoRecebidoTruth(c)).toBe(true);
    expect(c.em_cumprimento_sentenca).toBe(false);
    expect(c.cumprimento_ativo).toBe(false);
  });

  it("4–6. classe persistida e evento estável", () => {
    const c = applyFlagsTruth({
      datajud_classe: "Busca e Apreensão",
      evento_tipo: "ba",
      datajud_encerrado_tribunal: true,
      evento_resumo: "Baixa definitiva",
    } as any);
    expect(extractClasseProcessual(c)).toMatch(/busca e apreens/i);
    expect(c.evento_tipo).toBe("transito_ou_baixa");
    expect(c.indicio_busca_apreensao).toBe(false);
  });

  it("5. evento ba sem rito vira rotina", () => {
    const c = applyFlagsTruth({
      evento_tipo: "ba",
      classe: "Revisional",
      evento_resumo: "citação",
    } as any);
    expect(c.evento_tipo).toBe("rotina");
  });

  it("7. réplica pendente só com contestação e sem sentença", () => {
    expect(
      replicaPendenteTruth({
        evento_resumo: "Contestação apresentada. Prazo para réplica.",
      })
    ).toBe(true);
    expect(
      replicaPendenteTruth({
        evento_resumo: "Contestação e sentença procedente",
        evento_tipo: "sentenca_procedente",
      })
    ).toBe(false);
  });

  it("8. novidade só após o último retorno", () => {
    expect(
      novidadeAposRetorno({
        tem_novo_andamento: true,
        datajud_ultimo_movimento: "2026-01-10",
        ultimoRetorno: "2026-02-01",
      })
    ).toBe(false);
    expect(
      novidadeAposRetorno({
        tem_novo_andamento: true,
        datajud_ultimo_movimento: "2026-03-01",
        ultimoRetorno: "2026-02-01",
      })
    ).toBe(true);
  });

  it("9. baixa ganha de B.A. no título", () => {
    const s = getSinalCapa({
      datajud_encerrado_tribunal: true,
      evento_tipo: "ba",
      evento_resumo: "ALERTA: BUSCA E APREENSÃO",
      indicio_busca_apreensao: true,
    } as any);
    expect(s.titulo).toMatch(/BAIXA|TRÂNSITO/i);
    expect(s.titulo).not.toMatch(/BUSCA E APREENS/i);
  });
});

import { describe, expect, it } from "vitest";
import {
  casoAtendidoHoje,
  casoAtendidoNestaSemana,
  countAtendidosNestaSemana,
  countAtendidosSemanaDoUsuario,
} from "./atendimento-semana";

const ref = new Date("2026-09-21T15:00:00-03:00");
const human = "11111111-1111-4111-8111-111111111111";

describe("commercial attendance contract", () => {
  it("edição/retorno sem atendido_por não vira atendimento", () => {
    const c = {
      ultimo_retorno: "2026-09-21",
      edited_by: human,
      updated_by: human,
    };
    expect(casoAtendidoHoje(c, ref)).toBe(false);
    expect(casoAtendidoNestaSemana(c, ref)).toBe(false);
    expect(countAtendidosNestaSemana([c], ref)).toBe(0);
  });

  it("atendimento humano conta e credita quem atendeu", () => {
    const c = {
      ultimo_retorno: "2026-09-21",
      atendido_em: "2026-09-21T13:20:00-03:00",
      atendido_por: human,
      created_by: "22222222-2222-4222-8222-222222222222",
    };
    expect(casoAtendidoHoje(c, ref)).toBe(true);
    expect(casoAtendidoNestaSemana(c, ref)).toBe(true);
    expect(countAtendidosSemanaDoUsuario([c], human, ref)).toBe(1);
    expect(
      countAtendidosSemanaDoUsuario(
        [c],
        "22222222-2222-4222-8222-222222222222",
        ref
      )
    ).toBe(0);
  });

  it("scanner/sistema nunca entra como atendimento humano", () => {
    const systemCases = [
      { ultimo_retorno: "2026-09-21", atendido_por: "scanner" },
      { ultimo_retorno: "2026-09-21", atendido_por: "sistema-interno" },
      {
        ultimo_retorno: "2026-09-21",
        atendido_por: "af1b75ea-cb64-4ebc-b4ad-ce1ce1fc01c5",
      },
    ];
    expect(countAtendidosNestaSemana(systemCases, ref)).toBe(0);
  });

  it("atender não depende de created_by e portanto não transfere crédito ao dono", () => {
    const dono = "22222222-2222-4222-8222-222222222222";
    const c = {
      ultimo_retorno: "2026-09-21",
      atendido_por: human,
      created_by: dono,
    };
    expect(countAtendidosSemanaDoUsuario([c], human, ref)).toBe(1);
    expect(countAtendidosSemanaDoUsuario([c], dono, ref)).toBe(0);
  });
});

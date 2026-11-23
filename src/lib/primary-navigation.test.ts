import { describe, expect, it } from "vitest";
import {
  PRIMARY_NAV_ORDER,
  getPrimaryNavigationLabel,
  selectPrimaryNavigationItems,
} from "./primary-navigation";

describe("navegação essencial do LexisPredict", () => {
  const available = [
    { href: "/report", label: "Relatórios" },
    { href: "/whatsapp", label: "WhatsApp" },
    { href: "/processos", label: "Processos da Empresa" },
    { href: "/tarefas", label: "Hoje" },
    { href: "/cases", label: "Meus Processos" },
    { href: "/", label: "Início" },
    { href: "/vencidos", label: "Vencidos" },
    { href: "/agenda", label: "Agenda" },
    { href: "/documents", label: "Peças e documentos" },
    { href: "/hermes-3d", label: "Hermes" },
    { href: "/settings", label: "Configurações" },
  ];

  it("mostra somente seis áreas por tarefa, sem destacar módulos redundantes", () => {
    expect(PRIMARY_NAV_ORDER).toEqual([
      "/", "/processos", "/tarefas", "/agenda", "/whatsapp", "/documents",
    ]);
    expect(selectPrimaryNavigationItems(available).map(item => item.href)).toEqual([
      "/", "/processos", "/tarefas", "/agenda", "/whatsapp", "/documents",
    ]);
  });

  it("usa Meus Processos quando o perfil não pode ver a empresa", () => {
    const scoped = available.filter(item => item.href !== "/processos");
    expect(selectPrimaryNavigationItems(scoped).map(item => item.href)).toEqual([
      "/", "/cases", "/tarefas", "/agenda", "/whatsapp", "/documents",
    ]);
  });

  it("não mostra recursos bloqueados pelo plano nem inventa destinos", () => {
    const scoped = available.filter(item => !["/documents", "/agenda", "/processos"].includes(item.href));
    expect(selectPrimaryNavigationItems(scoped).map(item => item.href)).toEqual([
      "/", "/cases", "/tarefas", "/whatsapp",
    ]);
  });

  it("usa nomes claros no primeiro nível sem renomear os módulos internos", () => {
    expect(getPrimaryNavigationLabel("/tarefas", "Hoje")).toBe("Atividades");
    expect(getPrimaryNavigationLabel("/cases", "Meus Processos")).toBe("Processos");
    expect(getPrimaryNavigationLabel("/processos", "Processos da Empresa")).toBe("Processos");
    expect(getPrimaryNavigationLabel("/documents", "Peças e documentos")).toBe("Documentos");
    expect(getPrimaryNavigationLabel("/report", "Relatórios")).toBe("Relatórios");
  });

  it("não duplica destinos nem altera o catálogo de ferramentas", () => {
    const before = available.map(item => item.href);
    const result = selectPrimaryNavigationItems([...available, available[1], available[5]]);
    expect(result).toHaveLength(6);
    expect(new Set(result.map(item => item.href)).size).toBe(result.length);
    expect(available.map(item => item.href)).toEqual(before);
    expect(available.some(item => item.href === "/hermes-3d")).toBe(true);
    expect(available.some(item => item.href === "/report")).toBe(true);
  });
});

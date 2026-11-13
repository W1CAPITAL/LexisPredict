import { describe, expect, it } from "vitest";
import { PRIMARY_NAV_ORDER, selectPrimaryNavigationItems } from "./primary-navigation";

describe("navegação operacional do LexisPredict", () => {
  const available = [
    { href: "/report", label: "Relatórios" },
    { href: "/whatsapp", label: "WhatsApp" },
    { href: "/processos", label: "Processos da Empresa" },
    { href: "/tarefas", label: "Hoje" },
    { href: "/cases", label: "Meus Processos" },
    { href: "/", label: "Início" },
    { href: "/vencidos", label: "Vencidos" },
    { href: "/hermes-3d", label: "Hermes" },
    { href: "/settings", label: "Configurações" },
  ];

  it("mantém no máximo seis atalhos prioritários com ordem estável", () => {
    expect(PRIMARY_NAV_ORDER).toEqual([
      "/", "/tarefas", "/vencidos", "/cases", "/processos", "/whatsapp",
    ]);
    const result = selectPrimaryNavigationItems(available);
    expect(result.map((item) => item.href)).toEqual([...PRIMARY_NAV_ORDER]);
  });

  it("não adiciona destinos não permitidos para o perfil/plano", () => {
    const scoped = available.filter((item) => !["/processos", "/vencidos"].includes(item.href));
    const result = selectPrimaryNavigationItems(scoped);
    expect(result.map((item) => item.href)).toEqual([
      "/", "/tarefas", "/cases", "/whatsapp",
    ]);
  });

  it("preserva os outros módulos para a Central de ferramentas", () => {
    const before = available.map((item) => item.href);
    const result = selectPrimaryNavigationItems(available);
    expect(result.some((item) => item.href === "/hermes-3d")).toBe(false);
    expect(available.map((item) => item.href)).toEqual(before);
    expect(available.some((item) => item.href === "/hermes-3d")).toBe(true);
    expect(available.some((item) => item.href === "/report")).toBe(true);
  });

  it("não duplica destinos mesmo quando a origem contém repetidos", () => {
    const result = selectPrimaryNavigationItems([...available, available[1]]);
    expect(result.filter((item) => item.href === "/whatsapp")).toHaveLength(1);
  });
});

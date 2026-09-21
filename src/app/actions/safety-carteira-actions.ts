"use server";

import { cookies } from "next/headers";
import { sheetsListProcessos } from "@/lib/hybrid/sheets-server";
import { sheetRowsToLegalCases } from "@/lib/hybrid/sheets-case-map";

export async function listSafetyCarteiraAction() {
  const jar = await cookies();
  const safety = jar.get("lexis_safety")?.value === "1";
  const listed = await sheetsListProcessos({ limit: 8000 });
  const cases = sheetRowsToLegalCases(listed.rows || []);
  const nome = decodeURIComponent(jar.get("lexis_safety_nome")?.value || "");
  const email = decodeURIComponent(jar.get("lexis_user_email")?.value || "");
  const cargo = decodeURIComponent(jar.get("lexis_user_role")?.value || "");
  const wide = /super|superv|admin/i.test(cargo);
  const comDono = cases.filter((c) => String(c.atendente || "").trim());
  let visible = cases;
  if (!wide && comDono.length > Math.max(20, cases.length * 0.3)) {
    const key = (nome.split(" ")[0] || email.split("@")[0] || "").toLowerCase();
    visible = cases.filter((c) => String(c.atendente || c.created_by || "").toLowerCase().includes(key));
    if (visible.length === 0) visible = cases;
  }
  return {
    ok: listed.ok,
    error: listed.error || "",
    totalPlanilha: cases.length,
    totalVisivel: visible.length,
    safety,
    nome,
    rows: visible,
  };
}

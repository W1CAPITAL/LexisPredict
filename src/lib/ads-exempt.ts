/** Superadmin e Supervisão não veem anúncio. Operador e Administrador veem. */
export function profileIsentaAnuncio(p: {
  cargo?: string | null;
  role?: string | null;
  perfil?: string | null;
  nome?: string | null;
} | null | undefined): boolean {
  const blob = [p?.cargo, p?.role, p?.perfil, p?.nome]
    .map((x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    .join(" ");
  return /\bsuperadmin\b|\bsuper-admin\b|\bsuper_admin\b|\bsupervisao\b|\bsupervisor\b/.test(
    ` ${blob} `
  );
}

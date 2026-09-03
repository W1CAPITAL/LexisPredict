"use server";

/**
 * Auto-encerrar via scan — desativado por política.
 * Mantém exports estáveis para imports existentes.
 */

export async function autoEncerrarSeAplicavelAction(_input?: {
  protocolo?: string;
  empresaId?: string;
}): Promise<{ success: boolean; skipped?: boolean; message?: string }> {
  return {
    success: true,
    skipped: true,
    message: "Auto-encerrar desativado.",
  };
}

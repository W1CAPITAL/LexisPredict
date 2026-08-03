/**
 * Catálogo legado desativado — scripts vêm do teor (suggest.ts).
 * Mantido só para não quebrar imports antigos.
 */
export type ScriptTemplate = {
  id: string;
  categoria: string;
  titulo: string;
  quandoUsar: string;
  texto: string;
  keywords?: string[];
  eventoTipos?: string[];
  prioridade?: number;
};

/** Vazio de propósito: ranking genérico foi substituído por análise do corpus. */
export const SCRIPT_CATALOG: ScriptTemplate[] = [];

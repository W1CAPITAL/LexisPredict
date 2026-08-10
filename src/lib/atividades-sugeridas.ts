/**
 * Checklist leve de atividades a partir dos sinais do caso.
 * Sem tabela nova obrigatória — pode ser só UI derivada.
 */
import type { LegalCase } from './case-logic';
import { traduzirCaso, labelAtividade, type AtividadeTipo } from './traduzir-andamento';

export type AtividadeItem = {
  tipo: AtividadeTipo;
  label: string;
  done?: boolean;
};

export function sugerirAtividades(c: LegalCase): AtividadeItem[] {
  const t = traduzirCaso(c);
  return t.atividadesSugeridas.map((tipo) => ({
    tipo,
    label: labelAtividade(tipo),
    done: false,
  }));
}

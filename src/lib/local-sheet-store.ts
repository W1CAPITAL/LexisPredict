/**
 * Modo planilha LOCAL (opcional) — inspirado em CRM offline, sem exigir Supabase.
 * Desligado por padrão. Não substitui o fluxo produção (fetchRepoCases / sync).
 *
 * Persistência: localStorage apenas.
 */
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type LocalSheetRow = {
  id: string;
  protocolo: string;
  cliente: string;
  telefone: string;
  tribunal: string;
  status: string;
  escritorio: string;
  advogado: string;
  ultimo_retorno: string;
  proximo_prazo: string;
  evento_tipo: string;
  evento_resumo: string;
  observacoes: string;
  /** campos extras da planilha original */
  extra?: Record<string, string>;
};

type LocalSheetState = {
  enabled: boolean;
  sourceName: string | null;
  loadedAt: string | null;
  rows: LocalSheetRow[];
  setEnabled: (v: boolean) => void;
  setFromMatrix: (matrix: string[][], sourceName?: string) => { ok: boolean; message: string; count: number };
  updateCell: (id: string, key: keyof LocalSheetRow | string, value: string) => void;
  addRow: () => void;
  removeRow: (id: string) => void;
  clear: () => void;
  toMatrix: () => string[][];
};

const HEADERS = [
  'Protocolo',
  'Cliente',
  'Telefone',
  'Tribunal',
  'Status',
  'Escritorio',
  'Advogado',
  'Ultimo_Retorno',
  'Proximo_Prazo',
  'Evento_Tipo',
  'Evento_Resumo',
  'Observacoes',
];

function uid() {
  return `local_${Date.now()}_${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36))}`;
}

function norm(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mapHeaderIndex(headers: string[]) {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    if (/protocolo|cnj|processo|numero/.test(n)) idx.protocolo = i;
    else if (/cliente|nome|parte/.test(n)) idx.cliente = i;
    else if (/telefone|celular|whatsapp|fone/.test(n)) idx.telefone = i;
    else if (/tribunal|tj/.test(n)) idx.tribunal = i;
    else if (/status|situacao/.test(n)) idx.status = i;
    else if (/escritorio|unidade/.test(n)) idx.escritorio = i;
    else if (/advogado|adv/.test(n)) idx.advogado = i;
    else if (/ultimo.?retorno|retorno/.test(n)) idx.ultimo_retorno = i;
    else if (/proximo.?prazo|prazo/.test(n)) idx.proximo_prazo = i;
    else if (/evento.?tipo|tipo.?evento/.test(n)) idx.evento_tipo = i;
    else if (/evento.?resumo|resumo|andamento/.test(n)) idx.evento_resumo = i;
    else if (/observa|obs/.test(n)) idx.observacoes = i;
  });
  return idx;
}

export const useLocalSheetStore = create<LocalSheetState>()(
  persist(
    (set, get) => ({
      enabled: false,
      sourceName: null,
      loadedAt: null,
      rows: [],

      setEnabled: (v) => set({ enabled: v }),

      setFromMatrix: (matrix, sourceName) => {
        if (!matrix?.length) {
          return { ok: false, message: 'Planilha vazia', count: 0 };
        }
        const headers = matrix[0].map(String);
        const map = mapHeaderIndex(headers);
        if (map.protocolo === undefined) {
          return { ok: false, message: 'Coluna Protocolo/CNJ obrigatória', count: 0 };
        }
        const rows: LocalSheetRow[] = [];
        for (let i = 1; i < matrix.length; i++) {
          const line = matrix[i];
          const protocolo = String(line[map.protocolo] || '').trim();
          if (!protocolo) continue;
          const get = (k: string) =>
            map[k] !== undefined ? String(line[map[k]] ?? '').trim() : '';
          rows.push({
            id: uid(),
            protocolo,
            cliente: get('cliente'),
            telefone: get('telefone'),
            tribunal: get('tribunal'),
            status: get('status'),
            escritorio: get('escritorio'),
            advogado: get('advogado'),
            ultimo_retorno: get('ultimo_retorno'),
            proximo_prazo: get('proximo_prazo'),
            evento_tipo: get('evento_tipo'),
            evento_resumo: get('evento_resumo'),
            observacoes: get('observacoes'),
          });
        }
        if (!rows.length) {
          return { ok: false, message: 'Nenhuma linha com protocolo', count: 0 };
        }
        set({
          rows,
          sourceName: sourceName || 'planilha',
          loadedAt: new Date().toISOString(),
          enabled: true,
        });
        return { ok: true, message: `${rows.length} linhas carregadas (modo local)`, count: rows.length };
      },

      updateCell: (id, key, value) => {
        set((s) => ({
          rows: s.rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
        }));
      },

      addRow: () => {
        set((s) => ({
          rows: [
            ...s.rows,
            {
              id: uid(),
              protocolo: '',
              cliente: '',
              telefone: '',
              tribunal: '',
              status: '',
              escritorio: '',
              advogado: '',
              ultimo_retorno: '',
              proximo_prazo: '',
              evento_tipo: '',
              evento_resumo: '',
              observacoes: '',
            },
          ],
          enabled: true,
        }));
      },

      removeRow: (id) => set((s) => ({ rows: s.rows.filter((r) => r.id !== id) })),

      clear: () =>
        set({ rows: [], sourceName: null, loadedAt: null, enabled: false }),

      toMatrix: () => {
        const rows = get().rows;
        return [
          HEADERS,
          ...rows.map((r) => [
            r.protocolo,
            r.cliente,
            r.telefone,
            r.tribunal,
            r.status,
            r.escritorio,
            r.advogado,
            r.ultimo_retorno,
            r.proximo_prazo,
            r.evento_tipo,
            r.evento_resumo,
            r.observacoes,
          ]),
        ];
      },
    }),
    {
      name: 'lexis-local-sheet-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        enabled: s.enabled,
        sourceName: s.sourceName,
        loadedAt: s.loadedAt,
        rows: s.rows,
      }),
    }
  )
);

/** Converte linhas locais → formato parecido com LegalCase (só para UI/export local) */
export function localRowsAsCases(rows: LocalSheetRow[]) {
  return rows.map((r) => ({
    protocolo: r.protocolo,
    cliente: r.cliente,
    telefone: r.telefone,
    tribunal: r.tribunal,
    status: r.status || 'Sem Prazo',
    escritorio: r.escritorio,
    advogado: r.advogado,
    ultimoRetorno: r.ultimo_retorno,
    proximoRetorno: r.proximo_prazo,
    evento_tipo: r.evento_tipo,
    evento_resumo: r.evento_resumo,
    observacao: r.observacoes,
    tem_novo_andamento: false,
    tem_atualizacao_pos_retorno: false,
    datajud_encerrado_tribunal: false,
    indicio_busca_apreensao: false,
    em_cumprimento_sentenca: /cumprimento/i.test(r.evento_tipo + r.evento_resumo),
  }));
}

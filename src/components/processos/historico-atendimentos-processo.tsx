'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getHistoricoAtendimentoProcessoAction,
  type HistoricoAtendimentoProcessoResultado,
} from '@/app/actions/historico-atendimento-processo-action';

function dataLegivel(raw: string): string {
  if (!raw) return 'Data não informada';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw))
    return raw.slice(8, 10) + '/' + raw.slice(5, 7) + '/' + raw.slice(0, 4);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 'Data não informada' :
    date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AtendimentosProcessoHistorico({ processId, cnj }: {
  processId: string; cnj: string;
}) {
  const [result, setResult] = useState<HistoricoAtendimentoProcessoResultado | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision(v => v + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResult(null);
    getHistoricoAtendimentoProcessoAction(processId, cnj)
      .then(data => { if (active) setResult(data); })
      .catch(() => { if (active) setResult({ ok: false, items: [], partial: false, message: 'Não foi possível consultar o histórico.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [processId, cnj, revision]);

  return (
    <div data-lexis-atendimentos-processo className="space-y-2 rounded-lg border border-border/70 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold">Histórico de atendimentos</h3>
        <button type="button" disabled={loading} onClick={reload}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground disabled:opacity-50">
          Atualizar
        </button>
      </div>
      {loading ? <p role="status" className="text-xs text-muted-foreground">Consultando atendimentos deste processo…</p> : null}
      {result?.message ? <p role={result.ok ? 'status' : 'alert'} className="text-xs text-muted-foreground">{result.message}</p> : null}
      {!loading && result?.items?.length ? (
        <ol className="space-y-2">
          {result.items.map(item => (
            <li key={item.id} className="rounded-md border border-border/60 p-2">
              <div className="flex flex-wrap justify-between gap-1">
                <strong className="text-xs text-foreground">{item.titulo}</strong>
                <time className="text-[11px] text-muted-foreground">{dataLegivel(item.data)}</time>
              </div>
              {item.descricao ? <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">{item.descricao}</p> : null}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {item.responsavel} · {item.origem === 'auditoria' ? 'Registro no Lexis' :
                  item.contatoConfirmado ? 'Contato confirmado' : 'Atividade registrada'}
              </p>
              {item.proximoRetorno ? <p className="mt-1 text-[11px] text-muted-foreground">Próximo retorno informado: {dataLegivel(item.proximoRetorno)}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        Registros internos disponíveis. Não equivalem ao histórico de movimentações do tribunal.
      </p>
    </div>
  );
}

"use client";

import {
  applyBrowserDjenResultAction,
  scanSingleCaseAction,
} from "@/app/actions/case-actions";
import { djenBuscaProcesso, type DjenClientResult } from "@/lib/djen-client";
import { fetchDataJudDirectBrowser } from "@/lib/datajud-browser-client";

export type InteractiveScanMode = "datajud" | "djen" | "both";

export type InteractiveScanSourceStatus = {
  requested: boolean;
  ok: boolean;
  via?: "browser" | "server";
  error?: string | null;
  empty?: boolean;
};

export type InteractiveScanResult = {
  success: boolean;
  offline: boolean;
  partial: boolean;
  error?: string;
  message?: string;
  case?: any;
  casePatch?: Record<string, any>;
  movimentos: any[];
  comunicacoes: any[];
  sourceStatus: {
    datajud: InteractiveScanSourceStatus;
    djen: InteractiveScanSourceStatus;
  };
};

function mergeCasePatch(...patches: Array<Record<string, any> | null | undefined>) {
  return Object.assign({}, ...patches.filter(Boolean));
}

/**
 * Scanner interativo:
 * - DataJud: navegador primeiro quando CORS é permitido; servidor como fallback
 * - DJEN: navegador primeiro (IP do usuário), servidor como fallback
 * - HTTP 429 não provoca novo ataque à mesma fonte via servidor
 * - leitura DataJud no navegador é exibida, mas não salva como prova auditada
 * - zero resultados válidos NÃO é considerado offline
 */
export async function scanInteractiveCase(
  protocolo: string,
  options: {
    mode?: InteractiveScanMode;
    fast?: boolean;
    cloudBudget?: boolean;
    useClaudeAi?: boolean;
    dataInicioDjen?: string;
  } = {}
): Promise<InteractiveScanResult> {
  const mode = options.mode || "both";
  const wantsDataJud = mode === "datajud" || mode === "both";
  const wantsDjen = mode === "djen" || mode === "both";

  // Ambas as consultas públicas são iniciadas no navegador do operador.
  // Se a API DataJud não liberar CORS/preflight, o servidor autentica e
  // consulta pelo caminho habitual, sem expor chaves privadas ao cliente.
  const [datajudBrowser, djenClient] = await Promise.all([
    wantsDataJud
      ? fetchDataJudDirectBrowser(protocolo, { fast: options.fast === true })
      : Promise.resolve(null),
    wantsDjen
      ? djenBuscaProcesso({
          protocolo,
          dataInicio: options.dataInicioDjen,
          fast: options.fast === true,
        })
      : Promise.resolve(null),
  ]);

  let datajudResult: any = null;
  if (wantsDataJud && !datajudBrowser?.ok && datajudBrowser?.reason !== "rate_limited") {
    try {
      datajudResult = await scanSingleCaseAction(protocolo, {
        mode: "datajud",
        fast: options.fast === true,
        cloudBudget: options.cloudBudget === true,
        useClaudeAi: options.useClaudeAi === true,
      });
    } catch {
      datajudResult = {
        offline: true,
        error: "Consulta DataJud pelo servidor não pôde ser concluída.",
        sourceStatus: { datajud: { requested: true, ok: false } },
        movimentos: [],
      };
    }
  }

  let djenPersisted: any = null;
  let djenFallback: any = null;

  if (wantsDjen && djenClient?.ok) {
    djenPersisted = await applyBrowserDjenResultAction(protocolo, {
      items: djenClient.items,
      count: djenClient.count,
    });
  } else if (wantsDjen) {
    djenFallback = await scanSingleCaseAction(protocolo, {
      mode: "djen",
      fast: options.fast === true,
      cloudBudget: options.cloudBudget === true,
      useClaudeAi: false,
    });
  }

  const datajudBrowserOk = !!(wantsDataJud && datajudBrowser?.ok && datajudBrowser.found);
  const datajudServerOk =
    !!(wantsDataJud && !datajudBrowserOk &&
      datajudResult?.sourceStatus?.datajud?.ok === true &&
      datajudResult?.offline !== true);
  const datajudOk = !wantsDataJud || datajudBrowserOk || datajudServerOk;

  const djenBrowserOk =
    !!(wantsDjen && djenClient?.ok && djenPersisted?.success === true);

  const djenServerOk =
    !!(
      wantsDjen &&
      !djenBrowserOk &&
      djenFallback?.sourceStatus?.djen?.ok === true &&
      djenFallback?.offline !== true
    );

  const djenOk = !wantsDjen || djenBrowserOk || djenServerOk;

  const movimentos = datajudBrowserOk
    ? Array.isArray(datajudBrowser?.movimentos) ? datajudBrowser.movimentos : []
    : Array.isArray(datajudResult?.movimentos) ? datajudResult.movimentos : [];

  const comunicacoes = djenBrowserOk
    ? Array.isArray(djenPersisted?.comunicacoes)
      ? djenPersisted.comunicacoes
      : []
    : Array.isArray(djenFallback?.comunicacoes)
      ? djenFallback.comunicacoes
      : [];

  const casePatch = mergeCasePatch(
    datajudResult?.casePatch,
    djenBrowserOk ? djenPersisted?.casePatch : djenFallback?.casePatch
  );

  const caseData =
    (djenBrowserOk ? djenPersisted?.case : djenFallback?.case) ||
    datajudResult?.case ||
    null;

  const requestedOk = datajudOk && djenOk;
  const atLeastOneRequestedSourceOk =
    (wantsDataJud && datajudOk) || (wantsDjen && djenOk);

  const datajudError =
    wantsDataJud && !datajudOk
      ? [
          datajudBrowser?.error,
          datajudResult?.error || datajudResult?.message,
        ].filter(Boolean).map(String).join(" · ") || "DataJud indisponível nesta tentativa."
      : null;

  const djenError =
    wantsDjen && !djenOk
      ? String(
          djenClient?.error ||
            djenFallback?.error ||
            djenFallback?.message ||
            "DJEN indisponível nesta tentativa."
        )
      : null;

  const statusParts: string[] = [];

  if (wantsDataJud) {
    statusParts.push(
      datajudOk
        ? movimentos.length
          ? `DataJud: ${movimentos.length} movimento(s)${datajudBrowserOk ? " (navegador; não salvo)" : ""}`
          : `DataJud: consulta concluída, sem movimento novo${datajudBrowserOk ? " (navegador; não salvo)" : ""}`
        : "DataJud: indisponível"
    );
  }

  if (wantsDjen) {
    statusParts.push(
      djenOk
        ? comunicacoes.length
          ? `DJEN: ${comunicacoes.length} publicação(ões)`
          : "DJEN: consulta concluída, sem publicação no período"
        : "DJEN: indisponível"
    );
  }

  return {
    success: atLeastOneRequestedSourceOk,
    offline: !atLeastOneRequestedSourceOk,
    partial: atLeastOneRequestedSourceOk && !requestedOk,
    error:
      !atLeastOneRequestedSourceOk
        ? [datajudError, djenError].filter(Boolean).join(" · ")
        : undefined,
    message: statusParts.join(" · "),
    case: caseData,
    casePatch,
    movimentos,
    comunicacoes,
    sourceStatus: {
      datajud: {
        requested: wantsDataJud,
        ok: datajudOk,
        via: datajudBrowserOk ? "browser" : datajudServerOk ? "server" : undefined,
        error: datajudError,
        empty: wantsDataJud && datajudOk && movimentos.length === 0,
      },
      djen: {
        requested: wantsDjen,
        ok: djenOk,
        via: djenBrowserOk ? "browser" : djenServerOk ? "server" : undefined,
        error: djenError,
        empty: wantsDjen && djenOk && comunicacoes.length === 0,
      },
    },
  };
}

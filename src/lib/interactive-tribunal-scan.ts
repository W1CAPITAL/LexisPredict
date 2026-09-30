"use client";

import {
  applyBrowserDjenResultAction,
  scanSingleCaseAction,
} from "@/app/actions/case-actions";
import { djenBuscaProcesso, type DjenClientResult } from "@/lib/djen-client";

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
 * - DataJud: servidor
 * - DJEN: navegador primeiro (IP do usuário), servidor como fallback
 * - zero resultados válidos NÃO é considerado offline
 */
export async function scanInteractiveCase(
  protocolo: string,
  options: {
    mode?: InteractiveScanMode;
    fast?: boolean;
    useClaudeAi?: boolean;
    dataInicioDjen?: string;
  } = {}
): Promise<InteractiveScanResult> {
  const mode = options.mode || "both";
  const wantsDataJud = mode === "datajud" || mode === "both";
  const wantsDjen = mode === "djen" || mode === "both";

  const datajudPromise: Promise<any | null> = wantsDataJud
    ? scanSingleCaseAction(protocolo, {
        mode: "datajud",
        fast: options.fast === true,
        useClaudeAi: options.useClaudeAi === true,
      })
    : Promise.resolve(null);

  const djenPromise: Promise<DjenClientResult | null> = wantsDjen
    ? djenBuscaProcesso({
        protocolo,
        dataInicio: options.dataInicioDjen,
      })
    : Promise.resolve(null);

  const [datajudResult, djenClient] = await Promise.all([
    datajudPromise,
    djenPromise,
  ]);

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
      fast: false,
      useClaudeAi: false,
    });
  }

  const datajudOk =
    !wantsDataJud ||
    (datajudResult?.sourceStatus?.datajud?.ok === true &&
      datajudResult?.offline !== true);

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

  const movimentos = Array.isArray(datajudResult?.movimentos)
    ? datajudResult.movimentos
    : [];

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
      ? String(
          datajudResult?.error ||
            datajudResult?.message ||
            "DataJud indisponível nesta tentativa."
        )
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
          ? `DataJud: ${movimentos.length} movimento(s)`
          : "DataJud: consulta concluída, sem movimento novo"
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
        via: wantsDataJud ? "server" : undefined,
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

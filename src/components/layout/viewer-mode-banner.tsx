"use client";
/**
 * Faixa fixa + bloqueio de cópia/seleção para perfil Visualizador.
 */
import React, { useEffect } from "react";
import { Eye, Ban, Download, ScanSearch } from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import {
  VIEWER_COPY_BLOCK_MSG,
  VIEWER_DOWNLOAD_BLOCK_MSG,
  VIEWER_SCAN_BLOCK_MSG,
} from "@/lib/viewer-mode";
import { cn } from "@/lib/utils";

export function ViewerModeBanner() {
  const { isViewer } = useAdmin();

  useEffect(() => {
    if (!isViewer || typeof document === "undefined") return;

    document.documentElement.classList.add("lexis-viewer-mode");
    document.body.classList.add("lexis-viewer-mode");

    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      try {
        window.dispatchEvent(
          new CustomEvent("lexis-viewer-block", { detail: VIEWER_COPY_BLOCK_MSG })
        );
      } catch {}
    };
    const blockContext = (e: MouseEvent) => {
      // permite inputs/textarea para editar cadastro
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
    };
    const blockSelectStart = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
    };

    // Patch clipboard.writeText
    const nav = navigator as any;
    const originalWrite = nav.clipboard?.writeText?.bind(nav.clipboard);
    if (nav.clipboard && originalWrite) {
      nav.clipboard.writeText = async () => {
        throw new Error(VIEWER_COPY_BLOCK_MSG);
      };
    }

    document.addEventListener("copy", blockCopy, true);
    document.addEventListener("cut", blockCopy, true);
    document.addEventListener("contextmenu", blockContext, true);
    document.addEventListener("selectstart", blockSelectStart, true);

    return () => {
      document.documentElement.classList.remove("lexis-viewer-mode");
      document.body.classList.remove("lexis-viewer-mode");
      document.removeEventListener("copy", blockCopy, true);
      document.removeEventListener("cut", blockCopy, true);
      document.removeEventListener("contextmenu", blockContext, true);
      document.removeEventListener("selectstart", blockSelectStart, true);
      if (nav.clipboard && originalWrite) {
        nav.clipboard.writeText = originalWrite;
      }
    };
  }, [isViewer]);

  if (!isViewer) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "sticky top-0 z-[100] w-full border-b border-amber-500/40",
        "bg-amber-50 text-amber-950 dark:bg-amber-950/90 dark:text-amber-50",
        "px-3 py-2.5 shadow-sm"
      )}
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
            <Eye className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-[11px] font-black uppercase tracking-widest">
              Modo visualização ativo
            </p>
            <p className="text-[11px] leading-snug text-amber-900/80 dark:text-amber-100/80">
              Você pode <strong>ver todos os processos da empresa</strong>, cadastrar e editar nas abas.
              Não é permitido <strong>copiar</strong>, <strong>baixar/exportar</strong> nem usar o{" "}
              <strong>scanner tribunal</strong>.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-0">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/60 dark:bg-black/30 px-2 py-1 text-[9px] font-bold uppercase tracking-wide">
            <Ban className="h-3 w-3" /> Sem cópia
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/60 dark:bg-black/30 px-2 py-1 text-[9px] font-bold uppercase tracking-wide">
            <Download className="h-3 w-3" /> Sem download
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/60 dark:bg-black/30 px-2 py-1 text-[9px] font-bold uppercase tracking-wide">
            <ScanSearch className="h-3 w-3" /> Sem scanner
          </span>
        </div>
      </div>
    </div>
  );
}

/** Toast helper when blocked actions are attempted */
export function useViewerGuard() {
  const { isViewer, canCopy, canExport, canScan } = useAdmin();
  return {
    isViewer,
    canCopy,
    canExport,
    canScan,
    copyBlockedMsg: VIEWER_COPY_BLOCK_MSG,
    downloadBlockedMsg: VIEWER_DOWNLOAD_BLOCK_MSG,
    scanBlockedMsg: VIEWER_SCAN_BLOCK_MSG,
  };
}

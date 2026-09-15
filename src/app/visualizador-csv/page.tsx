"use client";

import { FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { LocalCsvViewer } from "@/components/csv/local-csv-viewer";

export default function VisualizadorCsvPage() {
  return <div className="flex min-h-dvh bg-background"><Sidebar /><main className="min-w-0 flex-1 px-4 pb-10 pt-20 md:px-8 md:pt-20"><div className="mx-auto flex max-w-7xl flex-col gap-6"><header className="flex flex-col gap-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><FileSpreadsheet /> Ferramentas locais</div><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Visualizador de CSV grande</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Abra e inspecione CSVs de até vários gigabytes diretamente no navegador, sem importar linhas para o banco de dados do LexisPredict.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="text-primary" /> Privacidade local: o arquivo não sai do dispositivo.</div></header><LocalCsvViewer /></div></main></div>;
}

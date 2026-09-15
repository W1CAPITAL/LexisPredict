import { LocalDbViewer } from "@/components/db/local-db-viewer";

export default function VisualizadorDbPage() {
  return <main className="min-h-dvh bg-background px-4 pb-10 pt-20 md:pl-72 md:pt-8"><div className="mx-auto w-full max-w-7xl"><div className="mb-6"><p className="text-sm font-medium text-primary">Ferramentas locais</p><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Visualizador de arquivos DB</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Inspecione uma cópia local de SQLite sem persistência, upload ou conexão com o banco do LexisPredict.</p></div><LocalDbViewer /></div></main>;
}

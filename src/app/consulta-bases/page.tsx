import { ConsultaBases } from "@/components/consulta-bases/consulta-bases";

export default function ConsultaBasesPage() {
  return <main className="min-h-dvh bg-background px-4 pb-10 pt-20 md:pl-72 md:pt-8">
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">Ferramentas locais</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Consulta de bases</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Consulte DETRAN e Credilink por nome, CPF ou telefone, com resultados separados e exportação em planilha CSV.</p>
      </div>
      <ConsultaBases />
    </div>
  </main>;
}

/**
 * Snippet de integração Plano B — não é rota.
 * Use o conteúdo em src/app/plano-b ou import.
 */
"use client";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ImportPlanoBCard() {
  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Plano B · planilha
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-2">
        <p>Importar CSV/Sheets e usar como contingência da carteira.</p>
        <Link href="/plano-b" className="text-primary font-bold underline">
          Abrir Plano B
        </Link>
      </CardContent>
    </Card>
  );
}
export default ImportPlanoBCard;

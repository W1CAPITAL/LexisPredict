{/* === COLAR NA PÁGINA DE INGESTÃO / IMPORT (src/app/import/page.tsx) ===
    Coloque no topo do conteúdo principal, antes do upload CSV → Supabase.
    Imports necessários:
      import Link from "next/link";
      import { FileSpreadsheet } from "lucide-react";
*/}

              <Card className="border-2 border-emerald-500/40 bg-emerald-500/5 mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <FileSpreadsheet size={18} />
                    Plano B · Carteira em planilha
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-[12px] text-muted-foreground">
                  <p>
                    Operação pela planilha Google / XLSX (leitura e busca), <strong>sem gravar no banco</strong>.
                    Use quando precisar consultar a carteira fora do fluxo normal de ingestão.
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      <strong>Upload XLSX/CSV</strong> na tela Plano B (recomendado se o link der HTTP 400).
                    </li>
                    <li>
                      Ou no Google Sheets: <strong>Arquivo → Compartilhar → Publicar na web</strong> → aba Processos →{" "}
                      <strong>CSV</strong> (isso é diferente de “Qualquer pessoa com o link”).
                    </li>
                  </ul>
                  <Link
                    href="/plano-b"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-[11px] font-black uppercase tracking-wide text-white hover:bg-emerald-600"
                  >
                    Abrir Plano B · Planilha
                  </Link>
                </CardContent>
              </Card>

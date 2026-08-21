"use client";

import Link from "next/link";
import { ArrowLeft, Monitor, Shield, Zap, KeyRound, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXE_URL =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DESKTOP_EXE_URL?.trim()) ||
  "";

export default function DesktopPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1.5" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao gabinete
          </Link>
        </Button>

        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Lexis Gabinete Desktop
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Programa no Windows, chaves no servidor
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          O EXE abre o mesmo gabinete de produção em janela própria, com
          aceleração da GPU. Login igual ao do site. Não há .env nem cópia de
          variável Sensitive.
        </p>

        {EXE_URL ? (
          <div className="mt-6">
            <Button size="lg" className="gap-2 font-semibold" asChild>
              <a href={EXE_URL} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Baixar Lexis Gabinete (Windows)
              </a>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Arquivo ZIP · extraia a pasta inteira e abra Lexis Gabinete.exe
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            O link de download ainda não foi publicado. Configure no Vercel a
            variável{" "}
            <code className="rounded bg-muted px-1 text-xs text-foreground">
              NEXT_PUBLIC_DESKTOP_EXE_URL
            </code>{" "}
            com o endereço do ZIP (GitHub Releases recomendado).
          </div>
        )}

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border border-border bg-card p-4">
            <Zap className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Mais rápido</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              GPU local, cache de sessão, sem extensões do navegador.
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-4">
            <Shield className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Mesma segurança</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Evolution, Supabase e DataJud só no Vercel.
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-4">
            <KeyRound className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Sem copiar env</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Sensitive no Vercel não volta por API — e não precisa.
            </p>
          </li>
        </ul>

        <section className="mt-10 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Depois de baixar</h2>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Extraia o ZIP — mantenha a pasta inteira (DLLs + resources).</li>
            <li>
              Abra <span className="font-medium text-foreground">Lexis Gabinete.exe</span>.
            </li>
            <li>Entre com o mesmo usuário do site.</li>
            <li>Opcional: pin na barra de tarefas.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}

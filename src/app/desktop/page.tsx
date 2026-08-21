"use client";

/**
 * Página de instalação do Lexis Gabinete Desktop (EXE).
 * Sem chaves no computador — só a janela nativa sobre a produção.
 */
import Link from "next/link";
import { ArrowLeft, Monitor, Shield, Zap, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DesktopPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5 -ml-2" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao gabinete
          </Link>
        </Button>

        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Lexis Gabinete Desktop
        </p>
        <h1 className="mt-2 font-semibold text-3xl tracking-tight sm:text-4xl">
          Programa no Windows, chaves no servidor
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          O EXE abre o mesmo gabinete de produção em janela própria, com
          aceleração da GPU desta máquina. Login igual ao do site. Não há arquivo
          .env nem cópia de variável Sensitive do Vercel.
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border border-border bg-card p-4">
            <Zap className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Mais rápido</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              GPU local, cache de sessão e sem extensões do navegador.
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-4">
            <Shield className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Mesma segurança</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Evolution, Supabase e DataJud só no Vercel.
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-4">
            <KeyRound className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Sem copiar env</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Sensitive no Vercel não pode ser lida de volta — e não precisa.
            </p>
          </li>
        </ul>

        <section className="mt-10 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Como instalar</h2>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              Peça ao administrador o pacote{" "}
              <span className="font-medium text-foreground">
                Lexis-Gabinete-Desktop-Windows
              </span>{" "}
              (ZIP ou partes + juntador).
            </li>
            <li>Extraia a pasta inteira — não mova só o .exe.</li>
            <li>
              Abra <span className="font-medium text-foreground">Lexis Gabinete.exe</span>.
            </li>
            <li>Entre com o mesmo usuário de sempre.</li>
            <li>Opcional: pin na barra de tarefas.</li>
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Atalho alternativo (sem runtime): Edge ou Chrome → menu →{" "}
            <span className="text-foreground">Instalar este site como aplicativo</span>.
          </p>
        </section>

        <p className="mt-8 text-xs text-muted-foreground leading-relaxed">
          Atualizações de Processos, WhatsApp, scripts e DataJud vêm do servidor.
          No desktop: Ctrl+R para recarregar.
        </p>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  CheckCircle2,
  FileText,
  ListTodo,
  Menu,
  MessageCircle,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/use-app-store";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";

const DAILY = [
  {
    n: "1",
    title: "Organize os retornos",
    desc: "Cases e Tarefas exibem uma única fila da empresa inteira: só retornos vencidos válidos ou previstos para hoje, por prioridade.",
    href: "/tarefas",
    cta: "Abrir fila da empresa",
    icon: ListTodo,
  },
  {
    n: "2",
    title: "Confira o processo",
    desc: "Use Processos para pesquisar a carteira completa por cliente ou CNJ e registrar o atendimento no cadastro.",
    href: "/processos",
    cta: "Pesquisar processos",
    icon: Briefcase,
  },
  {
    n: "3",
    title: "Deixe o Hermes acompanhar",
    desc: "Hermes verifica os retornos devidos e os processos parados automaticamente, sem confundir silêncio judicial com retorno vencido.",
    href: "/hermes-3d",
    cta: "Ver Hermes",
    icon: RefreshCw,
  },
];
const ADVANCED = [
  { title: "WhatsApp", desc: "Responder após conferir o histórico e registrar o atendimento.", href: "/whatsapp", icon: MessageCircle },
  { title: "Processos parados", desc: "Investigar ausência de movimentação judicial, mesmo sem retorno marcado.", href: "/processos-parados", icon: RefreshCw },
  { title: "Peças e documentos", desc: "Quando precisar gerar ou conferir uma peça.", href: "/documents", icon: FileText },
  { title: "Supervisão", desc: "Para acompanhar equipe e operação.", href: "/supervisao", icon: ShieldCheck },
  { title: "Configurações", desc: "Conta, equipe, assinatura e preferências.", href: "/settings", icon: Settings },
];

export default function OnboardingPage() {
  const { setTutorialActive, setTutorialStep } = useAppStore();
  const openScanner = useDataJudScanStore((state) => state.openScanner);

  const startGuide = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lexis-need-tour"));
    }
    setTutorialStep(0);
    setTutorialActive(true);
  };

  const startScanner = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lexis-need-scanner"));
    }
    openScanner();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf7f8] text-foreground">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-5 md:pb-8 md:pt-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <section className="rounded-3xl border border-[#e8dbe2] bg-white p-5 shadow-sm sm:p-7">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#763654]">
              Primeiro acesso
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-[#342031]">
              Aprenda o Lexis em 3 minutos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#615361]">
              Você não precisa decorar todas as telas. Para trabalhar no dia a dia,
              lembre só desta sequência: <strong>Fila da empresa → Conferir o processo → Registrar o atendimento</strong>.
              O Hermes acompanha automaticamente os processos parados e os retornos válidos; o botão <strong>Atualizar</strong> permite nova consulta manual.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={startGuide} className="h-11 rounded-xl px-5 font-bold">
                <BookOpen className="mr-2 h-4 w-4" />
                Guia rápido de 5 passos
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl px-5 font-bold">
                <Link href="/tarefas">Começar a trabalhar</Link>
              </Button>
            </div>
          </section>

          <section className="mt-5 grid gap-3 md:grid-cols-3">
            {DAILY.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.n} className="rounded-2xl border border-[#e8dbe2] bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#763654] text-sm font-black text-white">
                      {item.n}
                    </span>
                    <Icon className="h-5 w-5 text-[#763654]" />
                  </div>
                  <h2 className="mt-4 text-lg font-black text-[#342031]">{item.title}</h2>
                  <p className="mt-2 min-h-[44px] text-[13px] leading-relaxed text-[#615361]">{item.desc}</p>
                  <Button asChild variant="secondary" className="mt-4 h-10 w-full rounded-xl font-bold">
                    <Link href={item.href}>{item.cta}</Link>
                  </Button>
                </article>
              );
            })}
          </section>

          <section className="mt-5 rounded-2xl border border-[#caa9ba] bg-[#f7edf2] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#763654] shadow-sm">
                  <RefreshCw className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-black text-[#342031]">Quando usar “Atualizar”?</h2>
                  <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[#6f5064]">
                    Para pedir uma consulta manual adicional ao DataJud/DJEN. O Hermes monitora automaticamente
                    processos parados, mas uma consulta parcial nunca equivale a ausência confirmada de movimentação.
                  </p>
                </div>
              </div>
              <Button onClick={startScanner} className="h-11 shrink-0 rounded-xl font-bold">
                Testar Atualizar
              </Button>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-[#e8dbe2] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <Menu className="mt-0.5 h-5 w-5 shrink-0 text-[#763654]" />
              <div>
                <h2 className="font-black text-[#342031]">E todas as outras ferramentas?</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[#615361]">
                  Elas continuam disponíveis em <strong>Menu</strong>, mas não precisam ser
                  aprendidas no primeiro dia. Abra só quando o trabalho pedir.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {ADVANCED.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-16 items-center gap-3 rounded-xl border border-[#e5d8df] px-3 py-3 transition hover:bg-[#f9f3f6]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7edf2] text-[#763654]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[#542d42]">{item.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[#745c6b]">{item.desc}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <h2 className="font-black text-emerald-950">Regra simples</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-emerald-900/80">
                  Veja apenas os retornos vencidos válidos ou de hoje na fila de toda a empresa.
                  Um processo parado não é, por si só, retorno vencido. Consulte o Hermes, confira o histórico e registre cada contato real.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

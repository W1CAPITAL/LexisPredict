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
    title: "Veja quem precisa de você",
    desc: "Abra Tarefas. Essa é a fila do dia: novidades, atrasos e retornos.",
    href: "/tarefas",
    cta: "Abrir Tarefas",
    icon: ListTodo,
  },
  {
    n: "2",
    title: "Ache o processo",
    desc: "Use Processos para buscar cliente ou CNJ e abrir o histórico.",
    href: "/cases",
    cta: "Abrir Processos",
    icon: Briefcase,
  },
  {
    n: "3",
    title: "Fale com o cliente",
    desc: "Use WhatsApp para conversar sem sair do LexisPredict.",
    href: "/whatsapp",
    cta: "Abrir WhatsApp",
    icon: MessageCircle,
  },
];

const ADVANCED = [
  { title: "Peças e documentos", desc: "Quando precisar gerar uma peça.", href: "/documents", icon: FileText },
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
    <div className="flex h-screen overflow-hidden bg-[#f5f8fc] text-foreground">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-5 md:pb-8 md:pt-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <section className="rounded-3xl border border-[#dce6f3] bg-white p-5 shadow-sm sm:p-7">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#1769ff]">
              Primeiro acesso
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-[#102447]">
              Aprenda o Lexis em 3 minutos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#617693]">
              Você não precisa decorar todas as telas. Para trabalhar no dia a dia,
              lembre só desta sequência: <strong>Tarefas → Processo → WhatsApp</strong>.
              O botão <strong>Atualizar</strong> consulta tribunal quando precisar.
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
                <article key={item.n} className="rounded-2xl border border-[#dce6f3] bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769ff] text-sm font-black text-white">
                      {item.n}
                    </span>
                    <Icon className="h-5 w-5 text-[#1769ff]" />
                  </div>
                  <h2 className="mt-4 text-lg font-black text-[#102447]">{item.title}</h2>
                  <p className="mt-2 min-h-[44px] text-[13px] leading-relaxed text-[#617693]">{item.desc}</p>
                  <Button asChild variant="secondary" className="mt-4 h-10 w-full rounded-xl font-bold">
                    <Link href={item.href}>{item.cta}</Link>
                  </Button>
                </article>
              );
            })}
          </section>

          <section className="mt-5 rounded-2xl border border-[#bfd4ff] bg-[#eef5ff] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1769ff] shadow-sm">
                  <RefreshCw className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-black text-[#102447]">Quando usar “Atualizar”?</h2>
                  <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[#526f95]">
                    Quando quiser buscar movimentações novas no DataJud/DJEN. Não precisa
                    deixar scanner rodando nem conhecer detalhes técnicos para atender.
                  </p>
                </div>
              </div>
              <Button onClick={startScanner} className="h-11 shrink-0 rounded-xl font-bold">
                Testar Atualizar
              </Button>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-[#dce6f3] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <Menu className="mt-0.5 h-5 w-5 shrink-0 text-[#1769ff]" />
              <div>
                <h2 className="font-black text-[#102447]">E todas as outras ferramentas?</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[#617693]">
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
                    className="flex min-h-16 items-center gap-3 rounded-xl border border-[#e1e8f2] px-3 py-3 transition hover:bg-[#f6f9fd]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef5ff] text-[#1769ff]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[#25466f]">{item.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[#71839c]">{item.desc}</span>
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
                  Se você consegue abrir Tarefas, encontrar um Processo, atualizar o tribunal
                  e falar pelo WhatsApp, já consegue operar o básico do LexisPredict.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

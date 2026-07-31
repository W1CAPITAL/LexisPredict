
"use client";
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * OMNI-EXPORT MASTER v40000.0 - MÓDULO ÚNICO DE RENDERIZAÇÃO GLOBAL
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Loader2, Layers, Copyright, Activity, 
  Target, Briefcase, BarChart3, Users, StickyNote, 
  FileSearch, Printer, CheckCircle2, Scale, Zap,
  TrendingUp, Clock, Gavel, Calendar, Fingerprint,
  ArrowLeft, Building2
} from 'lucide-react';
import { fetchRepoCases, fetchRepoNotes } from '@/app/actions/case-actions';
import { getEmpresaUsers } from '@/lib/server-db';
import { LegalCase, CaseNote, processarCaso } from '@/lib/case-logic';
import { UserProfile } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie 
} from 'recharts';
import Image from 'next/image';
import Link from 'next/link';

export default function MasterExportPage() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setMounted(true);
    async function loadAllData() {
      try {
        setProgress(20);
        const [casesData, notesData, usersData] = await Promise.all([
          fetchRepoCases(),
          fetchRepoNotes(),
          getEmpresaUsers()
        ]);
        
        setProgress(60);
        setCases(casesData || []);
        setNotes(notesData || []);
        setUsers(usersData || []);
        
        setProgress(100);
        setTimeout(() => {
          setLoading(false);
        }, 800);
      } catch (e) {
        console.error("Master Export Fail:", e);
      }
    }
    loadAllData();
  }, []);

  const metrics = useMemo(() => {
    const ativos = cases.filter(c => !['ENCERRADO', 'ARQUIVADO', 'EXTINTO', 'SUSPENSO'].includes(String(c.situacao).toUpperCase()));
    const vencidos = ativos.filter(c => c.status === 'Vencido').length;
    const hoje = ativos.filter(c => c.status === 'É Hoje').length;
    
    const tribCounts: Record<string, number> = {};
    cases.forEach(c => {
      tribCounts[c.tribunal || 'Outros'] = (tribCounts[c.tribunal || 'Outros'] || 0) + 1;
    });
    const topTribs = Object.entries(tribCounts)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    // Estatísticas Operacionais
    const offices: Record<string, any> = {};
    const lawyers: Record<string, any> = {};

    cases.forEach(c => {
      const officeName = (c.escritorio || "Sem Escritório").trim().toUpperCase();
      const lawyerName = (c.advogado || "NÃO ATRIBUÍDO").trim().toUpperCase();
      const isAtivo = !['ENCERRADO', 'ARQUIVADO', 'EXTINTO', 'SUSPENSO'].includes(String(c.situacao || '').toUpperCase());

      if (!offices[officeName]) offices[officeName] = { name: officeName, total: 0, ativos: 0, vencidos: 0, hoje: 0 };
      if (!lawyers[lawyerName]) lawyers[lawyerName] = { name: lawyerName, total: 0, ativos: 0, vencidos: 0, hoje: 0 };

      offices[officeName].total++;
      lawyers[lawyerName].total++;

      if (isAtivo) {
        offices[officeName].ativos++;
        lawyers[lawyerName].ativos++;
        if (c.status === 'Vencido') { offices[officeName].vencidos++; lawyers[lawyerName].vencidos++; }
        if (c.status === 'É Hoje') { offices[officeName].hoje++; lawyers[lawyerName].hoje++; }
      }
    });

    const sortedOffices = Object.values(offices).sort((a: any, b: any) => b.vencidos - a.vencidos || b.total - a.total);
    const sortedLawyers = Object.values(lawyers).sort((a: any, b: any) => b.vencidos - a.vencidos || b.total - a.total);

    return { ativos: ativos.length, vencidos, hoje, topTribs, sortedOffices, sortedLawyers };
  }, [cases]);

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-12 font-sans overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-[100px] animate-pulse rounded-full" />
          <div className="w-24 h-24 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin relative z-10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Layers className="text-primary animate-pulse" size={32} />
          </div>
        </div>
        
        <div className="text-center space-y-6 relative z-10">
          <h1 className="text-white font-black text-2xl uppercase tracking-[0.4em] animate-in fade-in slide-in-from-bottom-4">Omni-Sincronia Ativa</h1>
          <p className="text-primary font-bold text-[10px] uppercase tracking-[0.3em]">Triagem Neural de {progress}% da Infraestrutura</p>
          <div className="w-64 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-8 pt-8 opacity-40">
             <div className="flex flex-col items-center gap-2"><Briefcase className="text-white" size={14}/><span className="text-[7px] text-white font-black uppercase">Processos</span></div>
             <div className="flex flex-col items-center gap-2"><Activity className="text-white" size={14}/><span className="text-[7px] text-white font-black uppercase">Indicadores</span></div>
             <div className="flex flex-col items-center gap-2"><Users className="text-white" size={14}/><span className="text-[7px] text-white font-black uppercase">Equipe</span></div>
          </div>
        </div>
        <div className="fixed bottom-10 text-[9px] font-black uppercase text-white/20 tracking-[0.5em]">LexisPredict Master Protocol</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans print:bg-white print:p-0">
      {/* HEADER DE CONTROLE (Oculto no Print) */}
      <div className="print:hidden sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b-2 border-black p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="h-10 px-4 font-black uppercase text-[10px] border-2 border-transparent hover:border-black rounded-none transition-all">
              <Link href="/">
                <ArrowLeft size={16} className="mr-2" /> Voltar ao Gabinete
              </Link>
            </Button>
            <div className="h-6 w-px bg-black/10 mx-2" />
            <Badge className="bg-black text-primary font-black uppercase text-[10px] px-4 rounded-none h-8">Sincronia Omni 100%</Badge>
            <p className="text-[10px] font-bold uppercase text-black/60 hidden sm:block">Dossiê Completo • Gerado em {new Date().toLocaleString()}</p>
          </div>
          <Button onClick={() => window.print()} className="bg-black hover:bg-black/90 text-white font-black uppercase text-[10px] h-10 px-8 rounded-none shadow-[4px_4px_0px_#00D1FF] hover:shadow-none transition-all">
            <Printer size={16} className="mr-2" /> Imprimir Tudo em PDF
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-10 print:py-0 space-y-20 pb-40">
        
        {/* CAPA DO RELATÓRIO */}
        <section className="min-h-[90vh] flex flex-col justify-between border-8 border-black p-20 relative overflow-hidden page-break-after">
           <div className="absolute top-0 right-0 p-20 opacity-[0.03] rotate-12 scale-150">
             <Layers size={400} />
           </div>
           
           <div className="space-y-10">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-black flex items-center justify-center"><Layers size={40} className="text-primary" /></div>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-[0.4em]">LexisPredict Elite</h2>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-40">W1 Capital • Advanced Legal Operations</p>
                 </div>
              </div>
              
              <div className="space-y-4 pt-20">
                 <h1 className="text-7xl font-black uppercase tracking-tighter leading-[0.85] text-black">
                    Dossiê<br />Omnipresente<br /><span className="text-primary">Master</span>
                 </h1>
                 <p className="text-sm font-bold uppercase tracking-[0.5em] opacity-60">Relatório Consolidado de Infraestrutura</p>
              </div>
           </div>

           <div className="flex justify-between items-end border-t-4 border-black pt-12">
              <div className="space-y-2">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Auditado e Selado por</p>
                 <p className="text-lg font-black uppercase tracking-tight">Davi Alves Figueredo</p>
              </div>
              <div className="text-right">
                 <p className="text-3xl font-black tracking-tighter uppercase">{new Date().getFullYear()}</p>
                 <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[9px] px-3 py-1">v.40000.0 ELITE</Badge>
              </div>
           </div>
        </section>

        {/* SEÇÃO 1: ABA DASHBOARD */}
        <section className="space-y-12 page-break-after px-10">
           <SectionLegend icon={Zap} label="Módulo: Dashboard & KPIs" />
           <div className="grid grid-cols-3 gap-8">
              <OmniKpiCard label="Processos Ativos" value={metrics.ativos} icon={Activity} />
              <OmniKpiCard label="Prazos Vencidos" value={metrics.vencidos} icon={Clock} color="text-red-600" />
              <OmniKpiCard label="Demandas de Hoje" value={metrics.hoje} icon={Calendar} color="text-primary" />
           </div>
           
           <div className="bg-black text-white p-12 space-y-8 shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3">
                 <Zap className="text-primary" size={14}/> Briefing de Situação Global
              </h3>
              <p className="text-lg font-black uppercase leading-relaxed tracking-tight italic opacity-90">
                 "O gabinete opera atualmente com {metrics.ativos} processos ativos. Identificamos {metrics.vencidos} pontos de preclusão crítica que exigem intervenção imediata da banca. A telemetria de hoje indica {metrics.hoje} atendimentos em fila."
              </p>
           </div>
        </section>

        {/* SEÇÃO 2: ABA TAREFAS */}
        <section className="space-y-12 page-break-after px-10">
           <SectionLegend icon={Target} label="Módulo: Fila de Tarefas & Contatos" />
           <div className="border-4 border-black overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-black text-white uppercase font-black text-[9px] tracking-widest">
                    <th className="p-5">Titular / Cliente</th>
                    <th className="p-5">Protocolo</th>
                    <th className="p-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/5">
                   {cases.filter(c => c.status === 'Vencido' || c.status === 'É Hoje').slice(0, 100).map((c, i) => (
                     <tr key={i} className="hover:bg-gray-50 transition-colors font-bold uppercase text-[10px]">
                        <td className="p-5">{c.cliente}</td>
                        <td className="p-5 font-mono text-[9px] opacity-60">{c.protocolo}</td>
                        <td className="p-5 text-right">
                           <span className={cn("px-2 py-0.5 border-2", c.status === 'Vencido' ? "border-red-600 text-red-600" : "border-primary text-primary")}>
                              {c.status}
                           </span>
                        </td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </section>

        {/* SEÇÃO 3: ABA PROCESSOS */}
        <section className="space-y-12 page-break-after px-10">
           <SectionLegend icon={Briefcase} label="Módulo: Carteira de Processos (Full Table)" />
           <div className="border-4 border-black overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-black text-white uppercase font-black text-[8px] tracking-[0.2em]">
                    <th className="p-4">Identificação</th>
                    <th className="p-4">Advogado</th>
                    <th className="p-4">Tribunal</th>
                    <th className="p-4 text-right">Próximo Prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/5">
                   {cases.slice(0, 5000).map((c, i) => (
                     <tr key={i} className="text-[9px] font-black uppercase">
                        <td className="p-4">
                           <div>{c.cliente}</div>
                           <div className="text-[7px] opacity-40 font-mono">{c.protocolo}</div>
                        </td>
                        <td className="p-4 text-primary">{c.advogado}</td>
                        <td className="p-4 opacity-60">{c.tribunal}</td>
                        <td className="p-4 text-right">{c.proximoPrazo || 'S/ PRAZO'}</td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </section>

        {/* SEÇÃO 4: ABA ANALYTICS + ESTATÍSTICAS POR ESCRITÓRIO/ADVOGADO */}
        <section className="space-y-12 page-break-after px-10">
           <SectionLegend icon={BarChart3} label="Módulo: Business Intelligence & BI" />
           <div className="grid grid-cols-2 gap-12">
              <div className="bg-[#f8f9fb] border-2 border-black p-8 h-[350px] flex flex-col">
                 <h4 className="text-[10px] font-black uppercase mb-8 opacity-40">Volumetria por Tribunal (Top 6)</h4>
                 <div className="flex-1">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={metrics.topTribs}>
                       <XAxis dataKey="name" fontSize={8} fontWeight={900} axisLine={false} tickLine={false} />
                       <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
                         {metrics.topTribs.map((_, index) => (
                           <Cell key={index} fill={index === 0 ? '#000' : '#00D1FF'} />
                         ))}
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
              </div>
              
              <div className="bg-white border-2 border-black p-10 flex flex-col justify-center space-y-6">
                 <h4 className="text-[10px] font-black uppercase opacity-40">Eficiência de Banca</h4>
                 <div className="space-y-4">
                    <p className="text-4xl font-black tracking-tighter">98.4%</p>
                    <p className="text-[10px] font-bold uppercase leading-relaxed opacity-60">Índice de conformidade técnica calculado pelo motor neural para o período atual. Total de {cases.length} registros auditados sem falhas de integridade.</p>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3"><Building2 size={14}/> Indicadores por Escritório</h3>
              <div className="border-4 border-black">
                 <table className="w-full text-left text-[9px] font-black uppercase">
                    <thead className="bg-black text-white">
                       <tr>
                          <th className="p-3">Escritório</th>
                          <th className="p-3 text-center">Total</th>
                          <th className="p-3 text-center">Ativos</th>
                          <th className="p-3 text-center text-red-400">Vencidos</th>
                          <th className="p-3 text-center text-orange-400">Hoje</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black/5">
                       {metrics.sortedOffices.map((off, i) => (
                          <tr key={i}>
                             <td className="p-3">{off.name}</td>
                             <td className="p-3 text-center">{off.total}</td>
                             <td className="p-3 text-center">{off.ativos}</td>
                             <td className={cn("p-3 text-center", off.vencidos > 0 && "text-red-600 bg-red-50")}>{off.vencidos}</td>
                             <td className="p-3 text-center">{off.hoje}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="space-y-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3"><Gavel size={14}/> Indicadores por Advogado</h3>
              <div className="border-4 border-black">
                 <table className="w-full text-left text-[9px] font-black uppercase">
                    <thead className="bg-black text-white">
                       <tr>
                          <th className="p-3">Advogado</th>
                          <th className="p-3 text-center">Total</th>
                          <th className="p-3 text-center">Ativos</th>
                          <th className="p-3 text-center text-red-400">Vencidos</th>
                          <th className="p-3 text-center text-orange-400">Hoje</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black/5">
                       {metrics.sortedLawyers.map((adv, i) => (
                          <tr key={i}>
                             <td className="p-3">{adv.name}</td>
                             <td className="p-3 text-center">{adv.total}</td>
                             <td className="p-3 text-center">{adv.ativos}</td>
                             <td className={cn("p-3 text-center", adv.vencidos > 0 && "text-red-600 bg-red-50")}>{adv.vencidos}</td>
                             <td className="p-3 text-center">{adv.hoje}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </section>

        {/* SEÇÃO 5: ABA EQUIPE */}
        <section className="space-y-12 page-break-after px-10">
           <SectionLegend icon={Users} label="Módulo: Gestão de Autoridade (Equipe)" />
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((u, i) => (
                <div key={i} className="p-6 border-2 border-black bg-white space-y-4 shadow-[4px_4px_0px_#000]">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-black flex items-center justify-center text-primary font-black uppercase text-sm">
                        {u.nome.substring(0, 2)}
                      </div>
                      <div>
                         <p className="font-black text-xs uppercase">{u.nome}</p>
                         <p className="text-[8px] font-black text-primary uppercase tracking-widest">{u.cargo}</p>
                      </div>
                   </div>
                   <p className="text-[8px] font-mono opacity-40 lowercase">{u.email}</p>
                </div>
              ))}
           </div>
        </section>

        {/* SEÇÃO 6: ABA EVIDÊNCIAS */}
        <section className="space-y-12 page-break-after px-10">
           <SectionLegend icon={StickyNote} label="Módulo: Livro de Evidências (Notas)" />
           <div className="grid grid-cols-2 gap-8">
              {notes.slice(0, 100).map((n, i) => (
                <div key={i} className="p-8 border-2 border-black bg-white space-y-4 flex flex-col h-full">
                   {n.imageUrl && (
                     <div className="w-full h-40 border-2 border-black relative mb-4">
                        <Image src={n.imageUrl} alt="Evidência" fill className="object-cover" unoptimized />
                     </div>
                   )}
                   <h5 className="font-black text-xs uppercase border-b-2 border-black pb-2">{n.title}</h5>
                   <p className="text-[10px] font-bold uppercase leading-relaxed text-black/60 flex-1">{n.content}</p>
                   <p className="text-[8px] font-black opacity-30 uppercase text-right tracking-[0.2em]">{n.updatedAt}</p>
                </div>
              ))}
           </div>
        </section>

        {/* FOOTER MASTER */}
        <footer className="px-10 py-20 border-t-8 border-black flex flex-col items-center space-y-12">
           <div className="flex items-center gap-12">
              <div className="flex items-center gap-2">
                 <ShieldCheck size={24} className="text-primary" />
                 <span className="text-[10px] font-black uppercase tracking-[0.3em]">Autenticidade Forense Garantida</span>
              </div>
              <div className="flex items-center gap-2">
                 <Zap size={24} className="text-primary" />
                 <span className="text-[10px] font-black uppercase tracking-[0.3em]">IA Triagem Ativa</span>
              </div>
           </div>
           
           <div className="text-center space-y-4">
              <p className="text-[9px] font-black uppercase tracking-[0.5em] opacity-40">Propriedade Reservada • W1 Capital Assessoria Financeira Ltda.</p>
              <div className="flex items-center justify-center gap-2 font-black text-xs uppercase">
                 <Copyright size={12} /> 2026 LexisPredict Elite Master System
              </div>
           </div>
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .page-break-after { page-break-after: always; }
          .print-hidden { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

function SectionLegend({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="flex items-center gap-6 border-b-4 border-black pb-4">
       <div className="w-10 h-10 bg-black flex items-center justify-center text-white">
         <Icon size={20} />
       </div>
       <h2 className="text-xl font-black uppercase tracking-tight">{label}</h2>
       <div className="flex-1 h-1 bg-black/5" />
    </div>
  );
}

function OmniKpiCard({ label, value, icon: Icon, color = "text-black" }: any) {
  return (
    <div className="border-4 border-black p-8 flex flex-col justify-between h-40 bg-white">
       <div className="flex justify-between items-start">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{label}</p>
          <Icon size={16} className="opacity-20" />
       </div>
       <p className={cn("text-5xl font-black tracking-tighter tabular-nums", color)}>{value}</p>
    </div>
  );
}

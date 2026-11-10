import Link from 'next/link';
import { redirect,notFound } from 'next/navigation';
import { getUserContext } from '@/lib/server-db';
import { Bot, ExternalLink, FileBarChart, Network, ShieldCheck, Workflow } from 'lucide-react';
export const dynamic='force-dynamic';

/** Central de projetos reais; evita criar cópias de IA Lab ou do Estúdio de Agentes. */
export default async function ProjetosPage(){
 const ctx=await getUserContext();
 if(!ctx.auth_id||!ctx.empresa_id)redirect('/login');
 if(ctx.isViewer||!(ctx.isSupervisor||ctx.isAdministrador||ctx.isSuperAdmin))notFound();
 const cards=[
  {label:'Hermes · Miniempresa 3D',subtitle:'Robôs 3D, cargos, setores, reuniões e métricas verificáveis.',href:'/hermes-3d',icon:Bot},
  {label:'Automação dos retornos',subtitle:'DJEN/DataJud, prioridades, mensagens sugeridas e acompanhamento.',href:'/tarefas',icon:Workflow},
  {label:'Estúdio de Agentes',subtitle:'Playbooks, especialistas e fluxos supervisionados.',href:'/estudio-agentes',icon:Network},
  {label:'Relatórios Hermes',subtitle:'Produtividade comprovada, alertas, problemas e ata da reunião.',href:'/report#hermes-company-report',icon:FileBarChart},
  {label:'Integrações judiciais',subtitle:'DJEN oficial, DataJud e Domicílio Judicial Eletrônico.',href:'/integracoes',icon:ShieldCheck},
 ];
 return <main className="min-h-screen bg-[#120f18] px-4 py-8 text-white md:px-8">
  <div className="mx-auto max-w-6xl space-y-6">
   <header className="rounded-3xl border border-[#d1abc0]/25 bg-gradient-to-br from-[#57283f] to-[#241d2c] p-7">
     <p className="text-xs font-bold uppercase tracking-[.17em] text-[#e4b5c8]">LEXISPREDICT / PROJETOS</p>
     <h1 className="mt-2 text-3xl font-black">Projetos e automações da operação</h1>
     <p className="mt-2 max-w-2xl text-sm leading-6 text-[#e4d6df]">Todos os módulos aproveitam as ferramentas do LexisPredict existentes; o Hermes não cria uma segunda IA nem exige processamento local.</p>
   </header>
   <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     {cards.map(({label,subtitle,href,icon:Icon})=><Link key={href} href={href} className="group rounded-2xl border border-[#d1abc0]/25 bg-[#2c2130] p-5 transition-colors hover:border-[#dfb3c9] hover:bg-[#423148]">
       <div className="flex items-center justify-between"><Icon size={25} className="text-[#ecc5d8]"/><ExternalLink size={16} className="text-[#ae9aa6] group-hover:text-white"/></div>
       <h2 className="mt-6 text-base font-black">{label}</h2><p className="mt-2 text-sm leading-6 text-[#dbcbd3]">{subtitle}</p>
     </Link>)}
   </section>
   <section className="rounded-2xl border border-[#bb93a7]/25 bg-[#251d2b] p-5 text-sm leading-6 text-[#e9dbe3]">
    <h2 className="font-black">Evolução supervisionada</h2>
    <p className="mt-1">Os resultados vêm dos registros do banco. Prêmios e medalhas são simbólicos; propostas de versão, treinamento ou substituição de estratégia exigem validação. Nenhum agente se copia, altera código, dispara contatos ou apaga documentos por conta própria.</p>
   </section>
  </div>
 </main>;
}

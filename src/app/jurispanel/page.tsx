import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { getUserContext } from '@/lib/server-db';
import { FileText, Briefcase, Clock3, Scale, CalendarDays, Users, Bell, Wallet, ShieldCheck, BrainCircuit, LayoutDashboard } from 'lucide-react';

export const dynamic='force-dynamic';

const areas=[
 {title:'Painel e indicadores',description:'Indicadores reais da carteira e relatórios existentes.',href:'/',icon:LayoutDashboard},
 {title:'Processos e casos',description:'Carteira completa, histórico, empresas e filtros.',href:'/processos',icon:Briefcase},
 {title:'Scanner DataJud + DJEN',description:'Consultas oficiais, resultados parciais e controle de fontes.',href:'/processos-parados',icon:Scale},
 {title:'Central de peças',description:'Editor jurídico nativo, peças e arquivos PDF/RTF.',href:'/documents/generator',icon:FileText},
 {title:'46 tipos de minutas e modelos autorais',description:'Catálogo de estruturas e modelos compartilhados com controle de autor.',href:'/jurispanel/modelos',icon:FileText},
 {title:'Timesheet',description:'Cronômetro, registros por processo, histórico e exportação CSV.',href:'/jurispanel/timesheet',icon:Clock3},
 {title:'Tarefas e Kanban',description:'Fila da equipe, ações, responsáveis e andamento.',href:'/tarefas',icon:Briefcase},
 {title:'Agenda e prazos',description:'Compromissos operacionais e revisão de datas legais.',href:'/agenda',icon:CalendarDays},
 {title:'Clientes e atendimentos',description:'Clientes vinculados à carteira e histórico operacional.',href:'/clients',icon:Users},
 {title:'CRM e financeiro',description:'Recebíveis, pagamentos registrados e visão financeira.',href:'/crm/financeiro',icon:Wallet},
 {title:'Publicações e alertas',description:'Alertas oficiais e notificações por usuário.',href:'/notificacoes',icon:Bell},
 {title:'Documentos',description:'Biblioteca e geração de documentos vinculados ao processo.',href:'/documents',icon:FileText},
 {title:'Análises jurídicas e triagem',description:'Investigação e revisão assistida, sem declarar mérito sem prova.',href:'/analises-internas',icon:BrainCircuit},
 {title:'Equipe e permissões',description:'Perfis da empresa e segregação de acesso.',href:'/team',icon:Users},
 {title:'Segurança e auditoria',description:'Logs e ferramentas administrativas existentes.',href:'/auditoria',icon:ShieldCheck},
 {title:'Personalização',description:'Temas, aparência e preferências do aplicativo.',href:'/settings',icon:LayoutDashboard},
];

export default async function JurisPanelHome() {
 const ctx=await getUserContext();
 if(!ctx.empresa_id||!ctx.auth_id) redirect('/login');
 return <div className="flex min-h-screen bg-background text-foreground">
  <Sidebar />
  <main className="min-w-0 flex-1 p-5 lg:p-9">
   <header className="rounded-2xl border border-border bg-card px-6 py-8">
    <p className="text-xs font-bold uppercase tracking-widest text-primary">LexisPredict • Central jurídica integrada</p>
    <h1 className="mt-3 text-3xl font-extrabold">JurisPanel • ferramentas do escritório</h1>
    <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
      Recursos do protótipo independente incorporados aos módulos reais do LexisPredict, com os processos do seu escritório
      e controle de acesso. O protótipo HTML não foi instalado como banco separado e nenhum cadastro demonstrativo foi importado.
    </p>
   </header>
   <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {areas.map(item=><Link key={item.href} href={item.href}
     className="group flex min-h-[143px] gap-4 rounded-xl border border-border bg-card p-5 transition hover:border-primary/60 hover:shadow-md">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><item.icon className="h-5 w-5"/></span>
      <div><h2 className="font-bold group-hover:text-primary">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.description}</p></div>
     </Link>)}
   </section>
   <section className="mt-6 rounded-xl border border-border bg-card p-5 text-sm">
    <h2 className="font-semibold">Limites de homologação</h2>
    <p className="mt-2 text-muted-foreground">Acesso ao Domicílio Judicial autenticado, protocolo eletrônico credenciado,
     boleto/Pix bancário e portal externo de cliente não fazem parte desta implantação: não há integração homologada para executá-los.
     Alertas e minutas exigem revisão humana. Registro de pagamento não é comprovante de transferência.</p>
   </section>
  </main>
 </div>;
}

import Link from 'next/link';
import {ExternalLink, FolderKanban, Film, ShieldCheck} from 'lucide-react';
import {getUserContext} from '@/lib/server-db';
import {CREATIVE_LAB_TOOLS,type CreativeTool,type CreativeToolStatus} from '@/lib/media/creative-tools';

export const dynamic='force-dynamic';

const statusText:Record<CreativeToolStatus,string>={
  gateway:'Integração existente',
  'existing-editor':'Código W1 existente',
  'external-private':'Execução privada',
  'installable-private':'Instalador preparado',
  unverified:'Não verificado',
  'manual-external':'Instalação externa'
};

function Tool({tool}:{tool:CreativeTool}) {
  const internal=tool.url.startsWith('/');
  return <article className="flex h-full flex-col rounded-2xl border border-[#d8c9d1] bg-white p-5 text-[#321b2b] shadow-[0_12px_34px_rgba(50,15,32,.06)]">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#975e77]">{tool.purpose}</p>
      <span className="rounded-full border border-[#d8bbc8] bg-[#f9eef2] px-2.5 py-1 text-[10px] font-semibold text-[#703049]">
        {statusText[tool.status]}
      </span>
    </div>
    <h2 className="mt-4 text-xl font-semibold tracking-tight">{tool.name}</h2>
    <p className="mt-2 text-sm leading-6 text-[#6c5260]">{tool.description}</p>
    <ul className="mt-4 space-y-1.5 text-xs leading-5 text-[#705762]">
      {tool.requirements.map(item=><li key={item}>• {item}</li>)}
    </ul>
    {tool.warning&&<p className="mt-4 rounded-lg border border-[#e5cbbc] bg-[#fffbf3] p-3 text-xs leading-5 text-[#76512a]">{tool.warning}</p>}
    <div className="mt-auto pt-5">
      {tool.status==='unverified'
       ? <p className="text-xs text-[#975e77]">Conexão desabilitada até verificar origem, autenticação e ferramentas.</p>
       : internal
        ? <Link href={tool.url} className="inline-flex items-center gap-2 text-sm font-semibold text-[#8c294e] underline underline-offset-4">
            Abrir no AI Lab <ExternalLink className="h-4 w-4" aria-hidden="true"/>
          </Link>
        : <a href={tool.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8c294e] underline underline-offset-4">
            Ver código e instruções <ExternalLink className="h-4 w-4" aria-hidden="true"/>
          </a>}
    </div>
  </article>;
}

export default async function FerramentasCriativas(){
  const user=await getUserContext();
  if(!user.auth_id||!user.isSuperAdmin) {
    return <main className="min-h-screen bg-[#faf5f7] p-8 text-[#3b1b2a]">
      <h1 className="text-2xl font-semibold">Estúdio criativo privado</h1>
      <p className="mt-3 text-sm">Acesso restrito ao superadministrador.</p>
      <Link href="/ai-lab" className="mt-5 inline-block underline">Voltar ao AI Lab</Link>
    </main>;
  }
  return <main className="min-h-screen bg-[#f7f3f4] px-4 py-8 text-[#341b2b] md:px-8">
    <div className="mx-auto max-w-7xl space-y-7">
      <Link href="/ai-lab" className="inline-flex text-sm font-medium text-[#862a4d] hover:underline">← Voltar ao AI Lab</Link>
      <header className="relative overflow-hidden rounded-3xl bg-[linear-gradient(115deg,#290814_0%,#5b1b38_64%,#342d39_100%)] p-7 text-white md:p-10">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#e7bdcf]">W1 Capital · AI Lab</p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight md:text-5xl">Estúdio criativo de vídeo e movimento.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#f0dde5]">Reunimos o Open-Higgsfield, as três opções Genjutsu, VoiceStudio, W1 Reel Studio e as novas ferramentas. Instalação de código, serviço conectado e geração realmente disponível são situações diferentes.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="https://github.com/W1CAPITAL/SITE/tree/main/scripts/creative-lab" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#f1e7eb] px-4 py-3 text-sm font-semibold text-[#40172b] hover:bg-white">Instalador e documentação</a>
          <a href="https://w1-capital.onrender.com/portfolio/?tab=projetos" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#e2afc1] px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"><FolderKanban className="h-4 w-4" aria-hidden="true"/>Projetos do portfólio</a>
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2d2d8] bg-white p-4"><Film className="h-5 w-5 text-[#8c2a4e]"/><strong className="mt-2 block text-sm">Importação de vídeos</strong><p className="mt-1 text-xs leading-5 text-[#6f5361]">MP4 exportado, autorizado e revisado entra no W1 Reel Studio.</p></div>
        <div className="rounded-2xl border border-[#e2d2d8] bg-white p-4"><ShieldCheck className="h-5 w-5 text-[#8c2a4e]"/><strong className="mt-2 block text-sm">Sem custos inesperados</strong><p className="mt-1 text-xs leading-5 text-[#6f5361]">Nenhuma ferramenta é executada ou contratada ao abrir esta página.</p></div>
        <div className="rounded-2xl border border-[#e2d2d8] bg-white p-4"><FolderKanban className="h-5 w-5 text-[#8c2a4e]"/><strong className="mt-2 block text-sm">Projetos preservados</strong><p className="mt-1 text-xs leading-5 text-[#6f5361]">Portfólio com sete abas mantido, incluindo o projeto W1 Reel Studio.</p></div>
      </section>
      <section aria-label="Ferramentas criativas" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CREATIVE_LAB_TOOLS.map(tool=><Tool key={tool.id} tool={tool}/>)}
      </section>
      <section className="rounded-2xl border border-[#e2c5cf] bg-[#fffafc] p-5 text-sm leading-6 text-[#624553]">
        <h2 className="text-lg font-semibold text-[#451a2d]">Ambiente de execução</h2>
        <p className="mt-2">Hypit e AI YouTube Shorts Generator podem ser preparados em um worker privado com o instalador versionado da W1. MotionSmith Pro V2 depende do Unreal Engine no Windows e de GPU CUDA; o endereço MCP informado segue sem autenticação ou ferramentas verificadas. O frontend do LexisPredict não baixa modelos nem executa scripts de terceiros.</p>
      </section>
    </div>
  </main>;
}

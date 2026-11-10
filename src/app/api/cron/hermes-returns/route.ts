import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { runHermesDueReviewBatch,reviewHermesCase } from '@/lib/hermes-return-service';
import {
  getHermesCompanyDaily, getHermesCaseHealth, getHermesOfficeEvents, getHermesRebuildRuns, getHermesPortfolioDiagnostics, runHermesEvidenceRebuild, runHermesCompanyMeeting, todayHermesBrazil,
} from '@/lib/hermes-company-service';
import { buildHermesOfficeIntelligence } from '@/lib/hermes-company-intelligence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const preferredRegion = 'gru1'; // A API oficial DJEN pode bloquear chamadas de fora do Brasil.

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } as const;

function authorized(request: Request): boolean {
  const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return [process.env.WA_DAILY_CRON_SECRET, process.env.CRON_SECRET]
    .filter((value): value is string => typeof value === 'string' && value.length >= 20)
    .some((secret) => token.length === secret.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(secret)));
}

function canReviewOffice(ctx: Awaited<ReturnType<typeof getUserContext>>): boolean {
  return Boolean(ctx?.auth_id && ctx?.empresa_id && !ctx?.isViewer &&
    (ctx?.isSupervisor || ctx?.isSuperAdmin || ctx?.isAdministrador));
}

async function getOfficePanel() {
  const ctx = await getUserContext();
  if (!canReviewOffice(ctx)) return NextResponse.json(
    { ok: false, error: 'Acesso restrito à supervisão.' }, { status: 403, headers: privateHeaders },
  );
  try {
    const [record, cases, events, rebuild, diagnostics] = await Promise.all([
      getHermesCompanyDaily(String(ctx.empresa_id)),
      getHermesCaseHealth(String(ctx.empresa_id)),
      getHermesOfficeEvents(String(ctx.empresa_id)),
      getHermesRebuildRuns(String(ctx.empresa_id)),
      getHermesPortfolioDiagnostics(String(ctx.empresa_id)),
    ]);
    return NextResponse.json({
      ok: true,
      record,
      cases,
      events,
      rebuild,
      diagnostics,
      intelligence: record ? buildHermesOfficeIntelligence(record.metrics, record.day) : null,
    }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ ok: false, error: 'Relatório Hermes indisponível.' },
      { status: 503, headers: privateHeaders });
  }
}

async function postOfficeMeeting() {
  const ctx = await getUserContext();
  if (!canReviewOffice(ctx)) return NextResponse.json(
    { ok: false, error: 'Acesso restrito à supervisão.' }, { status: 403, headers: privateHeaders },
  );
  try {
    const row = await getHermesCompanyDaily(String(ctx.empresa_id));
    if (!row || row.day !== todayHermesBrazil()) return NextResponse.json({
      ok: false, error: 'O resumo do dia ainda não está disponível na base de dados.',
    }, { status: 409, headers: privateHeaders });
    const result = await runHermesCompanyMeeting(String(ctx.empresa_id), row.day);
    return NextResponse.json(result, { status: result.ok?200:409, headers: privateHeaders });
  } catch {
    return NextResponse.json({
      ok: false, error: 'Reunião indisponível. Os dados existentes permanecem preservados.',
    }, { status: 503, headers: privateHeaders });
  }
}

/** Run manual case lookups in São Paulo region, where official DJEN is available.
 * Reuses the cron serverless function and checked session. */
async function postOfficeCaseReview(request:Request){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id||ctx.isViewer)return NextResponse.json(
  {ok:false,error:'Sem permissão para a consulta Hermes.'},{status:403,headers:privateHeaders});
 try{
  const origin=request.headers.get('origin');
  if(origin&&new URL(origin).host!==new URL(request.url).host)return NextResponse.json(
   {ok:false,error:'Origem de chamada não autorizada.'},{status:403,headers:privateHeaders});
  const raw=await request.json();
  const processId=Number(raw?.processId);
  if(!Number.isSafeInteger(processId)||processId<=0)return NextResponse.json(
    {ok:false,error:'Identificador do processo inválido.'},{status:400,headers:privateHeaders});
  // An explicit click always performs a new official lookup. Debounce is handled in the client.
  const result=await reviewHermesCase({empresaId:String(ctx.empresa_id),processId,mode:'manual'});
  if(!result.ok)return NextResponse.json({ok:false,error:'Processo não encontrado nesta empresa.'},{status:404,headers:privateHeaders});
  return NextResponse.json({...result,reused:false},{headers:privateHeaders});
 }catch(error){
  console.error('[Hermes] consulta manual falhou:',error instanceof Error?error.message:'Falha desconhecida');
  return NextResponse.json({ok:false,error:'Consulta oficial indisponível. Consulte o diagnóstico e tente novamente.'},{status:503,headers:privateHeaders});
 }
}
async function postRebuild(){
 const ctx=await getUserContext();
 if(!canReviewOffice(ctx))return NextResponse.json({ok:false,error:'Acesso restrito à supervisão.'},{status:403,headers:privateHeaders});
 try{
   const result=await runHermesEvidenceRebuild(String(ctx.empresa_id));
   return NextResponse.json(result,{headers:privateHeaders});
 }catch(error){
   console.error('[Hermes] Swarm Rebuild:',error instanceof Error?error.message:'Falha na análise');
   return NextResponse.json({ok:false,error:'O Swarm Rebuild não concluiu sua auditoria; nenhuma ação jurídica foi aplicada.'},{status:503,headers:privateHeaders});
 }
}

/** A reunião é reservada por empresa e dia no banco: não há execuções concorrentes duplicadas. */
async function scheduledOfficeMeeting() {
  try {
    const day = todayHermesBrazil();
    const db = await getSupabaseAdmin();
    const { data, error } = await db.from('hermes_office_daily')
      .select('empresa_id').eq('day', day).in('meeting_status', ['pending','unavailable']).lt('meeting_attempts',3).limit(1);
    if (error) throw new Error('Não foi possível ler a fila Hermes.');
    if (!data?.length) return NextResponse.json({ ok: true, processed: 0 },
      { headers: { 'Cache-Control': 'no-store' } });
    const result = await runHermesCompanyMeeting(String(data[0].empresa_id), day);
    return NextResponse.json({
      ok: true, processed: result.alreadyDone ? 0 : 1,
      state: 'state' in result ? result.state : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Falha no resumo agendado.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

/**
 * As duas rotas públicas do Hermes continuam funcionando por rewrites em next.config.ts.
 * Elas reutilizam esta função existente; não criam novas funções na Vercel Hobby.
 * A análise de retornos mantém as credenciais próprias e o lote unitário.
 */
export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get('hermesRoute');
  if (mode === 'office') return getOfficePanel();
  if (!authorized(request)) return NextResponse.json(
    { ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
  if (mode === 'meeting') return scheduledOfficeMeeting();
  if (mode !== null) return NextResponse.json({ ok: false, error: 'Rota desconhecida' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } });

  try {
    const result = await runHermesDueReviewBatch(1);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Hermes Returns] scheduler error',
      error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'O scanner de retornos está indisponível.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

/** O POST só serve à reunião autorizada da supervisão; nunca envia mensagem ao cliente. */
export async function POST(request: Request) {
  const mode = new URL(request.url).searchParams.get('hermesRoute');
  if (mode === 'office' && new URL(request.url).searchParams.get('action')==='review') return postOfficeCaseReview(request);
  if (mode === 'office' && new URL(request.url).searchParams.get('action')==='rebuild') return postRebuild();
  if (mode === 'office') return postOfficeMeeting();
  return NextResponse.json({ ok: false, error: 'Método não permitido' },
    { status: 405, headers: { 'Cache-Control': 'no-store', Allow: 'GET' } });
}

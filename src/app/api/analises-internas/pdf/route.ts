import React from "react";
import { getReportIdentity } from "@/lib/report/report-identity";
import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { canViewCompanyAnalyses } from "@/lib/roles";
import { AnalisesPessoaisPdf } from "@/components/pdf/analises-internas-pdf";
import type { AnalisesPessoaisPdfData } from "@/components/pdf/analises-internas-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const pageParam = (value: string | null, max = 999) =>
  Math.max(1, Math.min(max, Math.floor(Number(value) || 1)));

export async function GET(request: Request) {
  try {
    const ctx = await getUserContext();
    if (!canViewCompanyAnalyses(ctx)) {
      return Response.json({ error: "Entre em uma conta vinculada à empresa." }, { status: 401, headers });
    }
    // Visualizadores continuam com acesso somente de leitura; PDF exige download.
    if (ctx.isViewer) {
      return Response.json({ error: "A exportação em PDF não está disponível para o perfil Visualizador." }, { status: 403, headers });
    }
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").replace(/[^0-9A-Za-z.\- ]/g, "").slice(0, 80);
    const cat = String(url.searchParams.get("cat") || "").replace(/[^a-z_]/g, "").slice(0, 50);
    const page = pageParam(url.searchParams.get("pagina"));
    const taskPage = pageParam(url.searchParams.get("atividadesPagina"), 99);
    const actionPage = pageParam(url.searchParams.get("acoesPagina"), 99);
    const empresa = String(ctx.empresa_id);
    const usuario = String(ctx.auth_id);
    const db = await getSupabaseAdmin();

    // Estes filtros não são configuráveis pelo cliente, nem mesmo por admin.
    let analysesQuery = db.from("registros_trabalho_analitico")
      .select("id,protocolo_ref,descricao,categoria,origem,data_atividade,nivel_conferencia", { count: "exact" })
      .eq("empresa_id", empresa).eq("responsavel_auth_user_id", usuario);
    let tasksQuery = db.from("tarefas_realizadas")
      .select("id,titulo,categoria,descricao,data_realizacao,protocolo_ref", { count: "exact" })
      .eq("empresa_id", empresa).eq("responsavel_auth_user_id", usuario);
    let actionsQuery = db.from("auditoria_logs_app")
      .select("id,action,created_at,protocolo_ref", { count: "exact" })
      .eq("empresa_id", empresa).eq("auth_user_id", usuario)
      .in("action", ["edicao", "atendimento"]);

    if (q) {
      analysesQuery = analysesQuery.ilike("protocolo_ref", `%${q}%`);
      tasksQuery = tasksQuery.ilike("protocolo_ref", `%${q}%`);
      actionsQuery = actionsQuery.ilike("protocolo_ref", `%${q}%`);
    }
    if (cat) analysesQuery = analysesQuery.eq("categoria", cat);

    // Respeita a paginação da tela. Não renderizar milhares de fichas numa
    // função Vercel, o que causava timeouts e PDFs incompletos.
    const [a, t, o, doc] = await Promise.all([
      analysesQuery.order("data_atividade", { ascending: false }).order("id", { ascending: false })
        .range((page - 1) * 40, page * 40 - 1),
      tasksQuery.order("data_realizacao", { ascending: false }).order("id", { ascending: false })
        .range((taskPage - 1) * 25, taskPage * 25 - 1),
      actionsQuery.order("created_at", { ascending: false })
        .range((actionPage - 1) * 20, actionPage * 20 - 1),
      db.from("registros_trabalho_analitico").select("id", { head: true, count: "exact" })
        .eq("empresa_id", empresa).eq("responsavel_auth_user_id", usuario)
        .eq("categoria", "auditoria_documental"),
    ]);

    if (a.error || t.error || o.error || doc.error) {
      console.error("[analises-internas/pdf] Erro na consulta pessoal", {
        analyses: Boolean(a.error), tasks: Boolean(t.error),
        actions: Boolean(o.error), docs: Boolean(doc.error),
      });
      return Response.json({ error: "Não foi possível reunir os registros deste relatório." }, { status: 503, headers });
    }

    const identity = await getReportIdentity();
    const report: AnalisesPessoaisPdfData = {
      empresa: identity.company,
      nome: String(ctx.nome || "Colaborador"),
      geradoEm: new Date().toISOString(),
      filtros: { busca: q, categoria: cat },
      paginas: { analises: page, atividades: taskPage, acoes: actionPage },
      totais: {
        analises: a.count || 0, atividades: t.count || 0, acoes: o.count || 0,
        documentais: doc.count || 0,
      },
      analises: (a.data || []).map(row => ({
        id: String(row.id), protocolo_ref: row.protocolo_ref,
        categoria: row.categoria, descricao: row.descricao,
        origem: row.origem, data_atividade: row.data_atividade,
        nivel_conferencia: row.nivel_conferencia,
      })),
      atividades: (t.data || []).map(row => ({
        id: String(row.id), titulo: row.titulo, categoria: row.categoria,
        descricao: row.descricao, data_realizacao: row.data_realizacao,
        protocolo_ref: row.protocolo_ref,
      })),
      acoes: (o.data || []).map(row => ({
        id: String(row.id), action: row.action, created_at: row.created_at,
        protocolo_ref: row.protocolo_ref,
      })),
    };

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const element = React.createElement(AnalisesPessoaisPdf, { data: report });
    const buffer = await renderToBuffer(
      element as unknown as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
    );
    const today = new Date().toISOString().slice(0, 10);
    const filename = `LexisPredict-Analises-Pessoais-${today}-P${page}.pdf`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[analises-internas/pdf] Erro de exportação", error instanceof Error ? error.message : "desconhecido");
    return Response.json({ error: "Falha ao gerar PDF. Nenhum registro foi alterado." }, { status: 500, headers });
  }
}

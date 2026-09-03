/**
 * SheetsProvider — Google Apps Script como API (login + sync 2 vias).
 * Planilha = espelho; Apps Script = autoridade.
 */

import type {
  ClientRow,
  DataProvider,
  LeadRow,
  ProcessRow,
  SessionUser,
  SyncChange,
  SyncPullResult,
  SyncPushResult,
} from "./types";
import { loadProviderConfig, getDeviceId } from "./config";
import {
  createLocalProvider,
  getLocalSyncQueue,
  clearLocalSyncQueueItem,
  importRowsToLocal,
} from "./local-provider";

const SESSION_KEY = "lexis_sheets_session_v1";

function readSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function writeSession(u: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (!u) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(u));
}

async function sheetsPost(body: Record<string, unknown>) {
  const cfg = loadProviderConfig().sheets;
  const url = String(cfg.webhookUrl || "")
    .trim()
    .replace(/\/dev(\b|$)/, "/exec");
  if (!url || !/^https:\/\/script\.google\.com\//i.test(url)) {
    return { ok: false, error: "Configure URL do Apps Script (/exec) em Setup Planilha" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token || "w1-fase1-2026", ...body }),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      if (/<html|accounts\.google/i.test(text.slice(0, 200))) {
        return {
          ok: false,
          error: "HTML do Google — implantar Web App: Eu + Qualquer pessoa + Nova versão",
        };
      }
      return { ok: false, error: "Resposta não-JSON", raw: text.slice(0, 180) };
    }
    return { ok: !!(json && (json.ok || json.pong)), json, http: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "rede" };
  }
}

function mapProcess(row: any): ProcessRow {
  return {
    id: String(row.Id || row.id || row.Protocolo || crypto.randomUUID()),
    protocolo: String(row.Protocolo || row.protocolo || ""),
    cliente: String(row.Cliente || row.cliente || ""),
    status: String(row.Status || row.status || ""),
    situacao: String(row.Situacao || row.situacao || ""),
    ultimoRetorno: String(row.UltimoRetorno || row.ultimoRetorno || ""),
    proximoRetorno: String(row.ProximoRetorno || row.proximoRetorno || ""),
    advogado: String(row.Advogado || row.advogado || ""),
    telefone: String(row.Telefone || row.telefone || ""),
    createdBy: String(row.CreatedBy || row.createdBy || ""),
    responsavel: String(row.Responsavel || row.responsavel || ""),
    observacao: String(row.Observacao || row.observacao || ""),
    empresaId: String(row.EmpresaId || row.empresaId || ""),
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString()),
    version: Number(row.version || 1),
    deleted: false,
  };
}

export function createSheetsProvider(): DataProvider {
  const local = createLocalProvider();

  return {
    kind: "sheets",
    auth: {
      async login(login, password) {
        const r = await sheetsPost({
          action: "auth",
          login,
          password,
          senha: password,
        });
        if (!r.ok || !r.json?.ok) {
          return { ok: false, error: r.error || r.json?.error || "Falha no login" };
        }
        const user: SessionUser = {
          id: String(r.json.userId || r.json.id || login),
          login: String(r.json.login || login),
          nome: String(r.json.nome || r.json.name || login),
          email: r.json.email,
          role: String(r.json.role || r.json.perfil || "operador"),
          empresaId: String(r.json.empresaId || r.json.companyId || "sheets"),
          token: String(r.json.session || r.json.token || ""),
        };
        writeSession(user);
        return { ok: true, user };
      },
      async logout() {
        writeSession(null);
        await local.auth.logout();
      },
      currentUser() {
        return readSession() || local.auth.currentUser();
      },
    },
    processes: {
      async list(opts) {
        // Prefer local cache; pull remoto se vazio
        let rows = await local.processes.list(opts);
        if (!rows.length) {
          // sync engine separado; aqui só cache local
        }
        return rows;
      },
      async upsert(row) {
        return local.processes.upsert(row);
      },
      async remove(id) {
        return local.processes.remove(id);
      },
    },
    leads: {
      async list() {
        return local.leads.list();
      },
      async upsert(row) {
        return local.leads.upsert(row);
      },
    },
    clients: {
      async list() {
        return local.clients.list();
      },
      async upsert(row) {
        return local.clients.upsert(row);
      },
    },
    sync: {
      async ping() {
        const r = await sheetsPost({ action: "ping", ping: true });
        return { ok: !!r.ok, error: r.error || r.json?.error };
      },
      async pull(since?: string): Promise<SyncPullResult> {
        const session = readSession();
        const r = await sheetsPost({
          action: "list",
          session: session?.token,
          login: session?.login,
          since: since || "",
          sheetName: "Processos",
        });
        if (!r.ok) return { ok: false, error: r.error || r.json?.error };
        const rawRows = r.json?.rows || r.json?.cases || r.json?.processos || [];
        const processes = (Array.isArray(rawRows) ? rawRows : []).map(mapProcess);
        if (processes.length) {
          await importRowsToLocal(
            "processos",
            processes as unknown as Record<string, unknown>[],
          );
        }
        // Leads opcional
        let leads: LeadRow[] = [];
        const rLeads = await sheetsPost({
          action: "list",
          session: session?.token,
          sheetName: "Leads",
        });
        if (rLeads.ok && Array.isArray(rLeads.json?.rows)) {
          leads = rLeads.json.rows.map((row: any) => ({
            id: String(row.Id || row.id || crypto.randomUUID()),
            nome: String(row.Nome || row.nome || ""),
            whatsapp: String(row.WhatsApp || row.whatsapp || ""),
            cpf: String(row.CPF || row.cpf || ""),
            status: String(row.Status || ""),
            consentAt: row.Consentimento || row.consentAt || null,
            score: Number(row.Score || 0),
            source: String(row.Fonte || row.source || ""),
            updatedAt: String(row.AtualizadoEm || row.updatedAt || new Date().toISOString()),
          }));
          await importRowsToLocal("leads", leads as unknown as Record<string, unknown>[]);
        }
        return {
          ok: true,
          processes,
          leads,
          serverTime: r.json?.serverTime || new Date().toISOString(),
        };
      },
      async push(changes?: SyncChange[]): Promise<SyncPushResult> {
        const session = readSession();
        const queue = changes?.length ? changes : await getLocalSyncQueue();
        if (!queue.length) return { ok: true, applied: 0, conflicts: 0 };

        const procRows = queue
          .filter((c) => c.table === "processos" && c.op === "upsert")
          .map((c) => {
            const p = c.payload as any;
            return {
              Id: p.id,
              Protocolo: p.protocolo,
              Cliente: p.cliente,
              Status: p.status,
              Situacao: p.situacao,
              UltimoRetorno: p.ultimoRetorno,
              ProximoRetorno: p.proximoRetorno,
              Advogado: p.advogado,
              Telefone: p.telefone,
              CreatedBy: p.createdBy,
              Responsavel: p.responsavel || session?.login,
              Observacao: p.observacao,
              EmpresaId: p.empresaId,
              updated_at: p.updatedAt,
              version: p.version,
            };
          });

        const leadRows = queue
          .filter((c) => c.table === "leads" && c.op === "upsert")
          .map((c) => {
            const p = c.payload as any;
            return {
              Id: p.id,
              Nome: p.nome,
              WhatsApp: p.whatsapp,
              CPF: p.cpf,
              Status: p.status,
              Consentimento: p.consentAt,
              Score: p.score,
              Fonte: p.source,
              AtualizadoEm: p.updatedAt,
            };
          });

        let applied = 0;
        if (procRows.length) {
          const r = await sheetsPost({
            action: "write",
            session: session?.token,
            login: session?.login,
            sheetName: "Processos",
            rows: procRows,
          });
          if (!r.ok) return { ok: false, error: r.error || r.json?.error };
          applied += Number(r.json?.added || 0) + Number(r.json?.updated || 0);
        }
        if (leadRows.length) {
          const r = await sheetsPost({
            action: "write",
            session: session?.token,
            sheetName: "Leads",
            rows: leadRows,
          });
          if (!r.ok) return { ok: false, error: r.error || r.json?.error };
          applied += Number(r.json?.added || 0) + Number(r.json?.updated || 0);
        }

        for (const c of queue) {
          await clearLocalSyncQueueItem(`${c.table}:${c.id}:${c.updatedAt}`);
        }
        return { ok: true, applied, conflicts: 0 };
      },
    },
  };
}

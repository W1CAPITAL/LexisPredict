"use client";
import { listAdvogadosBanca } from "@/lib/server-db";

/** Deduplica pedidos de múltiplos formulários sem salvar dados pessoais no disco. */
let inflight: Promise<any[]> | undefined;
let current: any[] | undefined;
let loadedAt = 0;
const MAX_AGE_MS = 45_000;
export async function listDocumentLawyersFast(force=false): Promise<any[]> {
  if (!force && current && Date.now()-loadedAt < MAX_AGE_MS) return current;
  if (!force && inflight) return inflight;
  const request = listAdvogadosBanca();
  const deadline = new Promise<any[]>((_,reject)=>setTimeout(()=>reject(new Error("A consulta da banca ultrapassou 8 segundos. Tente novamente.")),8000));
  const job = Promise.race([request,deadline]).then(rows=>{
    if (!Array.isArray(rows)) throw Error("Resposta inválida da banca.");
    if (rows.length) {
      current=rows;
      loadedAt=Date.now();
    } else {
      current=undefined;loadedAt=0;
    }
    return rows;
  }).finally(()=>{
    if (inflight===job) inflight=undefined;
  });
  inflight=job;
  return job;
}
export function resetDocumentLawyersCache() {current=undefined;loadedAt=0;inflight=undefined;}

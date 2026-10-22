'use server';

import {retrieveAuthorizedCaseEvidence} from '@/lib/ai/lexis-superagent-evidence';

/**
 * Contexto autorizado da carteira para o motor local do navegador.
 * A ação não grava no banco e não consulta dados de outra empresa.
 * Mesmo com acesso ao endpoint, a checagem do escopo ocorre no servidor.
 */
export async function getSuperAgentCaseContextAction(question:string):Promise<string>{
 const q=String(question||'').trim().slice(0,400);
 if(!q)return '';
 return retrieveAuthorizedCaseEvidence(q);
}

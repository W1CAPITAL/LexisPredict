
'use server';

import { 
  getUserContext, 
  saveKnowledgeDocSystem, 
  saveKnowledgeChunksSystem, 
  searchKnowledgeChunksSystem,
  listKnowledgeDocs,
  deleteKnowledgeDoc,
  getSupabaseAdmin
} from '@/lib/server-db';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Unidade de Ingestão de Conhecimento v8.5
 * Gerencia o ciclo de vida de documentos e fragmentação de PDFs/Texto para aprendizado da IA.
 * Protocolo de Integridade: Extensão Soberana + Suporte a Texto Manual + Visibilidade de Empresa.
 */

const BANNED_TERMS = ['GET ASSESSORIA', 'GETASSESSORIA', 'W1 CAPITAL', 'W1CAPITAL', 'W1', 'GET'];

function cleanText(text: string): string {
  let cleaned = text;
  BANNED_TERMS.forEach(term => {
    const regex = new RegExp(term, 'gi');
    cleaned = cleaned.replace(regex, 'nosso escritório');
  });
  return cleaned;
}

/**
 * Função soberana de extração de texto para documentos técnicos.
 */
export async function extractTextResilient(buffer: Buffer, fileName: string): Promise<string> {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.endsWith('.pdf')) {
    try {
      const pdf = (await import('pdf-parse')).default;
      const data = await pdf(buffer);
      if (!data.text || data.text.trim().length < 5) throw new Error("PDF sem conteúdo textual.");
      return data.text;
    } catch (e: any) {
      throw new Error(`Falha estrutural no PDF (${e.message}). Converta este documento para .txt ou .md para ingestão segura.`);
    }
  } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
    return buffer.toString('utf-8');
  }
  
  throw new Error(`Formato não suportado para extração: ${fileName}`);
}

/**
 * Recupera documentos para visibilidade de toda a empresa.
 */
export async function fetchKnowledgeDocsAction() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, error: "Sessão expirada." };
  const docs = await listKnowledgeDocs(empresa_id);
  return { success: true, docs };
}

export async function deleteKnowledgeDocAction(docId: string) {
  const { empresa_id, isMasterView } = await getUserContext();
  if (!empresa_id || !isMasterView) return { success: false, error: "Acesso negado. Apenas supervisores podem excluir conhecimento." };
  return await deleteKnowledgeDoc(docId, empresa_id);
}

export async function uploadKnowledgeDocAction(formData: FormData) {
  try {
    const { empresa_id, isMasterView, auth_id } = await getUserContext();
    if (!empresa_id || !isMasterView) throw new Error("Permissão insuficiente. Apenas supervisores podem ensinar a IA.");

    const file = formData.get('file') as File | null;
    const rawTextContent = formData.get('rawText') as string | null;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const tagsStr = formData.get('tags') as string;
    const useInDispatch = formData.get('useInDispatch') === 'true';

    if (!file && !rawTextContent) throw new Error("Nenhum conteúdo enviado (arquivo ou texto).");

    const tags = tagsStr.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    const admin = await getSupabaseAdmin();
    
    // Validação de infraestrutura
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.find(b => b.name === 'knowledge')) {
      throw new Error("Bucket 'knowledge' inexistente no Storage.");
    }

    let finalExtractedText = "";
    let fileName = "";
    let fileToUpload: File | Blob;

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      finalExtractedText = await extractTextResilient(buffer, file.name);
      fileName = file.name;
      fileToUpload = file;
    } else if (rawTextContent) {
      finalExtractedText = rawTextContent;
      fileName = `manual_input_${Date.now()}.txt`;
      fileToUpload = new Blob([rawTextContent], { type: 'text/plain' });
    } else {
      throw new Error("Dados de entrada inválidos.");
    }

    const cleanExtractedText = cleanText(finalExtractedText);
    const uniqueFileName = `${Date.now()}_${fileName}`;
    const storagePath = `${empresa_id}/knowledge/${uniqueFileName}`;

    // Upload Storage
    const { error: uploadError } = await admin.storage
      .from('knowledge')
      .upload(storagePath, fileToUpload);

    if (uploadError) throw new Error(`Falha no Storage: ${uploadError.message}`);

    // Persistência com Schema Oficial
    const docRes = await saveKnowledgeDocSystem({
      empresa_id,
      created_by: auth_id,
      titulo: title,
      tipo: type,
      tags,
      storage_path: storagePath,
      uso_despacho: useInDispatch,
      ativo: true
    });

    if (!docRes.success || !docRes.data) {
      throw new Error(`Erro de Schema: ${docRes.error?.message || 'Falha nas colunas do banco'}`);
    }

    // Fragmentação (Chunking)
    const rawChunks = cleanExtractedText.split(/\n\s*\n/).filter(c => c.trim().length > 50);
    const chunksPayload = rawChunks.map((text, i) => ({
      doc_id: docRes.data.id,
      empresa_id,
      secao: `Seção ${i+1}`,
      texto: text.substring(0, 2000).trim(),
      tags: tags,
      uso_despacho: useInDispatch
    }));

    if (chunksPayload.length > 0) {
      await saveKnowledgeChunksSystem(chunksPayload);
    }

    revalidatePath('/settings');
    return { success: true, docId: docRes.data.id, chunks: chunksPayload.length };

  } catch (e: any) {
    console.error("[Knowledge Upload] Critical Fail:", e.message);
    return { success: false, error: e.message };
  }
}

export async function searchKnowledgeChunksAction(keywords: string[], empresaId: string) {
  const res = await searchKnowledgeChunksSystem(keywords, empresaId);
  return {
    success: res.success,
    chunks: res.data || []
  };
}

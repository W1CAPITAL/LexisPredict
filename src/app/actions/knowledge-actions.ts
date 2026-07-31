
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
 * @fileOverview Unidade de Ingestão de Conhecimento v6.1
 * Gerencia o ciclo de vida de documentos e fragmentação de PDFs para aprendizado da IA.
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

export async function fetchKnowledgeDocsAction() {
  const { empresa_id, isMasterView } = await getUserContext();
  if (!empresa_id || !isMasterView) return { success: false, error: "Acesso negado." };
  const docs = await listKnowledgeDocs(empresa_id);
  return { success: true, docs };
}

export async function deleteKnowledgeDocAction(docId: string) {
  const { empresa_id, isMasterView } = await getUserContext();
  if (!empresa_id || !isMasterView) return { success: false, error: "Acesso negado." };
  return await deleteKnowledgeDoc(docId, empresa_id);
}

export async function uploadKnowledgeDocAction(formData: FormData) {
  try {
    const { empresa_id, isMasterView, auth_id } = await getUserContext();
    if (!empresa_id || !isMasterView) throw new Error("Permissão insuficiente.");

    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const tagsStr = formData.get('tags') as string;
    const useInDispatch = formData.get('useInDispatch') === 'true';

    if (!file) throw new Error("Nenhum arquivo enviado.");

    const tags = tagsStr.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    const admin = await getSupabaseAdmin();
    
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${empresa_id}/knowledge/${fileName}`;

    // 1. Upload Storage
    const { error: uploadError } = await admin.storage
      .from('knowledge')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Extração de Texto
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let extractedText = "";

    if (file.type === 'application/pdf') {
      const pdf = (await import('pdf-parse')).default;
      const pdfData = await pdf(buffer);
      extractedText = pdfData.text || "";
    } else {
      extractedText = buffer.toString('utf-8');
    }

    const cleanExtractedText = cleanText(extractedText);

    // 3. Gravar Documento
    const docRes = await saveKnowledgeDocSystem({
      empresa_id,
      created_by: auth_id,
      title,
      type,
      tags,
      storage_path: filePath,
      use_in_dispatch: useInDispatch,
      active: true
    });

    if (!docRes.success || !docRes.data) throw new Error("Falha ao registrar documento.");

    // 4. Fragmentação (Chunks) - Split por parágrafos duplos ou seções
    const rawChunks = cleanExtractedText.split(/\n\s*\n/).filter(c => c.trim().length > 50);
    const chunksPayload = rawChunks.map((text, i) => ({
      doc_id: docRes.data.id,
      empresa_id,
      section: `Seção ${i+1}`,
      text: text.substring(0, 2000).trim(),
      tags: tags,
      use_in_dispatch: useInDispatch
    }));

    if (chunksPayload.length > 0) {
      await saveKnowledgeChunksSystem(chunksPayload);
    }

    revalidatePath('/settings');
    return { success: true, docId: docRes.data.id, chunks: chunksPayload.length };

  } catch (e: any) {
    console.error("[Knowledge Upload] Fail:", e.message);
    return { success: false, error: e.message };
  }
}

export async function searchKnowledgeChunksAction(keywords: string[], empresaId: string) {
  // Filtra apenas chunks de documentos marcados para uso em despacho e da empresa específica
  const res = await searchKnowledgeChunksSystem(keywords, empresaId);
  return {
    success: res.success,
    chunks: res.data || []
  };
}

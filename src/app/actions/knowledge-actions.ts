
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
 * @fileOverview Unidade de Ingestão de Conhecimento v7.0
 * Gerencia o ciclo de vida de documentos e fragmentação de PDFs para aprendizado da IA.
 * Protocolo de Integridade: Extensão Soberana + Anti-Lixo Binário.
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

    // 1. Decisão de Formato por Extensão (Soberana)
    const fileNameLower = file.name.toLowerCase();
    const isPdf = fileNameLower.endsWith('.pdf');
    const isText = fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.md');

    if (!isPdf && !isText) {
      throw new Error(`Formato não suportado: ${file.name}. Utilize apenas .pdf, .txt ou .md`);
    }

    const tags = tagsStr.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    const admin = await getSupabaseAdmin();
    
    // 2. Validação de Infraestrutura (Bucket)
    const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
    if (bucketError) throw new Error(`Falha ao validar infraestrutura: ${bucketError.message}`);
    if (!buckets?.find(b => b.name === 'knowledge')) {
      throw new Error("bucket knowledge inexistente");
    }

    const uniqueFileName = `${Date.now()}_${file.name}`;
    const storagePath = `${empresa_id}/knowledge/${uniqueFileName}`;

    // 3. Extração de Texto com Protocolo de Resiliência
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let extractedText = "";

    if (isPdf) {
      try {
        const pdf = (await import('pdf-parse')).default;
        const pdfData = await pdf(buffer);
        extractedText = pdfData.text || "";
      } catch (pdfErr: any) {
        // Bloqueia fallback binário. Exige transparência de erro.
        throw new Error(`Falha no parser de PDF (Bad XRef ou corrupção estrutural). Mensagem: ${pdfErr.message}. Por favor, converta este documento para .txt ou .md para ingestão segura.`);
      }
    } else {
      // Texto puro
      extractedText = buffer.toString('utf-8');
    }

    if (!extractedText || extractedText.trim().length < 5) {
      throw new Error("Falha na extração: o documento não contém texto processável suficiente.");
    }

    const cleanExtractedText = cleanText(extractedText);

    // 4. Upload Storage
    const { error: uploadError } = await admin.storage
      .from('knowledge')
      .upload(storagePath, file);

    if (uploadError) throw new Error(`Falha no upload do arquivo: ${uploadError.message}`);

    // 5. Gravar Documento (Payload alinhado com esquema Lexis v7)
    const docRes = await saveKnowledgeDocSystem({
      empresa_id,
      created_by: auth_id,
      title,
      type,
      tags,
      storage_path: storagePath,
      use_in_dispatch: useInDispatch,
      active: true
    });

    if (!docRes.success || !docRes.data) {
      throw new Error(`Erro ao registrar metadados: ${docRes.error?.message || 'Falha no banco'}`);
    }

    // 6. Fragmentação (Chunks)
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

'use server';

/**
 * @fileOverview Motor de Upload de Avatars v100.0
 * Gerencia o ciclo de vida das imagens de perfil no Supabase Storage.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/server-db';

const BUCKET_NAME = 'avatars';

export async function uploadUserAvatarAction(formData: FormData) {
  try {
    const { auth_id, empresa_id } = await getUserContext();
    if (!auth_id || !empresa_id) throw new Error("Sessão expirada.");

    const file = formData.get('file') as File;
    if (!file) throw new Error("Nenhum arquivo enviado.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Limite de 2MB excedido.");

    const supabase = await createClient();
    const fileExt = file.name.split('.').pop();
    const filePath = `${empresa_id}/users/${auth_id}.${fileExt}`;

    // Upload Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    // Obter URL Pública
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Update Database
    const { error: dbError } = await supabase
      .from('usuarios')
      .update({ avatar_url: publicUrl })
      .eq('auth_user_id', auth_id);

    if (dbError) throw dbError;

    return { success: true, url: publicUrl };
  } catch (e: any) {
    console.error("[Avatar Upload] Fail:", e.message);
    return { success: false, error: e.message };
  }
}

export async function uploadAdvogadoAvatarAction(advogadoId: string, formData: FormData) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) throw new Error("Sessão expirada.");

    const file = formData.get('file') as File;
    if (!file) throw new Error("Nenhum arquivo enviado.");

    const supabase = await createClient();
    const fileExt = file.name.split('.').pop();
    const filePath = `${empresa_id}/advogados/${advogadoId}.${fileExt}`;

    // Upload Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Update Database
    const { error: dbError } = await supabase
      .from('advogados_banca')
      .update({ avatar_url: publicUrl })
      .eq('id', advogadoId);

    if (dbError) throw dbError;

    return { success: true, url: publicUrl };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function removeAvatarAction(type: 'user' | 'advogado', id?: string) {
  try {
    const { auth_id, empresa_id } = await getUserContext();
    const supabase = await createClient();
    
    if (type === 'user' && auth_id) {
       await supabase.from('usuarios').update({ avatar_url: null }).eq('auth_user_id', auth_id);
    } else if (type === 'advogado' && id) {
       await supabase.from('advogados_banca').update({ avatar_url: null }).eq('id', id);
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

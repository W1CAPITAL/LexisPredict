'use server';

/**
 * Troca de senha do usuário logado (Supabase Auth).
 * Exige senha atual para confirmar a sessão.
 */

import { createClient } from '@/lib/supabase/server';

export type ChangePasswordResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ChangePasswordResult> {
  const current = String(input?.currentPassword || '');
  const next = String(input?.newPassword || '');
  const confirm = String(input?.confirmPassword || '');

  if (!current || !next) {
    return { success: false, error: 'Preencha a senha atual e a nova senha.' };
  }
  if (next.length < 8) {
    return { success: false, error: 'A nova senha deve ter pelo menos 8 caracteres.' };
  }
  if (next !== confirm) {
    return { success: false, error: 'A confirmação não confere com a nova senha.' };
  }
  if (current === next) {
    return { success: false, error: 'A nova senha deve ser diferente da atual.' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user?.email) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    }

    // Confirma senha atual
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signErr) {
      return { success: false, error: 'Senha atual incorreta.' };
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: next });
    if (updErr) {
      return {
        success: false,
        error: updErr.message || 'Não foi possível atualizar a senha.',
      };
    }

    return { success: true, message: 'Senha alterada com sucesso.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao alterar senha.' };
  }
}

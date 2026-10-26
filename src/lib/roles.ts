import type { UserRole } from '@/lib/supabase';

/**
 * Matriz oficial de permissões do LexisPredict Commercial.
 *
 * Operador:
 * - pode editar e atender todos os processos da própria empresa
 * - sem poderes administrativos de usuários ou segurança
 *
 * Administrador:
 * - todas as funções operacionais
 * - edição operacional em toda a empresa
 *
 * Supervisor:
 * - funções operacionais completas
 * - visão de toda a empresa
 * - supervisão por usuário / equipe / auditoria
 *
 * Superadmin:
 * - controle total do aplicativo
 * - segurança e administração global
 */

export const ROLE_WEIGHTS: Record<UserRole, number> = {
  Superadmin: 100,
  Supervisor: 80,
  Administrador: 60,
  Operador: 40,
  Visualizador: 20,
};

export type EffectiveRole =
  | 'Superadmin'
  | 'Supervisor'
  | 'Administrador'
  | 'Operador'
  | 'Visualizador'
  | 'Desconhecido';

export type RoleLike =
  | string
  | null
  | undefined
  | {
      cargo?: string | null;
      role?: string | null;
      perfil?: string | null;
      isSuperAdmin?: boolean;
      isSupervisor?: boolean;
    };

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function resolveRole(input?: RoleLike): EffectiveRole {
  if (!input) return 'Desconhecido';

  if (typeof input === 'object') {
    if (input.isSuperAdmin) return 'Superadmin';
    if (input.isSupervisor) return 'Supervisor';

    const blob = normalize(
      `${input.cargo || ''} ${input.role || ''} ${input.perfil || ''}`
    );

    if (/super\s*admin|superadmin/.test(blob)) return 'Superadmin';
    if (/\bsupervisor\b|\bsupervisao\b/.test(blob)) return 'Supervisor';
    if (/\badministrador\b|\badmin\b/.test(blob)) return 'Administrador';
    if (/\boperador\b|\boperator\b/.test(blob)) return 'Operador';
    if (/visualiz|viewer/.test(blob)) return 'Visualizador';
    return 'Desconhecido';
  }

  const role = normalize(input);
  if (/super\s*admin|superadmin/.test(role)) return 'Superadmin';
  if (/\bsupervisor\b|\bsupervisao\b/.test(role)) return 'Supervisor';
  if (/\badministrador\b|\badmin\b/.test(role)) return 'Administrador';
  if (/\boperador\b|\boperator\b/.test(role)) return 'Operador';
  if (/visualiz|viewer/.test(role)) return 'Visualizador';
  return 'Desconhecido';
}

export function getCargoWeight(cargo?: RoleLike): number {
  const role = resolveRole(cargo);
  return role === 'Desconhecido' ? 0 : ROLE_WEIGHTS[role];
}

/** Administrador ou superior. */
export function isAdminGroup(cargo?: RoleLike): boolean {
  return getCargoWeight(cargo) >= ROLE_WEIGHTS.Administrador;
}

/** Supervisor ou Superadmin: gestão/supervisão completa da empresa. */
export function isMasterView(cargo?: RoleLike): boolean {
  return getCargoWeight(cargo) >= ROLE_WEIGHTS.Supervisor;
}

/** Supervisor/Superadmin possuem visão ampla nas rotas de operação. */
export function canSeeCompanyProcesses(cargo?: RoleLike): boolean {
  return getCargoWeight(cargo) >= ROLE_WEIGHTS.Supervisor;
}

/**
 * Na rota /processos todos os membros autenticados podem consultar e atuar
 * sobre processos da PRÓPRIA empresa, mesmo quando o responsável é outro.
 * Equipe, segurança, relatórios gerenciais e outras rotas continuam com
 * suas próprias permissões. Esta função é somente para o fluxo de processos.
 */
export function canViewCompanyCaseList(cargo?: RoleLike): boolean {
  return resolveRole(cargo) !== 'Desconhecido';
}

export type CompanyCaseActor = { auth_id?: string | null; empresa_id?: string | null };

/** Gate para ações operacionais da carteira compartilhada.
 * A identidade e empresa devem vir exclusivamente do getUserContext no servidor.
 * Não chamar com parâmetros de URL ou perfil enviado pelo navegador.
 */
export function canOperateCompanyCases(ctx: CompanyCaseActor): boolean {
  return Boolean(ctx.auth_id && ctx.empresa_id);
}

export type CaseScope = 'mine' | 'empresa';

/**
 * Fonte única de escopo da carteira.
 * - Supervisor/Superadmin => empresa
 * - Administrador/Operador/Visualizador => mine (listagem padrão; busca da empresa independente)
 */
export function resolveCaseScope(cargo?: RoleLike): CaseScope {
  return canSeeCompanyProcesses(cargo) ? 'empresa' : 'mine';
}


export function canSuperviseCompany(cargo?: RoleLike): boolean {
  return isMasterView(cargo);
}

export function canManageTeam(cargo?: RoleLike): boolean {
  return isMasterView(cargo);
}

export function canAuditCompany(cargo?: RoleLike): boolean {
  return isMasterView(cargo);
}

export function canUseAllOperationalFeatures(cargo?: RoleLike): boolean {
  return isAdminGroup(cargo);
}

export function canUseReducedOperationalFeatures(cargo?: RoleLike): boolean {
  return getCargoWeight(cargo) >= ROLE_WEIGHTS.Operador;
}

export function canCreateCase(cargo?: RoleLike): boolean {
  return canUseReducedOperationalFeatures(cargo);
}

export function canEditCase(cargo?: RoleLike): boolean {
  return canUseReducedOperationalFeatures(cargo);
}

/** Regra LEGADA para outras telas (ex. /cases). Não aplicar a /processos:
 * nessa rota, todos os membros autenticados da mesma empresa podem excluir,
 * com empresa validada no servidor e auditoria de autor.
 * Use canOperateCompanyCases(ctx) + canAccessExistingCase(ctx,row).
 */
export function canDeleteCase(cargo?: RoleLike): boolean {
  return isAdminGroup(cargo);
}

/** Exportação e scanners são funções operacionais completas. */
export function canExportOperationalData(cargo?: RoleLike): boolean {
  return isAdminGroup(cargo);
}

export function canRunOperationalScanner(cargo?: RoleLike): boolean {
  return isAdminGroup(cargo);
}

export function canCopyOperationalContent(cargo?: RoleLike): boolean {
  return canUseReducedOperationalFeatures(cargo);
}

export function canAccessSecurity(cargo?: RoleLike): boolean {
  return resolveRole(cargo) === 'Superadmin';
}

export function canAccessSuperadmin(cargo?: RoleLike): boolean {
  return resolveRole(cargo) === 'Superadmin';
}

/**
 * Rotas de trabalho permitidas ao Operador (o plano ainda limita recursos).
 * Supervisão, usuários, auditoria e segurança permanecem protegidos no middleware.
 */
const OPERATOR_ALLOWED_ROOTS = [
  '/',
  '/cases',
  '/processos',
  '/fases-provas',
  '/tarefas',
  '/vencidos',
  '/agenda',
  '/whatsapp',
  '/dossies',
  '/documents',
  '/processos-parados',
  '/encerrados-revisao',
  '/cumprimentos-procedentes',
  '/busca-apreensao',
  '/gerador-processos',
  '/report',
  '/analises-internas',
  '/minhas-atividades',
  '/crm',
  '/veredito',
  '/chat',
  '/financas',
  '/calculos',
  '/import',
  '/mensagens',
  '/notes',
  '/onboarding',
  '/settings',
  '/primeiro-acesso',
  '/setup-empresa',
];

export function operatorRouteAllowed(pathname: string): boolean {
  const path = String(pathname || '/');
  return OPERATOR_ALLOWED_ROOTS.some(
    (root) => path === root || (root !== '/' && path.startsWith(root + '/'))
  );
}

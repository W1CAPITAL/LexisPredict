import type { UserRole } from '@/lib/supabase';

/**
 * Matriz oficial de permissões do LexisPredict Commercial.
 *
 * Operador:
 * - operação reduzida
 * - somente processos próprios
 *
 * Administrador:
 * - todas as funções operacionais
 * - somente o próprio escopo de processos
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

/** Somente Supervisor/Superadmin consultam a carteira consolidada da empresa. */
export function canSeeCompanyProcesses(cargo?: RoleLike): boolean {
  return getCargoWeight(cargo) >= ROLE_WEIGHTS.Supervisor;
}

export type CaseScope = 'mine' | 'empresa';

/**
 * Fonte única de escopo da carteira.
 * - Supervisor/Superadmin => empresa
 * - Administrador/Operador/Visualizador => mine
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

/** Operador não exclui; Administrador ou superior pode excluir dentro do próprio escopo. */
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
 * Rotas permitidas ao Operador.
 * Outras rotas operacionais exigem Administrador ou superior.
 */
const OPERATOR_ALLOWED_ROOTS = [
  '/',
  '/cases',
  '/tarefas',
  '/agenda',
  '/whatsapp',
  '/documents',
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

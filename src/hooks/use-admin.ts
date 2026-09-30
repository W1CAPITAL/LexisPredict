"use client";

import { useAuth } from '@/components/auth/auth-provider';
import {
  canAccessSecurity,
  canAccessSuperadmin,
  canAuditCompany,
  canCopyOperationalContent,
  canCreateCase,
  canDeleteCase,
  canExportOperationalData,
  canManageTeam,
  canRunOperationalScanner,
  canSeeCompanyProcesses,
  canSuperviseCompany,
  canUseAllOperationalFeatures,
  canUseReducedOperationalFeatures,
  resolveRole,
} from '@/lib/roles';

export function useAdmin() {
  const { profile, loading, signOut } = useAuth();
  const role = resolveRole(profile as any);

  const isSuperAdmin = role === 'Superadmin';
  const isSupervisor = role === 'Supervisor' || isSuperAdmin;
  const isAdmin =
    role === 'Administrador' || role === 'Supervisor' || role === 'Superadmin';
  const isOperador = canUseReducedOperationalFeatures(profile as any);
  const isViewer = role === 'Visualizador';

  const canExport = canExportOperationalData(profile as any);
  const canScan = canRunOperationalScanner(profile as any);
  const canCopy = canCopyOperationalContent(profile as any);
  const canCreate = canCreateCase(profile as any);
  const canDelete = canDeleteCase(profile as any);
  const canSeeCompany = canSeeCompanyProcesses(profile as any);
  const canSupervise = canSuperviseCompany(profile as any);
  const canManageUsers = canManageTeam(profile as any);
  const canAudit = canAuditCompany(profile as any);
  const canUseAllOperational = canUseAllOperationalFeatures(profile as any);
  const canSecurity = canAccessSecurity(profile as any);
  const canSuperadmin = canAccessSuperadmin(profile as any);

  const login = async (_password?: string) => {
    console.warn(
      '[useAdmin] login() no client está desativado por segurança. Use verifyMasterPasswordAction.'
    );
    return false;
  };

  return {
    profile,
    loading,
    role,
    isAdmin,
    isOperador,
    isSuperAdmin,
    isSupervisor,
    isViewer,
    canExport,
    canScan,
    canCopy,
    canCreate,
    canDelete,
    canSeeCompany,
    canSupervise,
    canManageUsers,
    canAudit,
    canUseAllOperational,
    canSecurity,
    canSuperadmin,
    login,
    logout: signOut,
    isAuthenticated: !!profile,
  };
}

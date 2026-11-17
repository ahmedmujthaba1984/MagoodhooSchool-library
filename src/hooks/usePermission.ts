import { useMemo } from 'react';
import { AccessRole, UserProfile } from '../types';
import {
  Permission,
  ROLE_DEFINITIONS,
  RoleDefinition,
  getPermissionDeniedReason,
  getPermissionsForRole,
  hasPermission,
  resolveAccessRole,
} from '../lib/rbac';
import { useLanguage } from '../lib/i18n';

export interface UsePermissionResult {
  accessRole: AccessRole;
  roleMeta: RoleDefinition;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  cannotReason: (permission: Permission) => string;
  isSuperAdmin: boolean;
  isDeskAssistant: boolean;
  isTeacher: boolean;
  isStudentOrGuest: boolean;
}

export function usePermission(user?: UserProfile | null): UsePermissionResult {
  const { language } = useLanguage();

  return useMemo(() => {
    const accessRole = resolveAccessRole(user);
    const roleMeta = ROLE_DEFINITIONS[accessRole];
    const permissions =
      !user || user.id === 'guest'
        ? (['opac:read'] as Permission[])
        : getPermissionsForRole(accessRole);

    const can = (permission: Permission) => hasPermission(user, permission);
    const canAny = (list: Permission[]) => list.some((p) => can(p));
    const cannotReason = (permission: Permission) =>
      getPermissionDeniedReason(user, permission, language);

    return {
      accessRole,
      roleMeta,
      permissions,
      can,
      canAny,
      cannotReason,
      isSuperAdmin: accessRole === 'super_admin',
      isDeskAssistant: accessRole === 'desk_assistant',
      isTeacher: accessRole === 'teacher',
      isStudentOrGuest: accessRole === 'student_guest',
    };
  }, [user, language]);
}

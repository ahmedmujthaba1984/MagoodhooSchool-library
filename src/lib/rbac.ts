import { AccessRole, UserProfile } from '../types';

export type Permission =
  | 'opac:read'
  | 'holds:create'
  | 'holds:extended_classroom'
  | 'personal_library:manage'
  | 'circulation:checkout'
  | 'circulation:checkin'
  | 'circulation:renew'
  | 'circulation:holds_manage'
  | 'analytics:class_reading'
  | 'ai:lesson_plan_matcher'
  | 'fines:collect'
  | 'fines:waive'
  | 'catalog:create_edit'
  | 'catalog:delete'
  | 'policies:edit'
  | 'users:manage_roles'
  | 'ai:admin_settings'
  | 'data:import_export'
  | 'data:backup_restore'
  | 'audit:view'
  | 'notifications:send';

export interface RoleDefinition {
  id: AccessRole;
  label: string;
  labelDv: string;
  summary: string;
  summaryDv: string;
  permissions: Permission[];
}

export const PERMISSION_LABELS: Record<Permission, { label: string; labelDv: string; category: string }> = {
  'opac:read': { label: 'Read-only OPAC Search', labelDv: 'ކެޓަލޮގް ބެލުން', category: 'OPAC & Personal' },
  'holds:create': { label: 'Self-Service Holds', labelDv: 'ފޮތް ނަންނޯޓުކުރުން', category: 'OPAC & Personal' },
  'holds:extended_classroom': { label: 'Extended Classroom Holds', labelDv: 'ކްލާސްރޫމް ރިޒަވޭޝަން', category: 'Teaching & Analytics' },
  'personal_library:manage': { label: 'Personal Reading Collection', labelDv: 'އަމިއްލަ ލައިބްރަރީ', category: 'OPAC & Personal' },
  'circulation:checkout': { label: 'Check-Out Loans', labelDv: 'ފޮތް ދޫކުރުން', category: 'Circulation Desk' },
  'circulation:checkin': { label: 'Check-In Returns', labelDv: 'ފޮތް ހަވާލުކުރުން', category: 'Circulation Desk' },
  'circulation:renew': { label: 'Renew Loans', labelDv: 'މުއްދަތު އިތުރުކުރުން', category: 'Circulation Desk' },
  'circulation:holds_manage': { label: 'Manage Hold Queue', labelDv: 'ހޯލްޑްތައް ބެލެހެއްޓުން', category: 'Circulation Desk' },
  'analytics:class_reading': { label: 'Class Reading Analytics', labelDv: 'ކްލާސް ކިޔުމުގެ ތަފާސްހިސާބު', category: 'Teaching & Analytics' },
  'ai:lesson_plan_matcher': { label: 'AI Lesson Plan Matcher', labelDv: 'އޭއައި ލެސަން މެޗަރ', category: 'Teaching & Analytics' },
  'fines:collect': { label: 'Collect Cash Fine Payments', labelDv: 'ޖޫރިމަނާ ބަލައިގަތުން', category: 'Finance & Catalog' },
  'fines:waive': { label: 'Waive Fines & Edit Balances', labelDv: 'ޖޫރިމަނާ މަޢާފުކުރުން', category: 'Finance & Catalog' },
  'catalog:create_edit': { label: 'Add & Edit Catalog Titles', labelDv: 'ފޮތް އިތުރުކުރުމާއި އެޑިޓްކުރުން', category: 'Finance & Catalog' },
  'catalog:delete': { label: 'Delete Catalog Titles / Copies', labelDv: 'ފޮތް/ކޮޕީ ފޮހެލުން', category: 'Finance & Catalog' },
  'policies:edit': { label: 'Edit Library Policies & MVR Rules', labelDv: 'ސިޔާސަތުތައް ބަދަލުކުރުން', category: 'Security & Systems' },
  'users:manage_roles': { label: 'Manage User Roles (RBAC)', labelDv: 'މެންބަރުންގެ ރޯލް ބެލެހެއްޓުން', category: 'Security & Systems' },
  'ai:admin_settings': { label: 'AI Diagnostics & Config', labelDv: 'އޭއައި ސެޓިންގްސް', category: 'Security & Systems' },
  'data:import_export': { label: 'Bulk CSV Import & Export', labelDv: 'ބަލްކް ޑޭޓާ އެތެރެ/ބޭރުކުރުން', category: 'Security & Systems' },
  'data:backup_restore': { label: 'Encrypted Backup & Restore', labelDv: 'ބެކަޕް އަދި ރިސްޓޯރ', category: 'Security & Systems' },
  'audit:view': { label: 'View Immutable Audit Trail', labelDv: 'އޮޑިޓް ލޮގް ބެލުން', category: 'Security & Systems' },
  'notifications:send': { label: 'Send Overdue & Hold Notices', labelDv: 'މެސެޖު އަދި ސްލިޕް ފޮނުވުން', category: 'Security & Systems' },
};

const STUDENT_GUEST_PERMS: Permission[] = [
  'opac:read',
  'holds:create',
  'personal_library:manage',
];

const TEACHER_PERMS: Permission[] = [
  ...STUDENT_GUEST_PERMS,
  'holds:extended_classroom',
  'analytics:class_reading',
  'ai:lesson_plan_matcher',
];

const DESK_ASSISTANT_PERMS: Permission[] = [
  'opac:read',
  'holds:create',
  'personal_library:manage',
  'circulation:checkout',
  'circulation:checkin',
  'circulation:renew',
  'circulation:holds_manage',
  'fines:collect',
  'notifications:send',
];

const SUPER_ADMIN_PERMS: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

export const ROLE_DEFINITIONS: Record<AccessRole, RoleDefinition> = {
  super_admin: {
    id: 'super_admin',
    label: 'Super Admin (Lead Librarian / IT)',
    labelDv: 'ސުޕަރ އެޑްމިން (ހެޑް ލައިބްރޭރިއަން)',
    summary: 'Full access to policies, fine waivers, user roles, AI diagnostics, bulk import/export, and backup/restore.',
    summaryDv: 'އުޞޫލުތަކާއި، ޖޫރިމަނާ މަޢާފުކުރުމާއި، ރޯލްތަކާއި، ބެކަޕްގެ ފުރިހަމަ ބާރު.',
    permissions: SUPER_ADMIN_PERMS,
  },
  desk_assistant: {
    id: 'desk_assistant',
    label: 'Circulation Desk Assistant / Prefect',
    labelDv: 'ސާކިއުލޭޝަން އެސިސްޓަންޓް / ޕްރީފެކްޓް',
    summary: 'Can run Check-In, Check-Out, Holds, and OPAC search; cannot waive fines, delete records, or alter policies.',
    summaryDv: 'ފޮތް ދޫކޮށް ހަވާލުކުރެވޭނެ؛ ޖޫރިމަނާ މަޢާފުކުރުމާއި ފޮތް ފޮހެލުމެއް ނުކުރެވޭނެ.',
    permissions: DESK_ASSISTANT_PERMS,
  },
  teacher: {
    id: 'teacher',
    label: 'Teacher (Faculty)',
    labelDv: 'މުދައްރިސް',
    summary: 'Can view class reading analytics, run AI Lesson Plan Matcher, place extended classroom holds, and manage personal collections.',
    summaryDv: 'ކްލާސް ތަފާސްހިސާބާއި، އޭއައި ލެސަން މެޗަރ އަދި ކްލާސްރޫމް ރިޒަވޭޝަން.',
    permissions: TEACHER_PERMS,
  },
  student_guest: {
    id: 'student_guest',
    label: 'Student / Parent / Guest',
    labelDv: 'ދަރިވަރު / ބެލެނިވެރިޔާ / މެހެމާނު',
    summary: 'Read-only OPAC catalog discovery, self-service holds (when signed in), and personal reading tracker.',
    summaryDv: 'ކެޓަލޮގް ބެލުމާއި، ނަންނޯޓުކުރުމާއި، އަމިއްލަ ކިޔުމުގެ ލިސްޓު.',
    permissions: STUDENT_GUEST_PERMS,
  },
};

export function resolveAccessRole(user?: UserProfile | null): AccessRole {
  if (!user) return 'student_guest';
  if (user.accessRole && ROLE_DEFINITIONS[user.accessRole]) {
    return user.accessRole;
  }
  if (user.role === 'admin') return 'super_admin';
  if (user.role === 'staff') {
    return user.patronTier === 'staff' && !user.staffDepartment?.toLowerCase().includes('faculty')
      ? 'desk_assistant'
      : 'teacher';
  }
  return 'student_guest';
}

export function getPermissionsForRole(role: AccessRole): Permission[] {
  return ROLE_DEFINITIONS[role]?.permissions || STUDENT_GUEST_PERMS;
}

export function hasPermission(
  user: UserProfile | null | undefined,
  permission: Permission
): boolean {
  if (!user || user.id === 'guest') {
    return permission === 'opac:read';
  }
  const accessRole = resolveAccessRole(user);
  return getPermissionsForRole(accessRole).includes(permission);
}

export function getPermissionDeniedReason(
  user: UserProfile | null | undefined,
  permission: Permission,
  language: 'en' | 'dv' = 'en'
): string {
  const accessRole = resolveAccessRole(user);
  const permMeta = PERMISSION_LABELS[permission];
  if (language === 'dv') {
    return `ހުއްދަ ނެތް: "${permMeta.labelDv}" ކުރުމުގެ ހުއްދަ ${ROLE_DEFINITIONS[accessRole].labelDv} އަކަށް ނެތް.`;
  }
  return `Access restricted: "${permMeta.label}" is not permitted for ${ROLE_DEFINITIONS[accessRole].label}.`;
}

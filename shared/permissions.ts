export type UserRole = 'admin' | 'manager' | 'worker';

export const ROLES = {
  ADMIN: 'admin' as const,
  MANAGER: 'manager' as const,
  WORKER: 'worker' as const,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  worker: 'Worker',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full access: manage team, billing, all projects, and company settings',
  manager: 'Create projects, assign tasks, view all photos and timecards',
  worker: 'Take photos, complete assigned tasks, view own timecards',
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  manager: 2,
  worker: 1,
};

export type Permission = 
  | 'create_project'
  | 'delete_project'
  | 'edit_project'
  | 'view_all_projects'
  | 'invite_team'
  | 'remove_team'
  | 'change_roles'
  | 'manage_billing'
  | 'assign_tasks'
  | 'take_photos'
  | 'view_own_timecard'
  | 'view_all_timecards'
  | 'export_timecards'
  | 'manage_company_settings'
  | 'generate_invite_link';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'create_project',
    'delete_project',
    'edit_project',
    'view_all_projects',
    'invite_team',
    'remove_team',
    'change_roles',
    'manage_billing',
    'assign_tasks',
    'take_photos',
    'view_own_timecard',
    'view_all_timecards',
    'export_timecards',
    'manage_company_settings',
    'generate_invite_link',
  ],
  manager: [
    'create_project',
    'edit_project',
    'view_all_projects',
    'assign_tasks',
    'take_photos',
    'view_own_timecard',
    'view_all_timecards',
    'export_timecards',
  ],
  worker: [
    'take_photos',
    'view_own_timecard',
  ],
};

export function hasPermission(role: UserRole | string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const userRole = role as UserRole;
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function canChangeRole(currentUserRole: UserRole, targetCurrentRole: UserRole, targetNewRole: UserRole): boolean {
  if (currentUserRole !== 'admin') return false;
  return true;
}

export function isRoleHigherOrEqual(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
}

export function getAllRoles(): UserRole[] {
  return ['admin', 'manager', 'worker'];
}

export type PermissionRole =
  | 'super_admin'
  | 'school_admin'
  | 'payroll_admin'
  | 'accountant'
  | 'bursar'
  | 'hr_admin'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'unknown';

export type PermissionAction = 'view' | 'manage' | 'approve';
export type PermissionResource =
  | 'payroll'
  | 'payroll_self'
  | 'finance'
  | 'fees'
  | 'staff_data'
  | 'admin_cms'
  | 'results_publish';

export interface PermissionContext {
  role?: string | null;
  permissions?: string[];
  userId?: string;
}

const ROLE_ALIASES: Record<string, PermissionRole> = {
  super_admin: 'super_admin',
  'super admin': 'super_admin',
  admin: 'school_admin',
  principal: 'school_admin',
  'school owner': 'school_admin',
  'school_admin': 'school_admin',
  accountant: 'payroll_admin',
  'payroll admin': 'payroll_admin',
  payroll_admin: 'payroll_admin',
  bursar: 'bursar',
  'fees officer': 'bursar',
  'finance': 'accountant',
  'hr admin': 'hr_admin',
  hr_admin: 'hr_admin',
  teacher: 'teacher',
  'team lead': 'teacher',
  team_lead: 'teacher',
  counselor: 'teacher',
  maintenance: 'teacher',
  librarian: 'teacher',
  nurse: 'teacher',
  security: 'teacher',
  driver: 'teacher',
  'lab technician': 'teacher',
  student: 'student',
  parent: 'parent',
  guardian: 'parent',
};

const PERMISSION_MATRIX: Record<PermissionRole, Partial<Record<PermissionResource, PermissionAction[]>>> = {
  super_admin: { payroll: ['manage', 'view'], payroll_self: ['view'], finance: ['manage', 'view'], fees: ['manage', 'view'], staff_data: ['manage', 'view'], admin_cms: ['manage', 'view'], results_publish: ['approve'] },
  school_admin: { payroll: ['manage', 'view'], payroll_self: ['view'], finance: ['manage', 'view'], fees: ['manage', 'view'], staff_data: ['manage', 'view'], admin_cms: ['manage', 'view'], results_publish: ['approve'] },
  payroll_admin: { payroll: ['manage', 'view'], payroll_self: ['view'], finance: ['manage', 'view'], staff_data: ['view'] },
  accountant: { payroll: ['manage', 'view'], payroll_self: ['view'], finance: ['manage', 'view'], fees: ['view'] },
  bursar: { fees: ['manage', 'view'], payroll_self: ['view'] },
  hr_admin: { staff_data: ['manage', 'view'], payroll_self: ['view'] },
  teacher: { payroll_self: ['view'] },
  student: {},
  parent: { payroll_self: ['view'] },
  unknown: { payroll_self: ['view'] },
};

const normalizeRole = (role?: string | null): PermissionRole => {
  if (!role) return 'unknown';
  const key = role.trim().toLowerCase();
  return ROLE_ALIASES[key] ?? 'unknown';
};

export const hasExplicitPermission = (permission: string | undefined, context: PermissionContext): boolean => {
  if (!permission) return false;
  if (context.permissions?.includes('*')) return true;
  return context.permissions?.includes(permission) ?? false;
};

export const can = (
  context: PermissionContext,
  action: PermissionAction,
  resource: PermissionResource,
  resourceOwnerId?: string | null
): boolean => {
  if (hasExplicitPermission('manage-payroll', context) && resource === 'payroll') return true;
  if (hasExplicitPermission('manage-finance', context) && (resource === 'finance' || resource === 'fees' || resource === 'payroll')) return true;

  const role = normalizeRole(context.role);
  const allowedActions = PERMISSION_MATRIX[role]?.[resource] || [];

  if (resource === 'payroll_self') {
    if (resourceOwnerId && context.userId && resourceOwnerId === context.userId) {
      return allowedActions.includes(action) 
        || allowedActions.includes('manage') 
        || hasExplicitPermission('view-my-payroll', context)
        || (context.role?.toLowerCase() !== 'student');
    }
    return false;
  }

  if (allowedActions.includes(action) || allowedActions.includes('manage')) return true;

  return false;
};

export const canViewPayroll = (context: PermissionContext) => can(context, 'view', 'payroll');
export const canManagePayroll = (context: PermissionContext) => can(context, 'manage', 'payroll');
export const canViewOwnPayslip = (context: PermissionContext, ownerId: string) => can(context, 'view', 'payroll_self', ownerId);

export const useCan = (context: PermissionContext) => {
  return (action: PermissionAction, resource: PermissionResource, resourceOwnerId?: string | null) =>
    can(context, action, resource, resourceOwnerId);
};

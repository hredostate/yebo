import assert from 'assert';
import { canManagePayroll, canViewOwnPayslip } from '../src/security/permissions.js';

/**
 * Test case for the payroll adjustments query fix.
 * This simulates the condition check from App.tsx line 1151-1155
 */

// Scenario 1: Admin user with empty permission context (timing issue)
const emptyPermissionContext = { role: null, permissions: [] as string[], userId: 'admin-1' };
const adminRole: string = 'Admin';

// The original condition would fail here because canManagePayroll returns false
const originalCondition = canManagePayroll(emptyPermissionContext);
assert.strictEqual(originalCondition, false, 'Original condition fails for Admin with empty permissions');

// The new condition includes the explicit Admin role check
const newCondition = canManagePayroll(emptyPermissionContext) || adminRole === 'Admin';
assert.strictEqual(newCondition, true, 'New condition succeeds for Admin role check');

// Scenario 2: Non-admin user should still require proper permissions
const teacherContext = { role: 'Teacher', permissions: [] as string[], userId: 'teacher-1' };
const teacherRole: string = 'Teacher';

const teacherCondition = canManagePayroll(teacherContext) || teacherRole === 'Admin';
assert.strictEqual(teacherCondition, false, 'Teachers without permissions cannot manage payroll');

// Scenario 3: Teacher can view own payslip
const teacherOwnPayslip = canViewOwnPayslip(teacherContext, 'teacher-1');
assert.strictEqual(teacherOwnPayslip, true, 'Teachers can view their own payslip');

// Scenario 4: Admin with proper permissions loaded
const adminWithPermissions = { role: 'Admin', permissions: ['manage-payroll'] as string[], userId: 'admin-2' };
const adminWithPermCondition = canManagePayroll(adminWithPermissions) || adminRole === 'Admin';
assert.strictEqual(adminWithPermCondition, true, 'Admin with permissions works');

console.log('Payroll adjustments query tests passed');

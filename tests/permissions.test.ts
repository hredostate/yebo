import assert from 'assert';
import { can, canManagePayroll, canViewOwnPayslip, canViewPayroll } from '../src/security/permissions.js';

const teacherContext = { role: 'Teacher', permissions: ['view-dashboard'] as string[], userId: 'teacher-1' };
const accountantContext = { role: 'Accountant', permissions: ['manage-payroll'] as string[], userId: 'acct-1' };

assert.strictEqual(can(teacherContext, 'view', 'payroll'), false, 'Teachers must not view payroll');
assert.strictEqual(canManagePayroll(teacherContext), false, 'Teachers must not manage payroll');
assert.strictEqual(canViewOwnPayslip(teacherContext, 'teacher-1'), true, 'Teachers should view their own payslip only');
assert.strictEqual(canViewOwnPayslip(teacherContext, 'other'), false, 'Teachers cannot view other payslips');

assert.strictEqual(canViewPayroll(accountantContext), true, 'Accountants should view payroll');
assert.strictEqual(canManagePayroll(accountantContext), true, 'Accountants should manage payroll');

console.log('Permission matrix checks passed');

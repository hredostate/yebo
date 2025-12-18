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

// Team Lead tests
const teamLeadContext = { role: 'Team Lead', permissions: ['view-dashboard'] as string[], userId: 'lead-1' };
assert.strictEqual(can(teamLeadContext, 'view', 'payroll'), false, 'Team Leads must not view full payroll');
assert.strictEqual(canViewOwnPayslip(teamLeadContext, 'lead-1'), true, 'Team Leads should view their own payslip');
assert.strictEqual(canViewOwnPayslip(teamLeadContext, 'other-user'), false, 'Team Leads cannot view other payslips');

// Counselor tests
const counselorContext = { role: 'Counselor', permissions: ['view-dashboard'] as string[], userId: 'counselor-1' };
assert.strictEqual(canViewOwnPayslip(counselorContext, 'counselor-1'), true, 'Counselors should view their own payslip');

// Maintenance tests
const maintenanceContext = { role: 'Maintenance', permissions: [] as string[], userId: 'maint-1' };
assert.strictEqual(canViewOwnPayslip(maintenanceContext, 'maint-1'), true, 'Maintenance staff should view their own payslip');

// Student must NOT have access (critical security check)
const studentContext = { role: 'Student', permissions: [] as string[], userId: 'student-1' };
assert.strictEqual(can(studentContext, 'view', 'payroll_self', 'student-1'), false, 'Students must NOT view payroll');

console.log('Permission matrix checks passed');

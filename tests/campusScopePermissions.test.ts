import assert from 'assert';
import { canViewSitewide } from '../src/security/permissions.js';

// Test super_admin has view-sitewide permission
const superAdminContext = { role: 'super_admin', permissions: [] as string[], userId: 'super-1' };
assert.strictEqual(canViewSitewide(superAdminContext), true, 'Super admin should have sitewide view permission');

// Test school_admin has view-sitewide permission
const schoolAdminContext = { role: 'school_admin', permissions: [] as string[], userId: 'admin-1' };
assert.strictEqual(canViewSitewide(schoolAdminContext), true, 'School admin should have sitewide view permission');

// Test admin alias has view-sitewide permission
const adminContext = { role: 'admin', permissions: [] as string[], userId: 'admin-2' };
assert.strictEqual(canViewSitewide(adminContext), true, 'Admin (alias) should have sitewide view permission');

// Test principal alias has view-sitewide permission
const principalContext = { role: 'principal', permissions: [] as string[], userId: 'principal-1' };
assert.strictEqual(canViewSitewide(principalContext), true, 'Principal should have sitewide view permission');

// Test teacher does not have view-sitewide permission
const teacherContext = { role: 'teacher', permissions: [] as string[], userId: 'teacher-1' };
assert.strictEqual(canViewSitewide(teacherContext), false, 'Teacher should not have sitewide view permission');

// Test payroll_admin does not have view-sitewide permission
const payrollAdminContext = { role: 'payroll_admin', permissions: [] as string[], userId: 'payroll-1' };
assert.strictEqual(canViewSitewide(payrollAdminContext), false, 'Payroll admin should not have sitewide view permission');

// Test student does not have view-sitewide permission
const studentContext = { role: 'student', permissions: [] as string[], userId: 'student-1' };
assert.strictEqual(canViewSitewide(studentContext), false, 'Student should not have sitewide view permission');

// Test explicit permission grants access
const explicitPermContext = { role: 'teacher', permissions: ['view-sitewide'] as string[], userId: 'teacher-2' };
assert.strictEqual(canViewSitewide(explicitPermContext), true, 'User with explicit view-sitewide permission should have access');

// Test wildcard permission grants access
const wildcardContext = { role: 'unknown', permissions: ['*'] as string[], userId: 'user-1' };
assert.strictEqual(canViewSitewide(wildcardContext), true, 'User with wildcard permission should have sitewide access');

console.log('Campus scope permission checks passed');

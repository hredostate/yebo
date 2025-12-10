# Payroll Calculation Fix Documentation

## Overview
This document describes the fix for critical payroll calculation bugs in the `run-payroll` edge function that were causing incorrect net pay calculations.

## Problem Description

### Issue 1: Incorrect Adjustment Calculation
The backend was adding ALL adjustments together, ignoring the `adjustment_type` field that determines whether an adjustment should be added (bonus, reimbursement) or subtracted (tax, penalty, deduction).

**Location**: `supabase/functions/run-payroll/index.ts` line 72

**Before Fix**:
```typescript
const totalAdjustments = adjustments.reduce((sum: number, adj: { amount: number }) => sum + adj.amount, 0);
```

This meant a staff member with:
- Base pay: ₦100,000
- Bonus: ₦10,000 (addition)
- Tax: ₦5,000 (deduction)

Would incorrectly receive:
- totalAdjustments = 10,000 + 5,000 = 15,000
- Net pay = 100,000 + 15,000 = **₦115,000** ❌ (Should be ₦105,000)

### Issue 2: Incorrect Database Storage
Adjustments were stored in the database without proper sign indication, making it impossible to distinguish additions from deductions in historical records.

### Issue 3: Duplicate and Malformed Code
The edge function contained multiple instances of duplicate code blocks:
- Duplicate `recipientCode` variable declaration (lines 83-86)
- Duplicate transfer push logic (lines 112-119 and 156-167)
- Duplicate insert statements (lines 199-203)
- Duplicate and malformed response handling (lines 226-256)
- Reference to undefined `generateTransferReference` function (line 154)

## Solution

### Fix 1: Proper Adjustment Type Handling
**Location**: `supabase/functions/run-payroll/index.ts` lines 72-74

**After Fix**:
```typescript
const totalAdjustments = adjustments.reduce((sum: number, adj: { amount: number; adjustment_type: string }) => {
    return adj.adjustment_type === 'addition' ? sum + adj.amount : sum - adj.amount;
}, 0);
```

Now the calculation correctly:
- **Adds** amounts when `adjustment_type === 'addition'` (bonuses, reimbursements)
- **Subtracts** amounts when `adjustment_type === 'deduction'` (taxes, penalties)

This matches the existing frontend logic in `PayrollPage.tsx:321-323`.

### Fix 2: Correct Database Storage Sign
**Location**: `supabase/functions/run-payroll/index.ts` lines 135-138

**After Fix**:
```typescript
const deductionsForDb = adjustments.map((adj: { reason: string; amount: number; adjustment_type: string }) => ({ 
    label: adj.reason, 
    amount: adj.adjustment_type === 'addition' ? adj.amount : -adj.amount 
}));
```

Now database records store:
- Positive amounts for additions
- Negative amounts for deductions

### Fix 3: Code Cleanup
Removed 53 lines of duplicate/malformed code:
- ✅ Single `recipientCode` declaration
- ✅ Single transfer push operation
- ✅ Single insert statement
- ✅ Clean, linear response handling
- ✅ Removed undefined function calls

## Verification

### Example Calculation
For a staff member with:
- Gross pay: ₦100,000
- Bonus (addition): ₦10,000
- Tax (deduction): ₦5,000

**Expected Result**:
- totalAdjustments = 10,000 - 5,000 = 5,000
- net_amount = 100,000 + 5,000 = **₦105,000** ✓

**Before Fix**:
- totalAdjustments = 10,000 + 5,000 = 15,000 ❌
- net_amount = 100,000 + 15,000 = ₦115,000 ❌

**After Fix**:
- totalAdjustments = 10,000 - 5,000 = 5,000 ✓
- net_amount = 100,000 + 5,000 = ₦105,000 ✓

### Frontend-Backend Consistency
Both frontend and backend now use identical calculation logic:

**Frontend** (`src/components/PayrollPage.tsx:321-323`):
```typescript
const totalAdjustments = userAdjustments.reduce((sum, adj) => {
    return adj.adjustment_type === 'addition' ? sum + adj.amount : sum - adj.amount;
}, 0);
```

**Backend** (`supabase/functions/run-payroll/index.ts:72-74`):
```typescript
const totalAdjustments = adjustments.reduce((sum: number, adj: { amount: number; adjustment_type: string }) => {
    return adj.adjustment_type === 'addition' ? sum + adj.amount : sum - adj.amount;
}, 0);
```

## Files Modified
- `supabase/functions/run-payroll/index.ts` - Fixed calculation logic and removed 53 lines of duplicate code

## Testing Notes

### Valid Adjustment Types
According to `src/types.ts:888`, `adjustment_type` is constrained to:
- `'addition'` - For bonuses, reimbursements, allowances
- `'deduction'` - For taxes, penalties, salary deductions

The fix correctly handles both types using a ternary operator that defaults to subtraction for any non-'addition' value, which is safe given the TypeScript type constraints.

### Security
- CodeQL security scan passed with **0 alerts**
- No new security vulnerabilities introduced

## Impact

### Positive Outcomes
✅ Payroll calculations are now accurate  
✅ Frontend display matches backend processing  
✅ Database records have proper signs for audit trails  
✅ Edge function code is clean and maintainable  
✅ No duplicate code or undefined references  

### Breaking Changes
None - This is a bug fix that corrects existing incorrect behavior.

### Data Migration
Existing payroll records may have incorrect calculations in the `deductions` field. However, the net amounts already paid cannot be retroactively changed. New payroll runs will use the correct calculation.

## Future Considerations

### Potential Enhancements (Not Implemented)
1. **Explicit Type Validation**: Add runtime validation to ensure `adjustment_type` is exactly 'addition' or 'deduction'
2. **Audit Trail**: Log when adjustments are processed for better troubleshooting
3. **Error Handling**: More granular error messages for different failure scenarios

These were not implemented to keep changes minimal and focused on fixing the reported bugs.

## References
- Problem Statement: See issue description
- Frontend Implementation: `src/components/PayrollPage.tsx`
- Type Definitions: `src/types.ts:888`
- Backend Logic: `supabase/functions/run-payroll/index.ts`

---
**Fixed**: 2024
**Author**: GitHub Copilot
**Review**: Code review completed, security scan passed

# Offline Payroll Processing Implementation

## Overview

This implementation adds the ability to process payroll "offline" (manual bank transfers) through the V2 payroll system. Previously, payroll could only be processed through Paystack automated transfers. Now, administrators can mark payroll as processed offline, download bank transfer details, and manually complete payments.

## What Was Changed

### 1. New Edge Function: `process-payroll-offline`

**Location:** `supabase/functions/process-payroll-offline/index.ts`

This edge function handles offline payroll processing without requiring Paystack configuration.

**Key Features:**
- Authenticates users and checks for `manage-payroll` or `manage-finance` permissions
- Fetches the payroll run from `payroll_runs_v2` by ID
- Verifies the run is in `FINALIZED` status
- Fetches all payslips with `FINAL` status for the run
- Creates a record in the legacy `payroll_runs` table with:
  - Status: `completed`
  - Processing method: `OFFLINE`
  - Metadata linking to V2 run
- Creates records in `payroll_items` table for each payslip
- Updates `payroll_runs_v2` status to `PROCESSED_OFFLINE`
- Returns success with summary (staff count, total amount, period)

**Request Format:**
```typescript
{
  runId: string  // UUID of the payroll run from payroll_runs_v2
}
```

**Response Format:**
```typescript
{
  success: boolean,
  message?: string,
  error?: string,
  data?: {
    runId: string,
    legacyRunId: number,
    staffCount: number,
    totalAmount: number,
    periodKey: string
  }
}
```

### 2. Updated Service: `payrollPreRunService.ts`

**Modified Function:** `processOfflinePayment()`

Previously, this function only updated the database status. Now it:
- Calls the `process-payroll-offline` edge function
- Passes the run ID
- Handles errors from the edge function
- Logs audit trail after successful processing

**Before:**
```typescript
export async function processOfflinePayment(runId: string, actorId: string): Promise<void> {
    await processPayrollOffline(runId, actorId);
}
```

**After:**
```typescript
export async function processOfflinePayment(runId: string, actorId: string): Promise<void> {
    const supabase = requireSupabaseClient();
    
    // Call the offline processing edge function
    const { data, error } = await supabase.functions.invoke('process-payroll-offline', {
        body: { runId }
    });
    
    if (error) {
        throw new Error(error.message || 'Failed to process offline payroll');
    }
    
    if (!data?.success) {
        throw new Error(data?.error || 'Offline payroll processing failed');
    }
    
    await logAudit(AUDIT_ACTIONS.processOffline, actorId, { run_id: runId });
}
```

### 3. New Utility: `bankCodes.ts`

**Location:** `src/utils/bankCodes.ts`

Provides utilities for bank code mapping and CSV generation.

**Key Features:**
- `BANK_CODES`: Mapping of Nigerian bank codes to bank names
- `getBankName()`: Converts bank code to bank name
- `generateBankTransferCSV()`: Creates CSV content from payslips
- `downloadCSV()`: Triggers browser download of CSV file

**Bank Codes Included:**
- Access Bank (044)
- Guaranty Trust Bank (058)
- First Bank of Nigeria (011)
- United Bank for Africa (033)
- Zenith Bank (057)
- And 19+ more Nigerian banks

**CSV Format:**
```csv
"Staff Name","Bank Name","Account Number","Account Name","Net Amount","Narration"
"John Doe","Guaranty Trust Bank","0123456789","John Doe","85000.00","Salary payment for January 2025"
```

### 4. Enhanced UI: `PayrollApprovalDashboard.tsx`

**New Features Added:**

#### a) Confirmation Dialog
When selecting offline processing, a confirmation dialog appears explaining:
- What will happen when marking as processed offline
- That payroll records will be created
- That the run will be marked as "PROCESSED_OFFLINE"
- That a bank transfer sheet will be available
- Warning that NO automated payments will be processed
- Requirement to manually complete bank transfers

#### b) Processing Status
- Shows spinner during edge function execution
- Displays success message after completion
- Shows error messages if processing fails

#### c) Processed Offline Status Section
After offline processing completes, displays:
- Green success banner with checkmark
- Message confirming offline processing
- "Download Bank Transfer Sheet" button
- Note about manual bank transfer completion

#### d) Bank Transfer Sheet Download
- Fetches all finalized payslips for the run
- Generates CSV with bank transfer details
- Downloads file with format: `bank-transfer-{period}-{timestamp}.csv`
- Shows success toast after download

**New State Variables:**
```typescript
const [showConfirmDialog, setShowConfirmDialog] = useState(false);
const [processingData, setProcessingData] = useState<any>(null);
```

**Modified Functions:**
- `handleProcessPayment()`: Now shows confirmation for offline
- `executePaymentProcessing()`: Executes after confirmation
- `loadRuns()`: Now includes `PROCESSED_OFFLINE` status in query

**New Functions:**
- `handleDownloadBankTransferSheet()`: Downloads CSV file

## How to Use

### For Administrators

1. **Create and Publish Payroll Run**
   - Go to Payroll → Pre-Run Manager
   - Create a new payroll run for the period
   - Review staff payslips
   - Publish the run for approval

2. **Staff Approval Process**
   - Staff members review their payslips
   - Staff can raise queries if needed
   - Admin responds to queries
   - Staff approves their payslips

3. **Finalize Payroll**
   - Go to Payroll → Approval Dashboard
   - Wait for all staff to approve
   - Click "Finalize Payroll"
   - Select "Offline (Manual Transfer)" option

4. **Process Offline Payment**
   - Click "Process Payment via Offline"
   - Review confirmation dialog
   - Confirm offline processing
   - Wait for processing to complete

5. **Download Bank Transfer Sheet**
   - Click "Download Bank Transfer Sheet"
   - CSV file downloads automatically
   - Contains: Staff name, bank name, account number, amount, narration

6. **Complete Manual Transfers**
   - Upload CSV to internet banking
   - Or manually enter each transfer
   - Complete transfers as per CSV details

## Technical Details

### Database Changes

**No schema changes required.** The implementation uses existing tables:

- `payroll_runs_v2`: V2 payroll runs (with new status)
- `payslips`: Individual staff payslips
- `payslip_line_items`: Earnings and deductions
- `payroll_runs`: Legacy payroll runs table (for reports)
- `payroll_items`: Legacy payroll items table (for reports)

### New Status Values

**PayrollRunV2Status:**
- `PROCESSED_OFFLINE` - Added to existing status enum

### Data Flow

```
User clicks "Process Offline"
    ↓
Confirmation dialog shown
    ↓
User confirms
    ↓
Call processOfflinePayment() service
    ↓
Invoke process-payroll-offline edge function
    ↓
Edge function:
  - Validates permissions
  - Fetches run and payslips
  - Creates payroll_runs record
  - Creates payroll_items records
  - Updates V2 run status
    ↓
UI updates to show PROCESSED_OFFLINE
    ↓
User downloads bank transfer sheet
    ↓
User manually completes transfers
```

### Security

- **Authentication:** Required for edge function access
- **Authorization:** Requires `manage-payroll` or `manage-finance` permission
- **Validation:** Ensures run is in FINALIZED status before processing
- **Audit Trail:** Logs offline processing action with timestamp and user

## Testing

Run the test suite:

```bash
npm run test
```

Or specifically test offline payroll processing:

```bash
npx tsc tests/offlinePayrollProcessing.test.ts --outDir build-tests/tests
node build-tests/tests/offlinePayrollProcessing.test.js
```

## Troubleshooting

### Issue: "Payroll run must be in FINALIZED status"
**Solution:** Ensure the payroll run has been finalized before attempting offline processing.

### Issue: "No finalized payslips found"
**Solution:** Ensure staff have approved their payslips and the run has been finalized.

### Issue: "Failed to create payroll items"
**Solution:** Check database permissions and ensure the legacy tables exist.

### Issue: CSV download not working
**Solution:** Ensure browser allows downloads and check browser console for errors.

### Issue: Missing bank details in CSV
**Solution:** Staff members must have bank account details (account_number, bank_code) in their profiles.

## Future Enhancements

Potential improvements for future versions:

1. **Bulk Upload Confirmation**
   - Allow uploading bank transfer receipts
   - Mark individual transfers as completed
   - Track completion status per staff member

2. **PDF Bank Transfer Sheet**
   - Generate formatted PDF instead of CSV
   - Include school logo and branding
   - Add payment instructions

3. **Email Notifications**
   - Notify staff when payroll is processed offline
   - Send payment confirmation emails
   - Remind staff to check their accounts

4. **Payment Reconciliation**
   - Mark which staff members have been paid
   - Track outstanding payments
   - Generate reconciliation reports

5. **Integration with Other Payment Systems**
   - Support for other payment gateways
   - Direct bank API integration
   - Mobile money transfer support

## Related Files

- `supabase/functions/process-payroll-offline/index.ts` - Edge function
- `src/services/payrollPreRunService.ts` - Service layer
- `src/utils/bankCodes.ts` - Utility functions
- `src/components/PayrollApprovalDashboard.tsx` - UI component
- `tests/offlinePayrollProcessing.test.ts` - Test suite

## Support

For issues or questions:
1. Check this documentation
2. Review the test suite for examples
3. Check the audit log for processing history
4. Contact system administrator

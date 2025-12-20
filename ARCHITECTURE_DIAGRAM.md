# Offline Payroll Processing - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YEBO Payroll System                          │
│                    Offline Processing Feature                        │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  Administrator UI    │
│  PayrollApproval     │
│  Dashboard           │
└──────────┬───────────┘
           │
           │ 1. Select Run
           │ 2. Choose "Offline"
           │ 3. Confirm
           ▼
┌──────────────────────┐
│  Service Layer       │
│  payrollPreRun       │
│  Service.ts          │
└──────────┬───────────┘
           │
           │ invoke()
           ▼
┌────────────────────────────────────────────────────────────┐
│  Edge Function                                              │
│  process-payroll-offline                                   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 1. Authenticate User                                │   │
│  │ 2. Check Permissions                                │   │
│  │ 3. Validate Run Status (FINALIZED)                 │   │
│  │ 4. Fetch Payslips (FINAL)                          │   │
│  │ 5. Create payroll_runs record                      │   │
│  │ 6. Create payroll_items records                    │   │
│  │ 7. Update payroll_runs_v2 → PROCESSED_OFFLINE      │   │
│  │ 8. Return success + summary                        │   │
│  └────────────────────────────────────────────────────┘   │
└────────────┬───────────────────────────────────────────────┘
             │
             │ success response
             ▼
┌──────────────────────┐
│  UI Updates          │
│  - Show success      │
│  - Enable download   │
│  - Update status     │
└──────────┬───────────┘
           │
           │ User clicks download
           ▼
┌──────────────────────┐
│  CSV Generation      │
│  bankCodes.ts        │
│                      │
│  generateBankTransfer│
│  CSV()               │
└──────────┬───────────┘
           │
           │ CSV content
           ▼
┌──────────────────────┐
│  Browser Download    │
│  bank-transfer-      │
│  {period}.csv        │
└──────────────────────┘
```

## Data Flow

```
┌─────────────────┐
│ payroll_runs_v2 │  ◄── V2 Payroll System
│ status: FINALIZED│
└────────┬────────┘
         │
         │ fetch run
         ▼
┌─────────────────┐
│   payslips      │  ◄── Staff Payslips
│ status: FINAL   │
└────────┬────────┘
         │
         │ fetch payslips
         ▼
┌────────────────────────────────────────┐
│  Edge Function Processing              │
│  ┌──────────────────────────────────┐ │
│  │ Transform Data                   │ │
│  │ payslip.gross_pay → gross_amount │ │
│  │ payslip.net_pay → net_amount     │ │
│  │ line_items → deductions[]        │ │
│  └──────────────────────────────────┘ │
└────────┬───────────────────────────────┘
         │
         │ create records
         ▼
┌─────────────────┐
│ payroll_runs    │  ◄── Legacy Table (for reports)
│ status: completed│
│ method: OFFLINE  │
└────────┬────────┘
         │
         │ insert items
         ▼
┌─────────────────┐
│ payroll_items   │  ◄── Legacy Table (for reports)
│ payment_method: │
│ OFFLINE         │
└────────┬────────┘
         │
         │ update status
         ▼
┌─────────────────┐
│ payroll_runs_v2 │  ◄── V2 Updated
│ status:         │
│ PROCESSED_      │
│ OFFLINE         │
└─────────────────┘
```

## CSV Generation Flow

```
┌─────────────────────────────────────────┐
│  Fetch Payslips + Staff Bank Details   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Map Bank Codes to Bank Names           │
│  058 → "Guaranty Trust Bank"            │
│  044 → "Access Bank"                    │
│  etc.                                   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Generate CSV Rows                      │
│  [Staff, Bank, Account, Name, Amount]   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Format as CSV String                   │
│  "Staff Name","Bank Name",...           │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Trigger Browser Download               │
│  Create Blob → Create URL → Click Link  │
└─────────────────────────────────────────┘
```

## Status Transitions

```
DRAFT
  ↓ (publish)
PRE_RUN_PUBLISHED
  ↓ (all approved)
FINALIZED ─────────┐
  ↓ (paystack)     │ (offline)
PROCESSING         │
  ↓                │
PROCESSED_         │
PAYSTACK           ↓
               PROCESSED_OFFLINE
```

## Permission Flow

```
┌──────────────┐
│ User Login   │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Check Permissions    │
│ - manage-payroll     │
│ - manage-finance     │
│ - Admin role         │
│ - Super Admin role   │
└──────┬───────────────┘
       │
       ├─── ✓ Has Permission
       │    │
       │    ▼
       │    ┌──────────────────┐
       │    │ Allow Access     │
       │    └──────────────────┘
       │
       └─── ✗ No Permission
            │
            ▼
            ┌──────────────────┐
            │ 403 Forbidden    │
            └──────────────────┘
```

## Error Handling Flow

```
┌──────────────────────┐
│ Edge Function Called │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Validate Input       │
└──────┬───────────────┘
       │
       ├─── Invalid runId ──→ 400 Error
       │
       ▼
┌──────────────────────┐
│ Check Authentication │
└──────┬───────────────┘
       │
       ├─── Not Authenticated ──→ 401 Error
       │
       ▼
┌──────────────────────┐
│ Check Permission     │
└──────┬───────────────┘
       │
       ├─── No Permission ──→ 403 Error
       │
       ▼
┌──────────────────────┐
│ Fetch Run            │
└──────┬───────────────┘
       │
       ├─── Not Found ──→ 400 Error
       │
       ▼
┌──────────────────────┐
│ Validate Status      │
└──────┬───────────────┘
       │
       ├─── Not FINALIZED ──→ 400 Error
       │
       ▼
┌──────────────────────┐
│ Fetch Payslips       │
└──────┬───────────────┘
       │
       ├─── None Found ──→ 400 Error
       │
       ▼
┌──────────────────────┐
│ Create Records       │
└──────┬───────────────┘
       │
       ├─── DB Error ──→ 400 Error
       │
       ▼
┌──────────────────────┐
│ Success Response     │
└──────────────────────┘
```

## Component Architecture

```
PayrollApprovalDashboard.tsx
│
├── State Management
│   ├── runs: PayrollRunV2[]
│   ├── selectedRun: PayrollRunV2
│   ├── payslips: Payslip[]
│   ├── isProcessing: boolean
│   ├── showConfirmDialog: boolean
│   └── processingData: any
│
├── UI Sections
│   ├── Run Selector
│   ├── Approval Progress
│   ├── Summary Cards
│   ├── Action Buttons
│   │   ├── Finalize Button (PRE_RUN_PUBLISHED)
│   │   ├── Process Payment (FINALIZED)
│   │   └── Download CSV (PROCESSED_OFFLINE)
│   └── Payslips Table
│
└── Modals
    ├── Query Resolution Modal
    └── Confirmation Dialog ★ NEW
```

## Database Schema (Simplified)

```sql
-- V2 Tables (Current System)
payroll_runs_v2
├── id (uuid, pk)
├── school_id (int)
├── period_key (text)
├── status (enum) ★ Added: PROCESSED_OFFLINE
├── processing_method (enum)
└── meta (jsonb)

payslips
├── id (uuid, pk)
├── payroll_run_id (uuid, fk)
├── staff_id (uuid, fk)
├── status (enum)
├── gross_pay (numeric)
├── total_deductions (numeric)
└── net_pay (numeric)

payslip_line_items
├── id (uuid, pk)
├── payslip_id (uuid, fk)
├── type (enum: EARNING/DEDUCTION)
├── label (text)
└── amount (numeric)

-- Legacy Tables (For Compatibility)
payroll_runs
├── id (serial, pk)
├── school_id (int)
├── period_label (text)
├── total_amount (numeric)
├── status (text)
├── processing_method (text) ★ Set to: OFFLINE
└── meta (jsonb)

payroll_items
├── id (serial, pk)
├── payroll_run_id (int, fk)
├── user_id (uuid, fk)
├── gross_amount (numeric)
├── deductions (jsonb)
├── net_amount (numeric)
├── payment_method (text) ★ Set to: OFFLINE
└── status (text)
```

## Security Layers

```
┌─────────────────────────────────────────┐
│ Layer 1: Authentication                  │
│ - Supabase JWT token required           │
│ - User must be logged in                │
└────────────┬────────────────────────────┘
             ▼
┌─────────────────────────────────────────┐
│ Layer 2: Authorization                   │
│ - Check user role and permissions       │
│ - Require: manage-payroll OR            │
│           manage-finance OR             │
│           Admin/Super Admin role        │
└────────────┬────────────────────────────┘
             ▼
┌─────────────────────────────────────────┐
│ Layer 3: Data Validation                │
│ - Validate run exists                   │
│ - Validate run status = FINALIZED       │
│ - Validate payslips exist               │
└────────────┬────────────────────────────┘
             ▼
┌─────────────────────────────────────────┐
│ Layer 4: Service Role Operations        │
│ - Use service role key for DB ops      │
│ - Bypass RLS for backend operations    │
└────────────┬────────────────────────────┘
             ▼
┌─────────────────────────────────────────┐
│ Layer 5: Audit Logging                  │
│ - Log all actions to audit_log         │
│ - Record: action, actor, timestamp     │
└─────────────────────────────────────────┘
```

## File Structure

```
yebo/
├── supabase/
│   └── functions/
│       └── process-payroll-offline/
│           └── index.ts                ★ NEW
├── src/
│   ├── components/
│   │   └── PayrollApprovalDashboard.tsx  ★ MODIFIED
│   ├── services/
│   │   └── payrollPreRunService.ts       ★ MODIFIED
│   └── utils/
│       └── bankCodes.ts                  ★ NEW
├── tests/
│   └── offlinePayrollProcessing.test.ts  ★ NEW
├── OFFLINE_PAYROLL_IMPLEMENTATION.md     ★ NEW
├── OFFLINE_PAYROLL_QUICK_START.md        ★ NEW
└── PR_SUMMARY.md                         ★ NEW
```

## Integration Points

```
┌─────────────────────────────────────────┐
│ Existing Systems                         │
└─────────────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    ▼                    ▼
┌────────┐          ┌──────────┐
│ Payroll│          │ User     │
│ V2     │          │ Profiles │
└───┬────┘          └────┬─────┘
    │                    │
    │ ┌──────────────────┘
    ▼ ▼
┌─────────────────────┐
│ Offline Processing  │ ★ NEW
│ Edge Function       │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌────────┐  ┌──────────┐
│ Legacy │  │ Audit    │
│ Tables │  │ Log      │
└────────┘  └──────────┘
```

## Key Benefits

```
┌─────────────────────────────────────────┐
│ ✓ No Paystack Dependency                │
│   Process payroll even if Paystack down│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✓ Manual Transfer Support                │
│   Use existing banking infrastructure   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✓ Complete Record Keeping                │
│   Records in both V2 and legacy tables  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✓ Audit Trail                            │
│   Full logging of offline processing    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✓ Bank Transfer Ready                    │
│   CSV format ready for internet banking │
└─────────────────────────────────────────┘
```

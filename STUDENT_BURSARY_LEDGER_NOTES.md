# Student bursary & fees – ledgerisation summary

## Root causes observed
- Fees data was previously captured with `student_invoices` + `payments` tables that stored denormalised totals. That design made it impossible to derive authoritative balances, partial allocations, or adjustments per invoice.
- CSV import/export utilities only covered fee item configuration, not round-trip adjustments, and header normalisation/idempotency were not handled consistently.
- PDF export logic was limited to a generic server stub without A4-safe templates for invoices/receipts.

## What changed in this update
- Added a ledger-grade migration introducing fee structures, invoice lines, payments, allocations, adjustments, and derived balance views with constraint triggers to block over-allocation.
- Added TypeScript ledger models and helpers for calculating balances, generating A4-ready invoice/receipt HTML, and handling robust CSV/XLSX round-trips for adjustments and balance exports.
- Export helpers now emit the exact columns required for the admin round-trip workflow (balance export + adjustment import with idempotent external references).

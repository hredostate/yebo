import ExcelJS from 'exceljs';
import {
  LedgerAdjustmentType,
  LedgerInvoiceStatus,
  LedgerPaymentStatus,
  LedgerStudentInvoice,
  PaymentReceiptPayload,
  StudentAdjustment,
  StudentBalanceSummary,
  StudentPaymentAllocation,
} from '../types';
import { normalizeHeaderName, parseCsv } from './feesCsvUtils';

export interface AdjustmentImportError {
  row: number;
  field: string;
  value: string | number | null;
  message: string;
}

export interface AdjustmentImportResult {
  rows: StudentAdjustment[];
  errors: AdjustmentImportError[];
  processed: number;
  succeeded: number;
  failed: number;
}

const ADJUSTMENT_COLUMNS = [
  'student_id',
  'admission_number',
  'session_id',
  'term_id',
  'adjustment_type',
  'amount',
  'reason',
  'apply_to_invoice_no',
  'external_ref',
];

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  return stringValue.match(/[",\n]/)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

export function buildStudentBalanceCsv(
  rows: (StudentBalanceSummary & {
    student_name?: string;
    admission_number?: string;
    class_name?: string;
    arm_name?: string;
    session_label?: string;
    term_label?: string;
  })[],
): string {
  const headers = [
    'student_id',
    'admission_number',
    'student_name',
    'class_name',
    'arm_name',
    'session',
    'term',
    'total_invoiced',
    'total_adjustments',
    'total_paid',
    'balance',
    'last_payment_date',
  ];

  const lines = rows.map((row) => [
    row.student_id,
    row.admission_number || '',
    row.student_name || '',
    row.class_name || '',
    row.arm_name || '',
    row.session_label || row.session_id,
    row.term_label || row.term_id,
    Number(row.total_invoiced || 0).toFixed(2),
    Number((row.total_surcharges || 0) - (row.total_reliefs || 0)).toFixed(2),
    Number(row.total_paid || 0).toFixed(2),
    Number(row.balance || 0).toFixed(2),
    row.last_payment_date || '',
  ].map(escapeCsvCell).join(','));

  return [headers.join(','), ...lines].join('\n');
}

export async function buildAdjustmentWorkbook(rows: StudentAdjustment[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('adjustments');
  sheet.columns = ADJUSTMENT_COLUMNS.map((header) => ({ header, key: header, width: 22 }));

  rows.forEach((row) => {
    sheet.addRow({
      student_id: row.student_id,
      admission_number: '',
      session_id: row.session_id,
      term_id: row.term_id,
      adjustment_type: row.type,
      amount: row.amount,
      reason: row.reason,
      apply_to_invoice_no: row.applied_to_invoice_id || '',
      external_ref: row.external_ref || '',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function validateAdjustmentRow(row: Record<string, any>, index: number): AdjustmentImportError[] {
  const errors: AdjustmentImportError[] = [];
  const numberValue = Number(row.amount);

  if (!row.student_id) {
    errors.push({ row: index, field: 'student_id', value: row.student_id, message: 'student_id is required' });
  }
  if (!row.session_id) {
    errors.push({ row: index, field: 'session_id', value: row.session_id, message: 'session_id is required' });
  }
  if (!row.term_id) {
    errors.push({ row: index, field: 'term_id', value: row.term_id, message: 'term_id is required' });
  }
  if (!row.adjustment_type || !Object.values(LedgerAdjustmentType).includes(String(row.adjustment_type) as LedgerAdjustmentType)) {
    errors.push({ row: index, field: 'adjustment_type', value: row.adjustment_type, message: 'Invalid adjustment_type' });
  }
  if (Number.isNaN(numberValue)) {
    errors.push({ row: index, field: 'amount', value: row.amount, message: 'amount must be numeric' });
  }
  if (!row.reason) {
    errors.push({ row: index, field: 'reason', value: row.reason, message: 'reason is required' });
  }

  return errors;
}

export async function parseAdjustmentsUpload(file: File | { name: string; text: () => Promise<string>; arrayBuffer: () => Promise<ArrayBuffer>; }): Promise<AdjustmentImportResult> {
  const name = file.name.toLowerCase();
  let rows: Record<string, any>[] = [];

  if (name.endsWith('.csv')) {
    const text = await file.text();
    const parsed = parseCsv(text);
    const headerMap = parsed.headers.reduce<Record<string, string>>((acc, header) => {
      acc[normalizeHeaderName(header)] = header;
      return acc;
    }, {});

    rows = parsed.rows.map((row) => {
      const normalized: Record<string, any> = {};
      ADJUSTMENT_COLUMNS.forEach((key) => {
        const normalizedKey = normalizeHeaderName(key);
        const header = headerMap[normalizedKey];
        normalized[key] = header ? row[header] : '';
      });
      return normalized;
    });
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    const headers = (worksheet.getRow(1).values as string[]).slice(1) as string[];
    const normalizedHeaders = headers.map((h) => normalizeHeaderName(String(h)));
    const headerMap = new Map<string, number>();
    normalizedHeaders.forEach((h, idx) => headerMap.set(h, idx + 1));

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const normalized: Record<string, any> = {};
      ADJUSTMENT_COLUMNS.forEach((key) => {
        const position = headerMap.get(normalizeHeaderName(key));
        normalized[key] = position ? row.getCell(position).value ?? '' : '';
      });
      rows.push(normalized);
    });
  }

  const errors: AdjustmentImportError[] = [];
  const outputRows: StudentAdjustment[] = [];

  rows.forEach((row, idx) => {
    const rowErrors = validateAdjustmentRow(row, idx + 2);
    errors.push(...rowErrors);

    if (rowErrors.length === 0) {
      outputRows.push({
        student_id: Number(row.student_id),
        session_id: Number(row.session_id),
        term_id: Number(row.term_id),
        type: row.adjustment_type as LedgerAdjustmentType,
        reason: String(row.reason),
        amount: Number(row.amount),
        applied_to_invoice_id: row.apply_to_invoice_no ? Number(row.apply_to_invoice_no) : null,
        external_ref: row.external_ref || null,
      });
    }
  });

  return {
    rows: outputRows,
    errors,
    processed: rows.length,
    succeeded: outputRows.length,
    failed: errors.reduce((set, error) => set.add(error.row), new Set<number>()).size,
  };
}

export function computeInvoiceTotals(
  invoice: LedgerStudentInvoice,
  adjustments: StudentAdjustment[] = [],
  allocations: StudentPaymentAllocation[] = [],
): { invoiceTotal: number; surcharges: number; reliefs: number; allocated: number; balance: number } {
  const baseTotal = (invoice.lines || []).reduce((sum, line) => sum + (line.line_total ?? line.unit_amount * line.qty), 0);
  const relatedAdjustments = adjustments.filter((a) => !a.applied_to_invoice_id || a.applied_to_invoice_id === invoice.id);
  const surcharges = relatedAdjustments
    .filter((a) => [LedgerAdjustmentType.Surcharge, LedgerAdjustmentType.Correction].includes(a.type))
    .reduce((sum, a) => sum + a.amount, 0);
  const reliefs = relatedAdjustments
    .filter((a) => [LedgerAdjustmentType.Discount, LedgerAdjustmentType.Waiver, LedgerAdjustmentType.Scholarship].includes(a.type))
    .reduce((sum, a) => sum + a.amount, 0);
  const allocated = allocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0);
  const balance = baseTotal + surcharges - reliefs - allocated;

  return { invoiceTotal: baseTotal, surcharges, reliefs, allocated, balance };
}

export function computeStudentBalance(
  invoices: LedgerStudentInvoice[],
  adjustments: StudentAdjustment[] = [],
  payments: { payment: { status: LedgerPaymentStatus }; allocations: StudentPaymentAllocation[] }[] = [],
): StudentBalanceSummary {
  const totals = invoices.map((inv) => {
    const invoiceAdjustments = adjustments.filter((adj) => !adj.applied_to_invoice_id || adj.applied_to_invoice_id === inv.id);
    const invoiceAllocations = payments
      .filter((p) => p.payment.status === LedgerPaymentStatus.Success)
      .flatMap((p) => p.allocations.filter((alloc) => alloc.invoice_id === inv.id));
    return computeInvoiceTotals(inv, invoiceAdjustments, invoiceAllocations);
  });

  const total_invoiced = totals.reduce((sum, t) => sum + t.invoiceTotal, 0);
  const total_surcharges = totals.reduce((sum, t) => sum + t.surcharges, 0);
  const total_reliefs = totals.reduce((sum, t) => sum + t.reliefs, 0);
  const total_paid = totals.reduce((sum, t) => sum + t.allocated, 0);
  const balance = totals.reduce((sum, t) => sum + t.balance, 0);

  return {
    student_id: invoices[0]?.student_id || 0,
    session_id: invoices[0]?.session_id || 0,
    term_id: invoices[0]?.term_id || 0,
    total_invoiced,
    total_surcharges,
    total_reliefs,
    total_paid,
    balance,
    last_payment_date: payments
      .filter((p) => p.payment.status === LedgerPaymentStatus.Success)
      .map((p) => p.payment.paid_at)
      .sort()
      .pop() || null,
  };
}

function basePdfStyles() {
  return `
    <style>
      @page { size: A4; margin: 6mm; }
      body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
      .doc { width: 100%; padding: 8mm 6mm; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .meta { font-size: 11px; color: #475569; line-height: 1.4; }
      .title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { text-align: left; padding: 6px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
      td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
      .totals { margin-top: 10px; width: 100%; font-size: 12px; }
      .totals td { padding: 6px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
      .success { background: #ecfdf3; color: #15803d; }
      .warning { background: #fffbeb; color: #d97706; }
      .danger { background: #fef2f2; color: #b91c1c; }
      .footer { margin-top: 16px; font-size: 10px; color: #475569; }
    </style>
  `;
}

function statusBadge(status: LedgerInvoiceStatus) {
  switch (status) {
    case LedgerInvoiceStatus.Paid:
      return '<span class="badge success">Paid</span>';
    case LedgerInvoiceStatus.PartiallyPaid:
      return '<span class="badge warning">Partially paid</span>';
    case LedgerInvoiceStatus.Void:
      return '<span class="badge danger">Void</span>';
    default:
      return '<span class="badge warning">Open</span>';
  }
}

export function buildInvoicePdfHtml(
  invoice: LedgerStudentInvoice,
  totals: { invoiceTotal: number; surcharges: number; reliefs: number; allocated: number; balance: number },
  student: { name: string; admission_number?: string },
  school: { name: string; logo_url?: string },
): string {
  const lines = (invoice.lines || []).map((line) => `
    <tr>
      <td>${line.fee_item_code || ''}</td>
      <td>${line.description || ''}</td>
      <td>${line.qty}</td>
      <td>${Number(line.unit_amount).toFixed(2)}</td>
      <td>${Number(line.line_total ?? line.unit_amount * line.qty).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        ${basePdfStyles()}
      </head>
      <body>
        <div class="doc">
          <div class="header">
            <div>
              <h1 class="title">Invoice ${invoice.invoice_no}</h1>
              <div class="meta">
                <div>${school.name}</div>
                <div>${student.name}${student.admission_number ? ` • ${student.admission_number}` : ''}</div>
                <div>${invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : ''}</div>
              </div>
            </div>
            <div style="text-align:right;">
              ${school.logo_url ? `<img src="${school.logo_url}" alt="logo" style="height:40px;" />` : ''}
              <div style="margin-top:6px;">${statusBadge(invoice.status)}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:18%">Fee Item</th>
                <th>Description</th>
                <th style="width:10%">Qty</th>
                <th style="width:14%">Unit</th>
                <th style="width:16%">Line Total</th>
              </tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>
          <table class="totals">
            <tbody>
              <tr><td style="width:70%"></td><td>Subtotal</td><td>${totals.invoiceTotal.toFixed(2)}</td></tr>
              <tr><td></td><td>Surcharges</td><td>${totals.surcharges.toFixed(2)}</td></tr>
              <tr><td></td><td>Discounts/Reliefs</td><td>${totals.reliefs.toFixed(2)}</td></tr>
              <tr><td></td><td>Paid</td><td>${totals.allocated.toFixed(2)}</td></tr>
              <tr><td></td><td><strong>Balance</strong></td><td><strong>${totals.balance.toFixed(2)}</strong></td></tr>
            </tbody>
          </table>
          <div class="footer">Generated automatically • Please contact bursary for questions.</div>
        </div>
      </body>
    </html>
  `;
}

export function buildReceiptPdfHtml(payload: PaymentReceiptPayload, school: { name: string; logo_url?: string }): string {
  const allocations = (payload.allocations || []).map((alloc) => `
    <tr>
      <td>${alloc.invoice_no}</td>
      <td>${Number(alloc.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        ${basePdfStyles()}
      </head>
      <body>
        <div class="doc">
          <div class="header">
            <div>
              <h1 class="title">Receipt ${payload.receipt_no}</h1>
              <div class="meta">
                <div>${school.name}</div>
                <div>${payload.student_name} • ID ${payload.student_id}</div>
                <div>${new Date(payload.paid_at).toLocaleString()}</div>
              </div>
            </div>
            ${school.logo_url ? `<img src="${school.logo_url}" alt="logo" style="height:40px;" />` : ''}
          </div>
          <table>
            <thead>
              <tr><th>Invoice</th><th>Allocated Amount</th></tr>
            </thead>
            <tbody>${allocations}</tbody>
          </table>
          <table class="totals">
            <tbody>
              <tr><td style="width:70%"></td><td>Payment Ref</td><td>${payload.payment_ref}</td></tr>
              <tr><td></td><td>Method</td><td>${payload.method}</td></tr>
              <tr><td></td><td>Amount</td><td>${payload.amount.toFixed(2)}</td></tr>
              <tr><td></td><td><strong>Balance After</strong></td><td><strong>${payload.balance_after.toFixed(2)}</strong></td></tr>
            </tbody>
          </table>
          <div class="footer">Keep this receipt as proof of payment. Contact bursary for any discrepancies.</div>
        </div>
      </body>
    </html>
  `;
}

/**
 * CSV utilities for fees and invoices export/import
 */

import type { FeeItem, StudentInvoice, BaseDataObject, Term } from '../types';

// ============= FIELD DEFINITIONS =============

export interface FeeItemFieldConfig {
  key: keyof FeeItem | string;
  label: string;
  selected: boolean;
}

export interface InvoiceFieldConfig {
  key: string;
  label: string;
  selected: boolean;
}

export const FEE_ITEM_FIELDS: FeeItemFieldConfig[] = [
  { key: 'name', label: 'Fee Name', selected: true },
  { key: 'description', label: 'Description', selected: true },
  { key: 'amount', label: 'Amount (₦)', selected: true },
  { key: 'is_compulsory', label: 'Is Compulsory', selected: true },
  { key: 'target_class_id', label: 'Target Class', selected: false },
  { key: 'target_term_id', label: 'Target Term', selected: false },
  { key: 'priority', label: 'Priority', selected: false },
  { key: 'allow_installments', label: 'Allow Installments', selected: false },
];

export const INVOICE_FIELDS: InvoiceFieldConfig[] = [
  { key: 'student_name', label: 'Student Name', selected: true },
  { key: 'admission_number', label: 'Admission Number', selected: true },
  { key: 'class', label: 'Class', selected: true },
  { key: 'invoice_number', label: 'Invoice Number', selected: true },
  { key: 'total_amount', label: 'Total Amount', selected: true },
  { key: 'amount_paid', label: 'Amount Paid', selected: true },
  { key: 'balance', label: 'Balance (Outstanding)', selected: true },
  { key: 'status', label: 'Status', selected: true },
  { key: 'due_date', label: 'Due Date', selected: false },
  { key: 'term', label: 'Term', selected: false },
  { key: 'created_at', label: 'Created Date', selected: false },
];

// ============= VALIDATION =============

export interface CsvValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
  itemName?: string;
}

export interface CsvValidationResult {
  valid: boolean;
  errors: CsvValidationError[];
  validCount: number;
  invalidCount: number;
}

export function validateFeeItemRow(row: any, rowIndex: number): CsvValidationError[] {
  const errors: CsvValidationError[] = [];
  const itemName = row['Fee Name'] || row['name'] || `Row ${rowIndex}`;

  // Required: Fee Name
  if (!row['Fee Name'] && !row['name']) {
    errors.push({
      row: rowIndex,
      field: 'Fee Name',
      value: '',
      message: 'Fee Name is required',
      itemName,
    });
  }

  // Required: Amount
  const amount = row['Amount (₦)'] || row['Amount'] || row['amount'];
  if (!amount) {
    errors.push({
      row: rowIndex,
      field: 'Amount',
      value: '',
      message: 'Amount is required',
      itemName,
    });
  } else if (isNaN(Number(amount)) || Number(amount) < 0) {
    errors.push({
      row: rowIndex,
      field: 'Amount',
      value: amount,
      message: 'Amount must be a valid positive number',
      itemName,
    });
  }

  return errors;
}

export function validateInvoiceRow(row: any, rowIndex: number): CsvValidationError[] {
  const errors: CsvValidationError[] = [];
  const studentName = row['Student Name'] || row['student_name'] || `Row ${rowIndex}`;

  // Required: Student Name or Admission Number
  if (!row['Student Name'] && !row['student_name'] && !row['Admission Number'] && !row['admission_number']) {
    errors.push({
      row: rowIndex,
      field: 'Student Name/Admission Number',
      value: '',
      message: 'Either Student Name or Admission Number is required',
      itemName: studentName,
    });
  }

  // Required: Total Amount
  const totalAmount = row['Total Amount'] || row['total_amount'];
  if (!totalAmount) {
    errors.push({
      row: rowIndex,
      field: 'Total Amount',
      value: '',
      message: 'Total Amount is required',
      itemName: studentName,
    });
  } else if (isNaN(Number(totalAmount)) || Number(totalAmount) < 0) {
    errors.push({
      row: rowIndex,
      field: 'Total Amount',
      value: totalAmount,
      message: 'Total Amount must be a valid positive number',
      itemName: studentName,
    });
  }

  return errors;
}

export function validateCsvData(data: any[], type: 'fees' | 'invoices'): CsvValidationResult {
  const errors: CsvValidationError[] = [];
  
  data.forEach((row, index) => {
    const rowErrors = type === 'fees' 
      ? validateFeeItemRow(row, index + 2) // +2 because row 1 is header, and we want 1-indexed
      : validateInvoiceRow(row, index + 2);
    errors.push(...rowErrors);
  });

  const errorRows = new Set(errors.map(e => e.row));
  const invalidCount = errorRows.size;
  const validCount = data.length - invalidCount;

  return {
    valid: errors.length === 0,
    errors,
    validCount,
    invalidCount,
  };
}

// ============= CSV GENERATION =============

/**
 * Escapes a CSV cell value
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  let cell = String(value);
  // Wrap in quotes if contains comma, newline, or quote
  if (cell.search(/("|,|\n)/g) >= 0) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Generate CSV string from fee items
 */
export function generateFeeItemsCsv(
  feeItems: FeeItem[],
  selectedFields: FeeItemFieldConfig[],
  classes: BaseDataObject[],
  terms: Term[]
): string {
  const activeFields = selectedFields.filter(f => f.selected);
  const headers = activeFields.map(f => f.label);
  
  const rows = feeItems.map(item => {
    return activeFields.map(field => {
      switch (field.key) {
        case 'name':
          return escapeCsvCell(item.name);
        case 'description':
          return escapeCsvCell(item.description || '');
        case 'amount':
          return escapeCsvCell(item.amount);
        case 'is_compulsory':
          return escapeCsvCell(item.is_compulsory ? 'Yes' : 'No');
        case 'target_class_id':
          const className = classes.find(c => c.id === item.target_class_id)?.name || '';
          return escapeCsvCell(className);
        case 'target_term_id':
          const term = terms.find(t => t.id === item.target_term_id);
          const termLabel = term ? `${term.session_label} - ${term.term_label}` : '';
          return escapeCsvCell(termLabel);
        case 'priority':
          return escapeCsvCell(item.priority || '');
        case 'allow_installments':
          return escapeCsvCell(item.allow_installments ? 'Yes' : 'No');
        default:
          return '';
      }
    });
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Generate CSV string from student invoices
 */
export function generateInvoicesCsv(
  invoices: StudentInvoice[],
  selectedFields: InvoiceFieldConfig[],
  classes: BaseDataObject[],
  terms: Term[],
  students: any[]
): string {
  const activeFields = selectedFields.filter(f => f.selected);
  const headers = activeFields.map(f => f.label);
  
  const rows = invoices.map(invoice => {
    return activeFields.map(field => {
      switch (field.key) {
        case 'student_name':
          return escapeCsvCell(invoice.student?.name || '');
        case 'admission_number':
          return escapeCsvCell(invoice.student?.admission_number || '');
        case 'class':
          const student = students.find(s => s.id === invoice.student_id);
          const className = classes.find(c => c.id === student?.class_id)?.name || '';
          return escapeCsvCell(className);
        case 'invoice_number':
          return escapeCsvCell(invoice.invoice_number);
        case 'total_amount':
          return escapeCsvCell(invoice.total_amount);
        case 'amount_paid':
          return escapeCsvCell(invoice.amount_paid);
        case 'balance':
          return escapeCsvCell(invoice.total_amount - invoice.amount_paid);
        case 'status':
          return escapeCsvCell(invoice.status);
        case 'due_date':
          return escapeCsvCell(invoice.due_date || '');
        case 'term':
          const term = terms.find(t => t.id === invoice.term_id);
          const termLabel = term ? `${term.session_label} - ${term.term_label}` : '';
          return escapeCsvCell(termLabel);
        case 'created_at':
          return escapeCsvCell(invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '');
        default:
          return '';
      }
    });
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============= CSV PARSING =============

/**
 * Parse CSV text into array of objects
 */
export function parseCsv(text: string): any[] {
  const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row.');
  }

  // Parse headers - handle quoted strings properly
  const headerValues = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  const headers = headerValues.map(h => {
    let value = h.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/""/g, '"');
    }
    return value;
  });

  // Parse data rows
  const data = lines.slice(1).map(line => {
    // Split by comma but respect quoted strings
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    return headers.reduce((obj, header, index) => {
      let value = values[index]?.trim() || '';
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/""/g, '"');
      }
      (obj as any)[header] = value;
      return obj;
    }, {});
  });

  return data;
}

// ============= COLUMN MAPPING =============

export interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

/**
 * Auto-detect column mappings based on header similarity
 */
export function autoDetectMapping(csvHeaders: string[], type: 'fees' | 'invoices'): ColumnMapping[] {
  const targetFields = type === 'fees' ? FEE_ITEM_FIELDS : INVOICE_FIELDS;
  const mappings: ColumnMapping[] = [];

  csvHeaders.forEach(header => {
    const normalized = header.toLowerCase().trim();
    
    // Try exact match first
    let match = targetFields.find(f => 
      f.label.toLowerCase() === normalized || 
      String(f.key).toLowerCase() === normalized
    );

    // Try partial match
    if (!match) {
      match = targetFields.find(f => 
        normalized.includes(f.label.toLowerCase()) || 
        f.label.toLowerCase().includes(normalized)
      );
    }

    if (match) {
      mappings.push({
        csvColumn: header,
        dbField: String(match.key),
      });
    }
  });

  return mappings;
}

/**
 * Transform CSV data using column mappings
 */
export function transformDataWithMapping(data: any[], mappings: ColumnMapping[]): any[] {
  return data.map(row => {
    const transformed: any = {};
    mappings.forEach(mapping => {
      transformed[mapping.dbField] = row[mapping.csvColumn];
    });
    return transformed;
  });
}

/**
 * Convert validation error display row number (1-based with header at row 1) 
 * to data array index (0-based)
 * @param displayRow - Row number from validation error (e.g., 2 for first data row)
 * @returns Zero-based index in the data array
 */
export function displayRowToDataIndex(displayRow: number): number {
  return displayRow - 2; // displayRow is 1-based with header at row 1, so data starts at row 2
}

// ============= FLEXIBLE CSV COLUMN MATCHING =============

export interface FlexibleColumnMatchResult {
  matchedColumns: string[];
  unmatchedColumns: string[];
  matchedCount: number;
}

/**
 * Match CSV headers to expected columns flexibly (case-insensitive)
 * Only processes columns that exist in both the CSV and expected columns list
 * 
 * @param csvHeaders - Headers from the uploaded CSV file
 * @param expectedColumns - List of expected column names
 * @returns Object containing matched columns, unmatched columns, and counts
 */
export function matchCsvColumns(
  csvHeaders: string[],
  expectedColumns: string[]
): FlexibleColumnMatchResult {
  const matchedColumns: string[] = [];
  const unmatchedColumns: string[] = [];
  
  // Create a case-insensitive map of expected columns
  const expectedMap = new Map<string, string>();
  expectedColumns.forEach(col => {
    expectedMap.set(col.toLowerCase().trim(), col);
  });
  
  // Match CSV headers to expected columns
  csvHeaders.forEach(header => {
    const normalized = header.toLowerCase().trim();
    const matched = expectedMap.get(normalized);
    
    if (matched) {
      matchedColumns.push(header);
    } else {
      unmatchedColumns.push(header);
    }
  });
  
  return {
    matchedColumns,
    unmatchedColumns,
    matchedCount: matchedColumns.length
  };
}

/**
 * Parse CSV and extract only matched columns
 * 
 * @param csvText - Raw CSV text content
 * @param expectedColumns - List of expected column names (for matching)
 * @returns Parsed data with only matched columns
 */
export function parseFlexibleCsv(
  csvText: string,
  expectedColumns: string[]
): { data: any[], matchResult: FlexibleColumnMatchResult } {
  const data = parseCsv(csvText);
  
  if (data.length === 0) {
    return {
      data: [],
      matchResult: {
        matchedColumns: [],
        unmatchedColumns: [],
        matchedCount: 0
      }
    };
  }
  
  // Get headers from first row's keys
  const csvHeaders = Object.keys(data[0]);
  const matchResult = matchCsvColumns(csvHeaders, expectedColumns);
  
  // Filter data to only include matched columns
  const filteredData = data.map(row => {
    const filtered: any = {};
    matchResult.matchedColumns.forEach(col => {
      filtered[col] = row[col];
    });
    return filtered;
  });
  
  return {
    data: filteredData,
    matchResult
  };
}

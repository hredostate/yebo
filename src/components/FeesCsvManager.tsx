
import React, { useState, useRef, useMemo } from 'react';
import { DownloadIcon, UploadCloudIcon } from './common/icons';
import Spinner from './common/Spinner';
import type { FeeItem, StudentInvoice, BaseDataObject, Term, Student } from '../types';
import {
  FEE_ITEM_FIELDS,
  INVOICE_FIELDS,
  generateFeeItemsCsv,
  generateInvoicesCsv,
  downloadCsv,
  parseCsv,
  validateCsvData,
  autoDetectMapping,
  transformDataWithMapping,
  displayRowToDataIndex,
  type FeeItemFieldConfig,
  type InvoiceFieldConfig,
  type CsvValidationError,
  type ColumnMapping,
} from '../utils/feesCsvUtils';

// ============= VALIDATION MODAL =============

const ValidationModal: React.FC<{
  errors: CsvValidationError[];
  validCount: number;
  invalidCount: number;
  totalCount: number;
  onProceed: () => void;
  onCancel: () => void;
}> = ({ errors, validCount, invalidCount, totalCount, onProceed, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Validation Errors Found</h2>

        <div className="my-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-800 dark:bg-red-900/30 dark:text-red-200">
          <p className="font-bold">Data Quality Issues Detected</p>
          <p className="text-sm mt-1">
            Found {errors.length} validation error{errors.length !== 1 ? 's' : ''} in {invalidCount} of {totalCount} rows.
            {validCount > 0 && ` ${validCount} rows are valid and can be imported.`}
          </p>
        </div>

        <div className="flex-grow my-4 overflow-y-auto border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
          <div className="p-4 space-y-3">
            {errors.map((error, index) => (
              <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-red-700 dark:text-red-400 min-w-[80px]">Row {error.row}:</span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{error.itemName}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      <span className="font-medium">{error.field}:</span> {error.message}
                    </p>
                    {error.value && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
                        Value: "{error.value}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 space-y-3">
          {validCount > 0 ? (
            <div className="p-3 bg-yellow-50 border border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> You can proceed to import the {validCount} valid row{validCount !== 1 ? 's' : ''}, or cancel and fix all issues in your CSV file.
              </p>
            </div>
          ) : null}
          <div className="flex justify-end gap-4">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30"
            >
              Cancel & Fix CSV
            </button>
            {validCount > 0 && (
              <button
                onClick={onProceed}
                className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
              >
                Proceed with {validCount} Valid Row{validCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============= COLUMN MAPPING MODAL =============

const ColumnMappingModal: React.FC<{
  csvHeaders: string[];
  detectedMappings: ColumnMapping[];
  type: 'fees' | 'invoices';
  previewData: any[];
  onConfirm: (mappings: ColumnMapping[]) => void;
  onCancel: () => void;
}> = ({ csvHeaders, detectedMappings, type, previewData, onConfirm, onCancel }) => {
  const [mappings, setMappings] = useState<ColumnMapping[]>(detectedMappings);
  const targetFields = type === 'fees' ? FEE_ITEM_FIELDS : INVOICE_FIELDS;

  const updateMapping = (csvColumn: string, dbField: string) => {
    setMappings(prev => {
      const filtered = prev.filter(m => m.csvColumn !== csvColumn);
      if (dbField) {
        return [...filtered, { csvColumn, dbField }];
      }
      return filtered;
    });
  };

  const getMappedField = (csvColumn: string) => {
    return mappings.find(m => m.csvColumn === csvColumn)?.dbField || '';
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-5xl m-4 flex flex-col max-h-[90vh]">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Map CSV Columns to Fields</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Review and adjust how CSV columns map to database fields. Unmapped columns will be ignored.
        </p>

        <div className="flex-grow my-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Auto-detected mappings:</strong> We've pre-filled the most likely mappings. Please verify and adjust as needed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {csvHeaders.map(header => (
                <div key={header} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{header}</p>
                  </div>
                  <span className="text-slate-400">→</span>
                  <select
                    value={getMappedField(header)}
                    onChange={(e) => updateMapping(header, e.target.value)}
                    className="flex-1 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="">Skip this column</option>
                    {targetFields.map(field => (
                      <option key={String(field.key)} value={String(field.key)}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="mt-6">
              <h3 className="font-bold text-sm mb-2">Preview (first 3 rows):</h3>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase">
                    <tr>
                      {mappings.map(m => (
                        <th key={m.csvColumn} className="p-2">
                          {targetFields.find(f => String(f.key) === m.dbField)?.label || m.dbField}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 3).map((row, idx) => (
                      <tr key={idx} className="border-t border-slate-200 dark:border-slate-700">
                        {mappings.map(m => (
                          <td key={m.csvColumn} className="p-2">{row[m.csvColumn] || '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-end gap-4 mt-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mappings)}
            disabled={mappings.length === 0}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

// ============= MAIN COMPONENT =============

interface FeesCsvManagerProps {
  feeItems: FeeItem[];
  invoices: StudentInvoice[];
  students: Student[];
  classes: BaseDataObject[];
  terms: Term[];
  onImportFees: (fees: Partial<FeeItem>[]) => Promise<void>;
  onImportInvoices: (invoices: Partial<StudentInvoice>[]) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const FeesCsvManager: React.FC<FeesCsvManagerProps> = ({
  feeItems,
  invoices,
  students,
  classes,
  terms,
  onImportFees,
  onImportInvoices,
  addToast,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportType, setExportType] = useState<'fees' | 'invoices'>('fees');
  const [importType, setImportType] = useState<'fees' | 'invoices'>('fees');

  // Export state
  const [feeFields, setFeeFields] = useState<FeeItemFieldConfig[]>(FEE_ITEM_FIELDS);
  const [invoiceFields, setInvoiceFields] = useState<InvoiceFieldConfig[]>(INVOICE_FIELDS);
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterTerm, setFilterTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<CsvValidationError[] | null>(null);
  const [validationStats, setValidationStats] = useState<{ validCount: number; invalidCount: number; totalCount: number } | null>(null);
  const [pendingData, setPendingData] = useState<any[] | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [detectedMappings, setDetectedMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Filtered data for export
  const filteredFeeItems = useMemo(() => {
    return feeItems.filter(item => {
      if (filterClass && item.target_class_id !== Number(filterClass)) return false;
      if (filterTerm && item.target_term_id !== Number(filterTerm)) return false;
      return true;
    });
  }, [feeItems, filterClass, filterTerm]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (filterClass) {
        const student = students.find(s => s.id === inv.student_id);
        if (student?.class_id !== Number(filterClass)) return false;
      }
      if (filterTerm && inv.term_id !== Number(filterTerm)) return false;
      if (filterStatus && inv.status !== filterStatus) return false;
      return true;
    });
  }, [invoices, students, filterClass, filterTerm, filterStatus]);

  // Toggle field selection
  const toggleFeeField = (key: string) => {
    setFeeFields(prev => prev.map(f => f.key === key ? { ...f, selected: !f.selected } : f));
  };

  const toggleInvoiceField = (key: string) => {
    setInvoiceFields(prev => prev.map(f => f.key === key ? { ...f, selected: !f.selected } : f));
  };

  // Handle export
  const handleExport = () => {
    try {
      if (exportType === 'fees') {
        const csvContent = generateFeeItemsCsv(filteredFeeItems, feeFields, classes, terms);
        const filename = `fee_items_${new Date().toISOString().split('T')[0]}.csv`;
        downloadCsv(csvContent, filename);
        addToast(`Exported ${filteredFeeItems.length} fee items`, 'success');
      } else {
        const csvContent = generateInvoicesCsv(filteredInvoices, invoiceFields, classes, terms, students);
        const filename = `student_invoices_${new Date().toISOString().split('T')[0]}.csv`;
        downloadCsv(csvContent, filename);
        addToast(`Exported ${filteredInvoices.length} invoices`, 'success');
      }
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  // Handle file upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const data = parsed.rows;
      const headers = parsed.headers;

      // Auto-detect mappings
      const mappings = autoDetectMapping(headers, importType);

      setCsvHeaders(headers);
      setDetectedMappings(mappings);
      setPreviewData(data);
      setShowMappingModal(true);
      setIsImporting(false);
    } catch (error: any) {
      addToast(error.message, 'error');
      setIsImporting(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle mapping confirmation
  const handleMappingConfirm = (mappings: ColumnMapping[]) => {
    setShowMappingModal(false);
    setIsImporting(true);

    try {
      // Transform data using mappings
      const transformedData = transformDataWithMapping(previewData, mappings);

      // Validate
      const validation = validateCsvData(transformedData, importType);

      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setValidationStats({
          validCount: validation.validCount,
          invalidCount: validation.invalidCount,
          totalCount: transformedData.length,
        });
        setPendingData(transformedData);
        setIsImporting(false);
        return;
      }

      // If validation passed, proceed with import
      performImport(transformedData);
    } catch (error: any) {
      addToast(error.message, 'error');
      setIsImporting(false);
    }
  };

  // Perform import
  const performImport = async (data: any[]) => {
    try {
      if (importType === 'fees') {
        await onImportFees(data);
      } else {
        await onImportInvoices(data);
      }
      addToast(`Successfully imported ${data.length} records`, 'success');
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setIsImporting(false);
      setPendingData(null);
    }
  };

  // Handle proceed with valid rows
  const handleProceedWithValidRows = async () => {
    if (!pendingData || !validationErrors) return;

    setIsImporting(true);

    // Convert display row numbers to data array indices
    const errorIndices = new Set(validationErrors.map(e => displayRowToDataIndex(e.row)));
    const validData = pendingData.filter((_, index) => !errorIndices.has(index));

    setValidationErrors(null);
    setValidationStats(null);
    setPendingData(null);

    await performImport(validData);
  };

  // Handle cancel validation
  const handleCancelValidation = () => {
    setValidationErrors(null);
    setValidationStats(null);
    setPendingData(null);
    setIsImporting(false);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'export' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <DownloadIcon className="w-4 h-4 inline mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UploadCloudIcon className="w-4 h-4 inline mr-2" />
            Import CSV
          </button>
        </div>

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Export Type</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value as 'fees' | 'invoices')}
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
              >
                <option value="fees">Fee Items (Configuration)</option>
                <option value="invoices">Student Invoices</option>
              </select>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Filter by Class</label>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Filter by Term</label>
                <select
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                  className="w-full p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                >
                  <option value="">All Terms</option>
                  {terms.map(t => (
                    <option key={t.id} value={t.id}>{t.session_label} - {t.term_label}</option>
                  ))}
                </select>
              </div>
              {exportType === 'invoices' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="">All Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              )}
            </div>

            {/* Field Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Select Fields to Export</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 border rounded dark:border-slate-600 bg-slate-50 dark:bg-slate-800 max-h-64 overflow-y-auto">
                {exportType === 'fees'
                  ? feeFields.map(field => (
                      <label key={String(field.key)} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.selected}
                          onChange={() => toggleFeeField(String(field.key))}
                          className="cursor-pointer"
                        />
                        <span className="text-sm">{field.label}</span>
                      </label>
                    ))
                  : invoiceFields.map(field => (
                      <label key={field.key} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.selected}
                          onChange={() => toggleInvoiceField(field.key)}
                          className="cursor-pointer"
                        />
                        <span className="text-sm">{field.label}</span>
                      </label>
                    ))}
              </div>
            </div>

            {/* Export Button */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Ready to export {exportType === 'fees' ? filteredFeeItems.length : filteredInvoices.length} records
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  {exportType === 'fees'
                    ? `${feeFields.filter(f => f.selected).length} fields selected`
                    : `${invoiceFields.filter(f => f.selected).length} fields selected`}
                </p>
              </div>
              <button
                onClick={handleExport}
                disabled={exportType === 'fees' ? filteredFeeItems.length === 0 : filteredInvoices.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                <DownloadIcon className="w-5 h-5" />
                Download CSV
              </button>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Import Type</label>
              <select
                value={importType}
                onChange={(e) => setImportType(e.target.value as 'fees' | 'invoices')}
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
              >
                <option value="fees">Fee Items</option>
                <option value="invoices">Student Invoices</option>
              </select>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">Import Instructions</p>
              <ul className="text-xs text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-disc list-inside">
                {importType === 'fees' ? (
                  <>
                    <li>Required fields: Fee Name, Amount</li>
                    <li>Use "Yes" or "No" for boolean fields (Is Compulsory, Allow Installments)</li>
                    <li>Existing fees with the same name will be updated</li>
                  </>
                ) : (
                  <>
                    <li>Required fields: Student Name or Admission Number, Total Amount</li>
                    <li>Student will be matched by Admission Number if provided</li>
                    <li>Existing invoices with the same invoice number will be updated</li>
                  </>
                )}
              </ul>
            </div>

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex flex-col items-center justify-center mx-auto"
              >
                {isImporting ? (
                  <Spinner size="lg" />
                ) : (
                  <>
                    <UploadCloudIcon className="w-16 h-16 text-slate-400 dark:text-slate-500 mb-4" />
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                      Click to upload CSV file
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      or drag and drop
                    </p>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showMappingModal && (
        <ColumnMappingModal
          csvHeaders={csvHeaders}
          detectedMappings={detectedMappings}
          type={importType}
          previewData={previewData}
          onConfirm={handleMappingConfirm}
          onCancel={() => {
            setShowMappingModal(false);
            setIsImporting(false);
          }}
        />
      )}

      {validationErrors && validationStats && (
        <ValidationModal
          errors={validationErrors}
          validCount={validationStats.validCount}
          invalidCount={validationStats.invalidCount}
          totalCount={validationStats.totalCount}
          onProceed={handleProceedWithValidRows}
          onCancel={handleCancelValidation}
        />
      )}
    </>
  );
};

export default FeesCsvManager;

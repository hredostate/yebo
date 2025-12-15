import React, { useState, useEffect } from 'react';
import Spinner from './common/Spinner';
import { CloseIcon } from './common/icons';

export interface CsvColumn {
    key: string;
    label: string;
    defaultChecked: boolean;
}

interface CsvExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (selectedColumns: string[]) => void;
    columns: CsvColumn[];
    isExporting?: boolean;
}

const CsvExportModal: React.FC<CsvExportModalProps> = ({ 
    isOpen, 
    onClose, 
    onExport, 
    columns,
    isExporting = false 
}) => {
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string>('');

    // Initialize selected columns based on defaults when modal opens
    useEffect(() => {
        if (isOpen) {
            const defaultSelected = new Set(
                columns.filter(col => col.defaultChecked).map(col => col.key)
            );
            setSelectedColumns(defaultSelected);
            setError(''); // Clear any previous errors
        }
    }, [isOpen, columns]);

    if (!isOpen) return null;

    const handleToggle = (key: string) => {
        const newSelected = new Set(selectedColumns);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedColumns(newSelected);
        setError(''); // Clear error when user makes a selection
    };

    const handleSelectAll = () => {
        setSelectedColumns(new Set(columns.map(col => col.key)));
        setError('');
    };

    const handleDeselectAll = () => {
        setSelectedColumns(new Set());
    };

    const handleExport = () => {
        const columnsArray = Array.from(selectedColumns);
        if (columnsArray.length === 0) {
            setError('Please select at least one column to export.');
            return;
        }
        onExport(columnsArray);
    };

    const allSelected = selectedColumns.size === columns.length;
    const noneSelected = selectedColumns.size === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md m-4 overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Export to CSV</h2>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1"
                            aria-label="Close"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Select the columns you want to include in the export:
                    </p>

                    {/* Error message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                            {error}
                        </div>
                    )}

                    {/* Select/Deselect All buttons */}
                    <div className="flex gap-2 mb-4">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            disabled={allSelected}
                            className="text-xs px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Select All
                        </button>
                        <button
                            type="button"
                            onClick={handleDeselectAll}
                            disabled={noneSelected}
                            className="text-xs px-3 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Deselect All
                        </button>
                    </div>

                    {/* Column checkboxes */}
                    <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
                        {columns.map(column => (
                            <label 
                                key={column.key} 
                                className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-md transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedColumns.has(column.key)}
                                    onChange={() => handleToggle(column.key)}
                                    className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    {column.label}
                                </span>
                            </label>
                        ))}
                    </div>

                    {/* Footer buttons */}
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose}
                            disabled={isExporting}
                            className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            onClick={handleExport}
                            disabled={isExporting || noneSelected}
                            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                        >
                            {isExporting ? <Spinner size="sm" /> : 'Export'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CsvExportModal;

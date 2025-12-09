import ExcelJS from 'exceljs';

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'currency' | 'boolean';
  format?: (value: any) => any;
}

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  includeTimestamp?: boolean;
}

/**
 * Format a value based on its type
 */
const formatValue = (value: any, type?: ExcelColumn['type'], customFormat?: (value: any) => any): any => {
  // Apply custom format first if provided
  if (customFormat) {
    return customFormat(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  switch (type) {
    case 'date':
      if (value instanceof Date) {
        return value;
      }
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date;
      }
      return value;
    
    case 'currency':
      if (typeof value === 'number') {
        return value;
      }
      return value;
    
    case 'number':
      if (typeof value === 'number') {
        return value;
      }
      const parsed = parseFloat(value);
      return isNaN(parsed) ? value : parsed;
    
    case 'boolean':
      return value ? 'Yes' : 'No';
    
    case 'string':
    default:
      return String(value);
  }
};

/**
 * Format data for export based on column configuration
 */
export const formatDataForExport = (data: any[], columns: ExcelColumn[]): any[] => {
  return data.map(row => {
    const formattedRow: any = {};
    columns.forEach(col => {
      formattedRow[col.key] = formatValue(row[col.key], col.type, col.format);
    });
    return formattedRow;
  });
};

/**
 * Export data to Excel file using ExcelJS
 */
export const exportToExcel = async (
  data: any[],
  columns: ExcelColumn[],
  options: ExportOptions
): Promise<void> => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const sheetName = options.sheetName || 'Sheet1';
    const worksheet = workbook.addWorksheet(sheetName);

    // Define columns
    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }));

    // Format the data
    const formattedData = formatDataForExport(data, columns);

    // Add rows
    formattedData.forEach(row => {
      const excelRow = worksheet.addRow(row);
      
      // Apply cell formatting based on column type
      columns.forEach((col, index) => {
        const cell = excelRow.getCell(index + 1);
        
        if (col.type === 'currency') {
          cell.numFmt = '₦#,##0.00';
        } else if (col.type === 'date') {
          cell.numFmt = 'dd/mm/yyyy';
        } else if (col.type === 'number') {
          cell.numFmt = '#,##0';
        }
      });
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Generate filename with optional timestamp
    let filename = options.filename;
    if (options.includeTimestamp !== false) {
      const timestamp = new Date().toISOString().split('T')[0];
      const nameParts = filename.split('.');
      const extension = nameParts.pop();
      filename = `${nameParts.join('.')}_${timestamp}.${extension}`;
    }

    // Ensure .xlsx extension
    if (!filename.endsWith('.xlsx')) {
      filename += '.xlsx';
    }

    // Write the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });

    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export data to Excel');
  }
};

/**
 * Export data to Excel with multiple sheets
 */
export const exportToExcelMultiSheet = async (
  sheets: Array<{
    data: any[];
    columns: ExcelColumn[];
    sheetName: string;
  }>,
  filename: string
): Promise<void> => {
  if (!sheets || sheets.length === 0) {
    console.warn('No sheets to export');
    return;
  }

  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // Add each sheet
    sheets.forEach(({ data, columns, sheetName }) => {
      if (data && data.length > 0) {
        const worksheet = workbook.addWorksheet(sheetName);
        
        // Define columns
        worksheet.columns = columns.map(col => ({
          header: col.header,
          key: col.key,
          width: col.width || 15,
        }));

        // Format and add data
        const formattedData = formatDataForExport(data, columns);
        formattedData.forEach(row => {
          const excelRow = worksheet.addRow(row);
          
          // Apply cell formatting
          columns.forEach((col, index) => {
            const cell = excelRow.getCell(index + 1);
            
            if (col.type === 'currency') {
              cell.numFmt = '₦#,##0.00';
            } else if (col.type === 'date') {
              cell.numFmt = 'dd/mm/yyyy';
            } else if (col.type === 'number') {
              cell.numFmt = '#,##0';
            }
          });
        });

        // Style header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      }
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const nameParts = filename.split('.');
    const extension = nameParts.pop();
    let finalFilename = `${nameParts.join('.')}_${timestamp}.${extension || 'xlsx'}`;

    // Ensure .xlsx extension
    if (!finalFilename.endsWith('.xlsx')) {
      finalFilename += '.xlsx';
    }

    // Write the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });

    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = finalFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export data to Excel');
  }
};

/**
 * Create download progress tracker (for UI feedback with large datasets)
 */
export const createExportProgress = () => {
  let progress = 0;
  
  return {
    update: (current: number, total: number) => {
      progress = Math.round((current / total) * 100);
      return progress;
    },
    get: () => progress,
    reset: () => {
      progress = 0;
    }
  };
};

import { exportToPDF, PDFExportOptions, PDFSection } from './pdfExport';
import { exportToExcel, ExcelColumn } from './excelExport';

/**
 * Export report data to Excel format
 */
export const exportReportToExcel = async (
  data: any[],
  columns: ExcelColumn[],
  filename: string,
  sheetName?: string
): Promise<void> => {
  await exportToExcel(data, columns, {
    filename,
    sheetName: sheetName || 'Report',
    includeTimestamp: true,
  });
};

/**
 * Export report to PDF with school branding
 */
export const exportReportToPDF = async (
  title: string,
  contentElement: HTMLElement,
  options?: {
    subtitle?: string;
    schoolName?: string;
    schoolLogo?: string;
    generatedBy?: string;
  }
): Promise<void> => {
  const pdfOptions: PDFExportOptions = {
    title,
    subtitle: options?.subtitle,
    includeBranding: true,
    pageSize: 'a4',
    orientation: 'portrait',
    includeTableOfContents: false,
    sections: [
      {
        title: 'Report Content',
        content: contentElement,
        type: 'chart',
      },
    ],
    generatedBy: options?.generatedBy || 'System',
    generatedAt: new Date().toLocaleDateString(),
    schoolName: options?.schoolName,
    schoolLogo: options?.schoolLogo,
  };

  await exportToPDF(pdfOptions);
};

/**
 * Export multi-section report to PDF
 */
export const exportMultiSectionReportToPDF = async (
  title: string,
  sections: PDFSection[],
  options?: {
    subtitle?: string;
    schoolName?: string;
    schoolLogo?: string;
    generatedBy?: string;
    includeTableOfContents?: boolean;
    orientation?: 'portrait' | 'landscape';
  }
): Promise<void> => {
  const pdfOptions: PDFExportOptions = {
    title,
    subtitle: options?.subtitle,
    includeBranding: true,
    pageSize: 'a4',
    orientation: options?.orientation || 'portrait',
    includeTableOfContents: options?.includeTableOfContents ?? true,
    sections,
    generatedBy: options?.generatedBy || 'System',
    generatedAt: new Date().toLocaleDateString(),
    schoolName: options?.schoolName,
    schoolLogo: options?.schoolLogo,
  };

  await exportToPDF(pdfOptions);
};

/**
 * Print report directly from browser
 */
export const printReport = (contentElement: HTMLElement): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print reports');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Report</title>
        <style>
          @media print {
            @page {
              margin: 1cm;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        ${contentElement.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  
  // Wait for content to load then print
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};

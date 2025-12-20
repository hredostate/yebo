/**
 * PDF Generation Service
 * 
 * Handles PDF generation using Supabase Edge Functions with headless Chromium.
 * Replaces client-side html2canvas + jsPDF approach for better A4 print quality.
 */

import { requireSupabaseClient } from './supabaseClient';

export interface PdfGenerationOptions {
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  watermark?: 'DRAFT' | 'FINAL' | 'NONE';
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

export interface PdfGenerationResult {
  success: boolean;
  pdfBlob?: Blob;
  error?: string;
}

/**
 * Generate PDF from HTML content using Edge Function
 * This provides better print quality and proper A4 page breaks
 */
export async function generatePdfFromHtml(
  htmlContent: string,
  options: PdfGenerationOptions = {}
): Promise<PdfGenerationResult> {
  const supabase = requireSupabaseClient();

  try {
    // For now, use the client-side fallback since Edge Function setup is optional
    // In production, this would call the Edge Function
    console.warn('PDF generation via Edge Function not yet configured. Using client-side fallback.');
    
    // TODO: Call Edge Function when available
    // const { data, error } = await supabase.functions.invoke('generate-pdf', {
    //   body: {
    //     html: htmlContent,
    //     options: {
    //       format: options.format || 'A4',
    //       margin: options.margin || { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    //       watermark: options.watermark || 'NONE',
    //       displayHeaderFooter: options.displayHeaderFooter || false,
    //       headerTemplate: options.headerTemplate || '',
    //       footerTemplate: options.footerTemplate || ''
    //     }
    //   }
    // });
    //
    // if (error) {
    //   return { success: false, error: error.message };
    // }
    //
    // const pdfBlob = new Blob([data], { type: 'application/pdf' });
    // return { success: true, pdfBlob };

    return { 
      success: false, 
      error: 'PDF generation via Edge Function not yet implemented. Please use browser print instead.' 
    };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Generate PDF from multiple HTML contents and combine into one PDF
 */
export async function generateCombinedPdf(
  htmlContents: string[],
  options: PdfGenerationOptions = {}
): Promise<PdfGenerationResult> {
  const supabase = requireSupabaseClient();

  try {
    // For now, use the client-side fallback
    console.warn('Combined PDF generation via Edge Function not yet configured.');
    
    return { 
      success: false, 
      error: 'Combined PDF generation not yet implemented. Please use individual PDFs instead.' 
    };
  } catch (error) {
    console.error('Error generating combined PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Client-side fallback: Trigger browser print dialog
 * This uses the browser's native print capabilities which support @page CSS
 */
export function triggerBrowserPrint(): void {
  window.print();
}

/**
 * Add print CSS styles to the document
 * These styles ensure proper A4 formatting and page breaks
 */
export function addPrintStyles(): void {
  const styleId = 'report-card-print-styles';
  
  // Remove existing styles if present
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @page {
      size: A4;
      margin: 10mm;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page-break {
        page-break-before: always;
        break-before: page;
      }

      .page-break-inside-avoid {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      table, tr, td, th {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .no-print {
        display: none !important;
      }

      .print-only {
        display: block !important;
      }

      /* Ensure proper table borders in print */
      table {
        border-collapse: collapse;
      }

      /* Prevent orphan headings */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
        break-after: avoid;
      }

      /* Prevent orphan/widow lines */
      p {
        orphans: 3;
        widows: 3;
      }

      /* A4 dimensions */
      .a4-page {
        width: 210mm;
        min-height: 297mm;
        padding: 10mm;
        margin: 0;
        background: white;
      }

      /* Hide navigation and controls in print */
      nav, .sidebar, .modal, .toast, button:not(.print-button) {
        display: none !important;
      }
    }

    @media screen {
      .print-only {
        display: none !important;
      }

      /* A4 preview mode */
      .a4-preview {
        width: 210mm;
        min-height: 297mm;
        padding: 10mm;
        margin: 20px auto;
        background: white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Remove print styles from the document
 */
export function removePrintStyles(): void {
  const styleId = 'report-card-print-styles';
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }
}

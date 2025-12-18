/**
 * Report Card Export Service
 * 
 * Handles PDF generation with fixed viewport for consistent output.
 * Uses html2canvas with fixed A4 dimensions (794x1123px at 96dpi).
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { UnifiedReportCardData, WatermarkType } from '../types/reportCardPrint';

// A4 dimensions at 96 DPI
const A4_WIDTH_PX = 794;   // 210mm at 96dpi
const A4_HEIGHT_PX = 1123; // 297mm at 96dpi

// A4 dimensions in mm for jsPDF
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 6;
const SAFE_WIDTH_MM = A4_WIDTH_MM - (MARGIN_MM * 2);
const SAFE_HEIGHT_MM = A4_HEIGHT_MM - (MARGIN_MM * 2);

/**
 * Exports a single report card to PDF
 */
export async function exportReportCardToPDF(
  container: HTMLElement,
  watermark?: WatermarkType
): Promise<Blob> {
  try {
    // Capture the report card as canvas with fixed viewport
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      windowWidth: A4_WIDTH_PX,
      windowHeight: A4_HEIGHT_PX,
    });

    // Create PDF with A4 dimensions
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Convert canvas to image
    const imgData = canvas.toDataURL('image/png');
    
    // Calculate image dimensions to fit page
    const imgWidth = SAFE_WIDTH_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add image to PDF
    let heightLeft = imgHeight;
    let position = MARGIN_MM;

    pdf.addImage(imgData, 'PNG', MARGIN_MM, position, imgWidth, imgHeight);
    heightLeft -= SAFE_HEIGHT_MM;

    // Handle multi-page reports (if content exceeds one page)
    while (heightLeft > 0) {
      position = MARGIN_MM - (imgHeight - heightLeft);
      pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'PNG', MARGIN_MM, position, imgWidth, imgHeight);
      heightLeft -= SAFE_HEIGHT_MM;
    }

    // Return as blob
    return pdf.output('blob');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Renders a report card component to a temporary container and exports to PDF
 */
export async function renderAndExportReportCard(
  reportCardElement: JSX.Element,
  watermark?: WatermarkType
): Promise<Blob> {
  // Create temporary container off-screen
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '0';
  tempContainer.style.width = `${A4_WIDTH_PX}px`;
  tempContainer.style.height = `${A4_HEIGHT_PX}px`;
  document.body.appendChild(tempContainer);

  try {
    // Import React and ReactDOM dynamically to render
    const React = await import('react');
    const ReactDOM = await import('react-dom/client');

    // Render component
    const root = ReactDOM.createRoot(tempContainer);
    await new Promise<void>((resolve) => {
      root.render(reportCardElement);
      // Wait for render to complete
      setTimeout(() => resolve(), 200);
    });

    // Export to PDF
    const blob = await exportReportCardToPDF(tempContainer, watermark);

    // Cleanup
    root.unmount();
    return blob;
  } finally {
    // Always remove temp container
    if (tempContainer.parentNode) {
      document.body.removeChild(tempContainer);
    }
  }
}

/**
 * Downloads a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports multiple report cards to a ZIP file
 */
export async function exportReportCardsToZip(
  reports: Array<{
    data: UnifiedReportCardData;
    filename: string;
  }>,
  watermark?: WatermarkType
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // This would need actual implementation with the component rendering
  // For now, this is a placeholder that shows the structure
  throw new Error('Not implemented: Use BulkReportCardGenerator for batch exports');
}

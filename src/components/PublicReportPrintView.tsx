/**
 * PublicReportPrintView Component
 * 
 * Dedicated print-friendly view for report cards accessed via /report/:token/:slug?/print
 * Applies A4 portrait print CSS and ensures the report is ready for browser printing.
 */

import React, { useEffect } from 'react';
import { parsePublicReportTokenFromLocation } from '../utils/reportUrlHelpers';
import { ReportCardPrintRenderer } from './reports/ReportCardPrintRenderer';

const PublicReportPrintView: React.FC = () => {
  // Parse token from URL (handles /report/:token/:slug?/print)
  const token = parsePublicReportTokenFromLocation();

  useEffect(() => {
    // Ensure print styles are loaded
    document.body.classList.add('print-mode');
    
    return () => {
      document.body.classList.remove('print-mode');
    };
  }, []);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Invalid Link</h1>
          <p className="text-slate-600">The report link is invalid or malformed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-print-root" style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Inline print styles for A4 portrait */}
      <style>
{`
  @page {
    size: A4 portrait;
    margin: 15mm;
  }

  html, body {
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }

  .report-print-root {
    width: 100% !important;
    max-width: 100% !important;
    min-height: auto !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    transform: none !important;
    zoom: 1 !important;
    box-sizing: border-box !important;
    overflow: visible !important;
  }

  /* Hide screen-only elements in print */
  @media print {
    .no-print, .screen-only {
      display: none !important;
    }
  }

  /* Screen print button for convenience */
  .screen-print-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #2563eb;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    transition: background 0.2s;
  }

  .screen-print-button:hover {
    background: #1d4ed8;
  }

  @media print {
    .screen-print-button {
      display: none !important;
    }
  }
`}
      </style>

      {/* Screen-only print button */}
      <button 
        className="screen-print-button no-print screen-only"
        onClick={() => window.print()}
      >
        🖨️ Print / Save PDF
      </button>

      {/* Report card renderer */}
      <ReportCardPrintRenderer token={token} watermark="NONE" />
    </div>
  );
};

export default PublicReportPrintView;

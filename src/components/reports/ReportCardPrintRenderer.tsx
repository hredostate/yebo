/**
 * ReportCardPrintRenderer Component
 * 
 * Single source of truth for rendering report cards in print-ready format.
 * Used by both PublicReportView (for print route) and BulkReportCardGenerator.
 * 
 * This component fetches report data, normalizes it, and renders using UnifiedReportCard.
 */

import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../../services/supabaseClient';
import { buildUnifiedReportData } from '../../utils/buildUnifiedReportData';
import { UnifiedReportCard } from './UnifiedReportCard';
import type { UnifiedReportCardData, WatermarkType } from '../../types/reportCardPrint';
import Spinner from '../common/Spinner';

interface ReportCardPrintRendererProps {
  token: string;
  watermark?: WatermarkType;
  onDataLoaded?: (data: UnifiedReportCardData) => void;
  onError?: (error: string) => void;
}

export const ReportCardPrintRenderer: React.FC<ReportCardPrintRendererProps> = ({
  token,
  watermark = 'NONE',
  onDataLoaded,
  onError,
}) => {
  const [reportData, setReportData] = useState<UnifiedReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReportData();
  }, [token]);

  const fetchReportData = async () => {
    try {
      const supabase = requireSupabaseClient();

      // Fetch report by token
      const { data: report, error: reportError } = await supabase
        .from('student_term_reports')
        .select(`
          *,
          student:students!student_id (
            id,
            name,
            admission_number,
            school_id
          ),
          term:terms!term_id (
            id,
            term_label,
            session_label,
            start_date,
            end_date
          ),
          academic_class:academic_classes!academic_class_id (
            id,
            name,
            arm,
            level
          )
        `)
        .eq('public_token', token)
        .maybeSingle();

      if (reportError) throw reportError;
      if (!report) {
        const errMsg = 'Report not found';
        setError(errMsg);
        onError?.(errMsg);
        setLoading(false);
        return;
      }

      // Check if token is expired
      if (report.token_expires_at) {
        const expiryDate = new Date(report.token_expires_at);
        if (expiryDate < new Date()) {
          const errMsg = 'Report link expired';
          setError(errMsg);
          onError?.(errMsg);
          setLoading(false);
          return;
        }
      }

      // Fetch detailed report data using RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_student_term_report_details', {
        p_student_id: report.student_id,
        p_term_id: report.term_id,
      });

      if (rpcError) throw rpcError;

      // Normalize related records (Supabase returns single object, not array, for maybeSingle queries)
      const studentData = report.student as any;
      const termData = report.term as any;
      const classData = report.academic_class as any;
      let schoolConfig: any = {};
      if (studentData?.school_id) {
        const { data: config } = await supabase
          .from('school_config')
          .select('*')
          .eq('school_id', studentData.school_id)
          .maybeSingle();
        if (config) {
          schoolConfig = config;
        }
      }

      // Fetch class config for customizations
      let classConfig: any = {};
      if (report.student_id && report.term_id) {
        const { data: enrollment } = await supabase
          .from('academic_class_students')
          .select('academic_class_id')
          .eq('student_id', report.student_id)
          .eq('enrolled_term_id', report.term_id)
          .maybeSingle();

        if (enrollment?.academic_class_id) {
          const { data: classData } = await supabase
            .from('academic_classes')
            .select('report_config')
            .eq('id', enrollment.academic_class_id)
            .maybeSingle();
          
          if (classData?.report_config) {
            classConfig = classData.report_config;
          }
        }
      }

      // Build unified report data
      const unifiedData = buildUnifiedReportData(rpcData, schoolConfig, classConfig);
      
      setReportData(unifiedData);
      onDataLoaded?.(unifiedData);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching report data:', err);
      const errMsg = err.message || 'Failed to load report';
      setError(errMsg);
      onError?.(errMsg);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Error</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="text-6xl mb-4">📄</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">No Data</h1>
          <p className="text-slate-600">Report data could not be loaded.</p>
        </div>
      </div>
    );
  }

  return <UnifiedReportCard data={reportData} watermark={watermark} />;
};

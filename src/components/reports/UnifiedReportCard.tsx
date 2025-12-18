/**
 * Unified Report Card Component
 * 
 * Single source of truth for report card rendering across all entry points.
 * Uses fixed A4 dimensions with mm/pt units only - NO responsive breakpoints.
 */

import React from 'react';
import type { UnifiedReportCardData, WatermarkType } from '../../types/reportCardPrint';
import './unified-report-card.css';

interface UnifiedReportCardProps {
  data: UnifiedReportCardData;
  watermark?: WatermarkType;
}

// Helper: Get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinal = (n: number | string | null | undefined): string => {
  if (n == null || n === 'N/A') return '-';
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (isNaN(num)) return '-';
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Helper: Sanitize strings for HTML
const sanitize = (str: string | number | undefined | null): string => {
  if (str == null) return '';
  const text = String(str);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Helper: Get grade badge class
const getGradeBadgeClass = (grade: string): string => {
  const firstChar = grade.charAt(0).toUpperCase();
  return `urc-grade-badge grade-${firstChar}`;
};

// Helper: Calculate CA and Exam from component scores
const categorizeComponentScore = (componentScores: Record<string, number>): { caScore: number; examScore: number } => {
  let caScore = 0;
  let examScore = 0;
  
  Object.entries(componentScores).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('exam') || lowerKey.includes('test') || lowerKey.includes('final')) {
      examScore += value;
    } else {
      caScore += value;
    }
  });
  
  return { caScore, examScore };
};

export const UnifiedReportCard: React.FC<UnifiedReportCardProps> = ({ data, watermark }) => {
  const { student, school, term, subjects, summary, comments, attendance, assessmentComponents, config } = data;

  // Configuration
  const themeColor = config?.colorTheme || '#1e3a8a';
  const logoUrl = config?.customLogoUrl || school.logoUrl;
  const schoolName = config?.schoolNameOverride || school.displayName || school.name;
  const principalLabel = config?.principalLabel || 'Principal';
  const teacherLabel = config?.teacherLabel || 'Class Teacher';

  return (
    <div className="urc-page">
      {/* Watermark */}
      {watermark && watermark !== 'NONE' && (
        <div className="urc-watermark">{watermark}</div>
      )}

      <div className="urc-content">
        {/* Header */}
        <div className="urc-header">
          {logoUrl && (
            <img src={logoUrl} alt="School Logo" className="urc-logo" />
          )}
          <h1 className="urc-school-name">{sanitize(schoolName)}</h1>
          {school.motto && (
            <p className="urc-motto">{sanitize(school.motto)}</p>
          )}
          {school.address && (
            <p className="urc-address">{sanitize(school.address)}</p>
          )}
          <div className="urc-term-badge">
            {sanitize(term.sessionLabel)} - {sanitize(term.termLabel)}
          </div>
        </div>

        {/* Student Info */}
        <div className="urc-student-info">
          <div className="urc-info-item">
            <span className="urc-info-label">Name: </span>
            <strong className="urc-info-value">{sanitize(student.fullName)}</strong>
          </div>
          <div className="urc-info-item">
            <span className="urc-info-label">Class: </span>
            <strong className="urc-info-value">{sanitize(student.className)}</strong>
          </div>
          <div className="urc-info-item">
            <span className="urc-info-label">Admission No: </span>
            <strong className="urc-info-value">{sanitize(student.admissionNumber)}</strong>
          </div>
          <div className="urc-info-item">
            <span className="urc-info-label">Attendance: </span>
            <strong className="urc-info-value">
              {attendance ? `${attendance.rate.toFixed(1)}% (${attendance.present}/${attendance.total})` : 'N/A'}
            </strong>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="urc-summary-cards">
          <div className="urc-summary-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <p className="urc-summary-label" style={{ color: '#2563eb' }}>Total Score</p>
            <p className="urc-summary-value">{summary.totalScore.toFixed(1)}</p>
          </div>
          <div className="urc-summary-card" style={{ background: '#faf5ff', borderColor: '#e9d5ff' }}>
            <p className="urc-summary-label" style={{ color: '#9333ea' }}>Average</p>
            <p className="urc-summary-value">{summary.averageScore.toFixed(2)}%</p>
          </div>
          <div className="urc-summary-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <p className="urc-summary-label" style={{ color: '#16a34a' }}>GPA</p>
            <p className="urc-summary-value">{summary.gpaAverage || 'N/A'}</p>
          </div>
          <div className="urc-summary-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <p className="urc-summary-label" style={{ color: '#d97706' }}>Position</p>
            <p className="urc-summary-value">{getOrdinal(summary.positionInArm)}</p>
            {summary.campusPercentile != null && (
              <p style={{ margin: '1mm 0 0 0', fontSize: '8pt', color: '#b45309' }}>
                Campus: {summary.campusPercentile}th
              </p>
            )}
          </div>
        </div>

        {/* Attendance Summary */}
        {attendance && attendance.total > 0 && (
          <div className="urc-attendance">
            <h4 className="urc-attendance-title">Attendance Summary</h4>
            <div className="urc-attendance-grid">
              <div className="urc-attendance-item">
                <p className="urc-attendance-label">Days Present</p>
                <p className="urc-attendance-count" style={{ color: '#16a34a' }}>{attendance.present}</p>
              </div>
              <div className="urc-attendance-item">
                <p className="urc-attendance-label">Days Absent</p>
                <p className="urc-attendance-count" style={{ color: '#dc2626' }}>{attendance.absent}</p>
              </div>
              <div className="urc-attendance-item">
                <p className="urc-attendance-label">Days Late</p>
                <p className="urc-attendance-count" style={{ color: '#ea580c' }}>{attendance.late}</p>
              </div>
              <div className="urc-attendance-item">
                <p className="urc-attendance-label">Excused</p>
                <p className="urc-attendance-count" style={{ color: '#2563eb' }}>{attendance.excused}</p>
              </div>
              <div className="urc-attendance-item">
                <p className="urc-attendance-label">Unexcused</p>
                <p className="urc-attendance-count" style={{ color: '#b91c1c' }}>{attendance.unexcused}</p>
              </div>
              <div className="urc-attendance-item">
                <p className="urc-attendance-label">Total Days</p>
                <p className="urc-attendance-count" style={{ color: '#475569' }}>{attendance.total}</p>
              </div>
            </div>
          </div>
        )}

        {/* Subjects Table */}
        <div className="urc-table-container">
          <h3 className="urc-section-title" style={{ borderColor: themeColor }}>Academic Performance</h3>
          <table className="urc-table">
            <thead>
              <tr>
                <th className="col-sn">S/N</th>
                <th className="col-subject">Subject</th>
                {assessmentComponents && assessmentComponents.length > 0 ? (
                  assessmentComponents.map((comp, idx) => (
                    <th key={idx} className="col-component">
                      {sanitize(comp.name)}
                      <br />
                      <span style={{ fontSize: '7pt', fontWeight: 'normal' }}>/{comp.max_score}</span>
                    </th>
                  ))
                ) : (
                  <>
                    <th className="col-score">CA</th>
                    <th className="col-score">Exam</th>
                  </>
                )}
                <th className="col-total">Total</th>
                <th className="col-grade">Grade</th>
                <th className="col-pos">Pos</th>
                <th className="col-remark">Remark</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject, idx) => {
                const { caScore, examScore } = subject.componentScores 
                  ? categorizeComponentScore(subject.componentScores)
                  : { caScore: 0, examScore: 0 };

                return (
                  <tr key={idx}>
                    <td className="col-sn">{idx + 1}</td>
                    <td className="col-subject">{sanitize(subject.subjectName)}</td>
                    {assessmentComponents && assessmentComponents.length > 0 ? (
                      assessmentComponents.map((comp, compIdx) => (
                        <td key={compIdx} className="col-component">
                          {subject.componentScores?.[comp.name] ?? '-'}
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="col-score">{subject.componentScores ? caScore : '-'}</td>
                        <td className="col-score">{subject.componentScores ? examScore : '-'}</td>
                      </>
                    )}
                    <td className="col-total">{subject.totalScore.toFixed(1)}</td>
                    <td className="col-grade">
                      <span className={getGradeBadgeClass(subject.grade)}>
                        {sanitize(subject.grade)}
                      </span>
                    </td>
                    <td className="col-pos">{getOrdinal(subject.subjectPosition)}</td>
                    <td className="col-remark">{sanitize(subject.remark)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Comments */}
        <div className="urc-comments">
          <div className="urc-comment-box">
            <h4 className="urc-comment-title">{sanitize(teacherLabel)}'s Remark</h4>
            <p className="urc-comment-text">
              {sanitize(comments.teacher || 'No comment provided.')}
            </p>
            <div className="urc-signature-line">
              <span className="urc-signature-label">Signature & Date</span>
            </div>
          </div>
          <div className="urc-comment-box">
            <h4 className="urc-comment-title">{sanitize(principalLabel)}'s Remark</h4>
            <p className="urc-comment-text">
              {sanitize(comments.principal || 'No comment provided.')}
            </p>
            <div className="urc-signature-line">
              <span className="urc-signature-label">Signature & Date</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="urc-footer">
          {sanitize(schoolName)} • Generated on {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

export default UnifiedReportCard;

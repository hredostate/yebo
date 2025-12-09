import React, { useState } from 'react';
import type { GeneratedReport, ReportGenerationRequest, Student } from '../../types';
import { generateReport } from '../../services/reportGenerator';
import { FileTextIcon, DownloadIcon, EditIcon, CheckCircleIcon } from '../common/icons';

interface AutomatedReportWriterProps {
  students: Student[];
}

const AutomatedReportWriter: React.FC<AutomatedReportWriterProps> = ({ students }) => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<Partial<ReportGenerationRequest>>({
    tone: 'balanced',
    length: 'standard',
    includeAttendance: true,
    includeBehavior: true,
  });

  const generateStudentReport = async (student: Student) => {
    if (!student) return;
    
    setLoading(true);
    setSelectedStudent(student);
    
    try {
      // Mock student report data - in production, fetch from API
      const studentData = {
        studentName: student.name,
        subjectScores: [
          { subjectId: 1, subjectName: 'Mathematics', score: 75, grade: 'B', previousScore: 70 },
          { subjectId: 2, subjectName: 'English', score: 82, grade: 'A', previousScore: 78 },
          { subjectId: 3, subjectName: 'Science', score: 68, grade: 'C', previousScore: 72 },
          { subjectId: 4, subjectName: 'History', score: 79, grade: 'B', previousScore: 75 },
        ],
        attendanceRate: 92,
        behaviorNotes: ['Helpful to peers', 'Shows initiative'],
        participationLevel: 'good' as const,
      };

      const reportRequest: ReportGenerationRequest = {
        studentId: student.id,
        termId: 1,
        subjects: [1, 2, 3, 4],
        includeAttendance: request.includeAttendance || false,
        includeBehavior: request.includeBehavior || false,
        tone: request.tone || 'balanced',
        length: request.length || 'standard',
      };

      const report = await generateReport(reportRequest, studentData);
      setGeneratedReport(report);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileTextIcon className="w-6 h-6" />
          Automated Report Writer
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Generate teacher comments using AI language model
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
              Report Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tone
                </label>
                <select
                  value={request.tone}
                  onChange={(e) => setRequest({ ...request, tone: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="formal">Formal</option>
                  <option value="encouraging">Encouraging</option>
                  <option value="constructive">Constructive</option>
                  <option value="balanced">Balanced</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Length
                </label>
                <select
                  value={request.length}
                  onChange={(e) => setRequest({ ...request, length: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="brief">Brief</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={request.includeAttendance}
                    onChange={(e) => setRequest({ ...request, includeAttendance: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Include Attendance
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={request.includeBehavior}
                    onChange={(e) => setRequest({ ...request, includeBehavior: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Include Behavior
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Student Selection */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
              Select Student
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {students.slice(0, 15).map((student) => (
                <button
                  key={student.id}
                  onClick={() => generateStudentReport(student)}
                  disabled={loading}
                  className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                    selectedStudent?.id === student.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {student.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generated Report Display */}
        <div className="lg:col-span-2 space-y-4">
          {loading && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">
                Generating report comments...
              </p>
            </div>
          )}

          {!loading && generatedReport && (
            <>
              {/* Report Header */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Report for {selectedStudent?.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Generated: {new Date(generatedReport.generatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <EditIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <DownloadIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Overall Comment */}
                <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                  <div className="font-medium text-indigo-900 dark:text-indigo-300 mb-2">
                    Overall Comment:
                  </div>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">
                    {generatedReport.overallComment}
                  </p>
                </div>

                {/* Subject Comments */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    Subject Comments
                  </h4>
                  {generatedReport.subjectComments.map((comment) => (
                    <div
                      key={comment.subjectId}
                      className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-medium text-slate-900 dark:text-white">
                            {comment.subjectName}
                          </h5>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                              Grade: {comment.grade}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded capitalize">
                              Effort: {comment.effort}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {comment.comment}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    Strengths
                  </h4>
                  <ul className="space-y-2">
                    {generatedReport.strengthsHighlighted.map((strength, idx) => (
                      <li key={idx} className="text-sm text-slate-600 dark:text-slate-400">
                        • {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Areas for Improvement */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                    Areas for Improvement
                  </h4>
                  <ul className="space-y-2">
                    {generatedReport.areasForImprovement.map((area, idx) => (
                      <li key={idx} className="text-sm text-slate-600 dark:text-slate-400">
                        • {area}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Goals for Next Term */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                    Goals for Next Term
                  </h4>
                  <ul className="space-y-2">
                    {generatedReport.goalsForNextTerm.map((goal, idx) => (
                      <li key={idx} className="text-sm text-slate-600 dark:text-slate-400">
                        • {goal}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Parent Recommendations */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                    Parent Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {generatedReport.parentRecommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-slate-600 dark:text-slate-400">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {!loading && !generatedReport && (
            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-12 text-center">
              <FileTextIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Configure settings and select a student to generate report
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutomatedReportWriter;

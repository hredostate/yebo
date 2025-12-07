
import React from 'react';
import type { StudentTermReport, Student, GradingScheme, SchoolConfig, Term, AssessmentComponent } from '../types';

interface ResultSheetProps {
    report: StudentTermReport;
    student: Student;
    subjects: Array<{
        subject_name: string;
        component_scores?: Record<string, number>; // e.g. { "CA1": 10, "CA2": 15, "Exam": 50 }
        ca_score: number;
        exam_score: number;
        total_score: number;
        grade: string;
        remark: string;
        teacher_comment?: string;
        subject_position?: number;
    }>;
    assessmentComponents?: AssessmentComponent[]; // Component definitions like [{ name: "CA1", max_score: 10 }]
    gradingScheme: GradingScheme;
    schoolConfig: SchoolConfig | null;
    term: Term;
    classPosition: number;
    classSize: number;
    gradeLevelPosition?: number;
    gradeLevelSize?: number;
}

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinal = (n: number | undefined | null): string => {
    if (!n) return '-';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Design 1: Modern Gradient Card Design
export const ModernGradientResultSheet: React.FC<ResultSheetProps> = ({
    report, student, subjects, assessmentComponents, gradingScheme, schoolConfig, term, classPosition, classSize, gradeLevelPosition, gradeLevelSize
}) => {
    const getGradeColor = (grade: string) => {
        const colors: Record<string, string> = {
            'A': 'from-emerald-500 to-green-600',
            'B': 'from-blue-500 to-indigo-600',
            'C': 'from-amber-500 to-orange-500',
            'D': 'from-orange-500 to-red-500',
            'E': 'from-red-500 to-red-700',
            'F': 'from-red-700 to-red-900',
        };
        return colors[grade[0]] || 'from-slate-500 to-slate-600';
    };

    return (
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl mx-auto print:shadow-none print:rounded-none">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white p-8">
                <div className="flex justify-between items-start">
                    <div>
                        {schoolConfig?.logo_url && (
                            <img src={schoolConfig.logo_url} alt="School Logo" className="w-16 h-16 rounded-full border-2 border-white/30 mb-4" />
                        )}
                        <h1 className="text-3xl font-bold">{schoolConfig?.school_name || 'School Name'}</h1>
                        <p className="text-white/80 mt-1">Academic Report Card</p>
                    </div>
                    <div className="text-right">
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 inline-block">
                            <p className="text-sm text-white/70">Term</p>
                            <p className="text-xl font-bold">{term.term_label}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Student Info Cards */}
            <div className="p-8 bg-gradient-to-b from-slate-50 to-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-4 shadow-md border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Student Name</p>
                        <p className="text-lg font-bold text-slate-800 mt-1">{student.name}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-md border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Admission No.</p>
                        <p className="text-lg font-bold text-slate-800 mt-1">{student.admission_number}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-md border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Class Position</p>
                        <p className="text-lg font-bold text-slate-800 mt-1">{classPosition} of {classSize}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-md border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Average</p>
                        <p className="text-lg font-bold text-indigo-600 mt-1">{report.average_score?.toFixed(1)}%</p>
                    </div>
                </div>

                {/* Subjects as Cards */}
                <h2 className="text-xl font-bold text-slate-800 mb-4">Subject Performance</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {subjects.map((subject, idx) => (
                        <div key={idx} className="bg-white rounded-xl p-4 shadow-md border border-slate-100 flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getGradeColor(subject.grade)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                                {subject.grade}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-800">{subject.subject_name}</p>
                                <div className="flex gap-4 text-sm text-slate-500 mt-1">
                                    {subject.component_scores && Object.keys(subject.component_scores).length > 0 ? (
                                        // Show component breakdown if available
                                        <>
                                            {Object.entries(subject.component_scores).map(([name, score]) => (
                                                <span key={name}>{name}: {score}</span>
                                            ))}
                                        </>
                                    ) : (
                                        // Fallback to CA/Exam if no components
                                        <>
                                            <span>CA: {subject.ca_score}</span>
                                            <span>Exam: {subject.exam_score}</span>
                                        </>
                                    )}
                                    <span className="font-bold text-slate-700">Total: {subject.total_score}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-slate-800">{subject.total_score}%</p>
                                <p className="text-xs text-slate-500">{subject.remark}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Comments */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                        <p className="text-sm font-bold text-blue-800 mb-2">Class Teacher's Remark</p>
                        <p className="text-slate-700 italic">"{report.teacher_comment || 'No comment provided.'}"</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
                        <p className="text-sm font-bold text-purple-800 mb-2">Principal's Remark</p>
                        <p className="text-slate-700 italic">"{report.principal_comment || 'No comment provided.'}"</p>
                    </div>
                </div>

                {/* Grade Key */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-sm font-bold text-slate-700 mb-3">Grading Scale</p>
                    <div className="flex flex-wrap gap-2">
                        {gradingScheme.rules?.map((rule, idx) => (
                            <span key={idx} className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${getGradeColor(rule.grade)} text-white`}>
                                {rule.grade}: {rule.min_score}-{rule.max_score}%
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Design 2: Banded Rows Table Design (Classic)
export const BandedRowsResultSheet: React.FC<ResultSheetProps> = ({
    report, student, subjects, assessmentComponents, gradingScheme, schoolConfig, term, classPosition, classSize, gradeLevelPosition, gradeLevelSize
}) => {
    const getOrdinalSuffix = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    };

    return (
        <div className="bg-white max-w-4xl mx-auto print:shadow-none">
            {/* Formal Header */}
            <div className="border-b-4 border-double border-slate-800 pb-6 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {schoolConfig?.logo_url && (
                            <img src={schoolConfig.logo_url} alt="Logo" className="w-20 h-20 object-contain" />
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">
                                {schoolConfig?.school_name || 'School Name'}
                            </h1>
                            <p className="text-sm text-slate-600">{schoolConfig?.school_address || 'School Address'}</p>
                            <p className="text-sm text-slate-600">Tel: {schoolConfig?.phone_number || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="border-2 border-slate-800 px-6 py-3 rounded">
                            <p className="text-xs text-slate-600">Session</p>
                            <p className="text-lg font-bold">{term.session_label}</p>
                            <p className="text-sm font-medium text-slate-700">{term.term_label}</p>
                        </div>
                    </div>
                </div>
                <div className="text-center mt-4">
                    <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-300 inline-block px-8 pb-1">
                        STUDENT ACADEMIC REPORT
                    </h2>
                </div>
            </div>

            {/* Student Details Table */}
            <div className="mb-6">
                <table className="w-full text-sm border-collapse">
                    <tbody>
                        <tr>
                            <td className="border border-slate-300 p-2 bg-slate-100 font-semibold w-1/4">Name of Student:</td>
                            <td className="border border-slate-300 p-2 w-1/4">{student.name}</td>
                            <td className="border border-slate-300 p-2 bg-slate-100 font-semibold w-1/4">Admission No:</td>
                            <td className="border border-slate-300 p-2 w-1/4">{student.admission_number}</td>
                        </tr>
                        <tr>
                            <td className="border border-slate-300 p-2 bg-slate-100 font-semibold">Class:</td>
                            <td className="border border-slate-300 p-2">{student.grade} {student.arm}</td>
                            <td className="border border-slate-300 p-2 bg-slate-100 font-semibold">Position in Arm:</td>
                            <td className="border border-slate-300 p-2">{classPosition}<sup>{getOrdinalSuffix(classPosition)}</sup> out of {classSize}</td>
                        </tr>
                        <tr>
                            <td className="border border-slate-300 p-2 bg-slate-100 font-semibold">Total Score:</td>
                            <td className="border border-slate-300 p-2">{report.total_score}</td>
                            <td className="border border-slate-300 p-2 bg-slate-100 font-semibold">Average:</td>
                            <td className="border border-slate-300 p-2 font-bold text-indigo-700">{report.average_score?.toFixed(2)}%</td>
                        </tr>
                        {gradeLevelPosition && gradeLevelSize && (
                            <tr>
                                <td className="border border-slate-300 p-2 bg-slate-100 font-semibold">Position in Grade:</td>
                                <td className="border border-slate-300 p-2" colSpan={3}>{gradeLevelPosition}<sup>{getOrdinalSuffix(gradeLevelPosition)}</sup> out of {gradeLevelSize}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Banded Subject Table */}
            <div className="mb-6">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-white">
                            <th className="border border-slate-600 p-2 text-left">S/N</th>
                            <th className="border border-slate-600 p-2 text-left">Subject</th>
                            {assessmentComponents && assessmentComponents.length > 0 ? (
                                // Dynamic component columns
                                <>
                                    {assessmentComponents.map((comp, idx) => (
                                        <th key={idx} className="border border-slate-600 p-2 text-center">
                                            {comp.name}
                                            <br />
                                            <span className="text-xs font-normal">/{comp.max_score}</span>
                                        </th>
                                    ))}
                                </>
                            ) : (
                                // Fallback to CA/Exam columns
                                <>
                                    <th className="border border-slate-600 p-2 text-center">CA Score</th>
                                    <th className="border border-slate-600 p-2 text-center">Exam Score</th>
                                </>
                            )}
                            <th className="border border-slate-600 p-2 text-center">Total</th>
                            <th className="border border-slate-600 p-2 text-center">Grade</th>
                            <th className="border border-slate-600 p-2 text-center">Position</th>
                            <th className="border border-slate-600 p-2 text-left">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subjects.map((subject, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                                <td className="border border-slate-300 p-2 font-medium">{subject.subject_name}</td>
                                {assessmentComponents && assessmentComponents.length > 0 ? (
                                    // Render component scores dynamically
                                    <>
                                        {assessmentComponents.map((comp, compIdx) => (
                                            <td key={compIdx} className="border border-slate-300 p-2 text-center">
                                                {subject.component_scores?.[comp.name] ?? '-'}
                                            </td>
                                        ))}
                                    </>
                                ) : (
                                    // Fallback to CA/Exam
                                    <>
                                        <td className="border border-slate-300 p-2 text-center">{subject.ca_score}</td>
                                        <td className="border border-slate-300 p-2 text-center">{subject.exam_score}</td>
                                    </>
                                )}
                                <td className="border border-slate-300 p-2 text-center font-bold">{subject.total_score}</td>
                                <td className="border border-slate-300 p-2 text-center">
                                    <span className={`px-2 py-0.5 rounded font-bold ${
                                        subject.grade === 'A' ? 'bg-green-100 text-green-800' :
                                        subject.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                                        subject.grade === 'C' ? 'bg-amber-100 text-amber-800' :
                                        subject.grade === 'D' ? 'bg-orange-100 text-orange-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {subject.grade}
                                    </span>
                                </td>
                                <td className="border border-slate-300 p-2 text-center text-xs">{getOrdinal(subject.subject_position)}</td>
                                <td className="border border-slate-300 p-2 text-sm">{subject.remark}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Comments Section */}
            <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="border border-slate-300 p-3">
                    <p className="text-sm font-bold text-slate-700 mb-1">Class Teacher's Comment:</p>
                    <p className="text-sm text-slate-600 min-h-[40px] border-b border-dotted border-slate-300 pb-2">
                        {report.teacher_comment || '_'.repeat(80)}
                    </p>
                    <div className="flex justify-between mt-2">
                        <span className="text-xs text-slate-500">Signature: ___________________</span>
                        <span className="text-xs text-slate-500">Date: ___________________</span>
                    </div>
                </div>
                <div className="border border-slate-300 p-3">
                    <p className="text-sm font-bold text-slate-700 mb-1">Principal's Comment:</p>
                    <p className="text-sm text-slate-600 min-h-[40px] border-b border-dotted border-slate-300 pb-2">
                        {report.principal_comment || '_'.repeat(80)}
                    </p>
                    <div className="flex justify-between mt-2">
                        <span className="text-xs text-slate-500">Signature: ___________________</span>
                        <span className="text-xs text-slate-500">Date: ___________________</span>
                    </div>
                </div>
            </div>

            {/* Grading Key */}
            <div className="border border-slate-300 p-3">
                <p className="text-sm font-bold text-slate-700 mb-2">Grading Key:</p>
                <div className="flex flex-wrap gap-4 text-xs">
                    {gradingScheme.rules?.map((rule, idx) => (
                        <span key={idx}>
                            <strong>{rule.grade}</strong> ({rule.min_score}-{rule.max_score}%) = {rule.description}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Design 3: Dark Mode Executive Style
export const ExecutiveDarkResultSheet: React.FC<ResultSheetProps> = ({
    report, student, subjects, assessmentComponents, gradingScheme, schoolConfig, term, classPosition, classSize, gradeLevelPosition, gradeLevelSize
}) => {
    const getPerformanceLevel = (score: number) => {
        if (score >= 70) return { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
        if (score >= 60) return { label: 'Very Good', color: 'text-blue-400', bg: 'bg-blue-500/20' };
        if (score >= 50) return { label: 'Good', color: 'text-amber-400', bg: 'bg-amber-500/20' };
        if (score >= 40) return { label: 'Pass', color: 'text-orange-400', bg: 'bg-orange-500/20' };
        return { label: 'Below Average', color: 'text-red-400', bg: 'bg-red-500/20' };
    };

    const performanceLevel = getPerformanceLevel(report.average_score || 0);

    return (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl overflow-hidden max-w-4xl mx-auto shadow-2xl">
            {/* Sleek Header */}
            <div className="relative p-8 border-b border-slate-700/50">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10"></div>
                <div className="relative flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {schoolConfig?.logo_url && (
                            <img src={schoolConfig.logo_url} alt="Logo" className="w-14 h-14 rounded-lg border border-slate-700" />
                        )}
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                {schoolConfig?.school_name || 'School Name'}
                            </h1>
                            <p className="text-slate-400 text-sm">Academic Excellence Report</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-sm">{term.session_label}</p>
                        <p className="text-xl font-bold">{term.term_label}</p>
                    </div>
                </div>
            </div>

            {/* Student Profile Section */}
            <div className="p-8">
                <div className="flex flex-col md:flex-row gap-6 mb-8">
                    {/* Student Info */}
                    <div className="flex-1 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                                {student.name.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{student.name}</h2>
                                <p className="text-slate-400">{student.admission_number}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase">Class</p>
                                <p className="font-semibold">{student.grade} {student.arm}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase">Position</p>
                                <p className="font-semibold">{classPosition} of {classSize}</p>
                            </div>
                        </div>
                    </div>

                    {/* Performance Overview */}
                    <div className="flex-1 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                        <p className="text-xs text-slate-500 uppercase mb-2">Overall Performance</p>
                        <div className="flex items-end gap-4">
                            <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                {report.average_score?.toFixed(1)}%
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${performanceLevel.bg} ${performanceLevel.color}`}>
                                {performanceLevel.label}
                            </div>
                        </div>
                        <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                                style={{ width: `${report.average_score || 0}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Subject Performance */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded"></span>
                        Subject Breakdown
                    </h3>
                    <div className="space-y-3">
                        {subjects.map((subject, idx) => {
                            const perf = getPerformanceLevel(subject.total_score);
                            return (
                                <div key={idx} className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-bold text-slate-300">{idx + 1}.</span>
                                            <span className="font-semibold">{subject.subject_name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-sm text-slate-400">
                                                CA: <span className="text-white">{subject.ca_score}</span> | 
                                                Exam: <span className="text-white">{subject.exam_score}</span>
                                            </div>
                                            <div className={`w-12 h-12 rounded-lg ${perf.bg} flex items-center justify-center`}>
                                                <span className={`text-lg font-bold ${perf.color}`}>{subject.grade}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all ${
                                                subject.total_score >= 70 ? 'bg-emerald-500' :
                                                subject.total_score >= 60 ? 'bg-blue-500' :
                                                subject.total_score >= 50 ? 'bg-amber-500' :
                                                subject.total_score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${subject.total_score}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Comments */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-xl p-5 border border-blue-700/30">
                        <p className="text-xs text-blue-400 uppercase mb-2 font-semibold">Class Teacher's Remark</p>
                        <p className="text-slate-300 italic">"{report.teacher_comment || 'No comment provided.'}"</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-xl p-5 border border-purple-700/30">
                        <p className="text-xs text-purple-400 uppercase mb-2 font-semibold">Principal's Remark</p>
                        <p className="text-slate-300 italic">"{report.principal_comment || 'No comment provided.'}"</p>
                    </div>
                </div>

                {/* Grade Legend */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                    <p className="text-xs text-slate-500 uppercase mb-3 font-semibold">Grading Scale</p>
                    <div className="flex flex-wrap gap-2">
                        {gradingScheme.rules?.map((rule, idx) => (
                            <span key={idx} className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-700/50 border border-slate-600/50">
                                <span className="text-white">{rule.grade}</span>
                                <span className="text-slate-400 ml-1">({rule.min_score}-{rule.max_score}%)</span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-slate-700/50 text-center text-xs text-slate-500">
                Generated on {new Date().toLocaleDateString()} • SchoolGuardian360
            </div>
        </div>
    );
};

// Design 4: Minimalist Clean Design
export const MinimalistResultSheet: React.FC<ResultSheetProps> = ({
    report, student, subjects, assessmentComponents, gradingScheme, schoolConfig, term, classPosition, classSize, gradeLevelPosition, gradeLevelSize
}) => {
    return (
        <div className="bg-white max-w-3xl mx-auto p-12 font-sans">
            {/* Minimal Header */}
            <header className="mb-12 pb-8 border-b border-slate-200">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-light text-slate-900 tracking-tight">
                            {schoolConfig?.school_name || 'School Name'}
                        </h1>
                        <p className="text-slate-400 mt-1">Academic Report • {term.session_label}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-4xl font-light text-slate-900">{term.term_label}</p>
                    </div>
                </div>
            </header>

            {/* Student Details */}
            <section className="mb-12">
                <div className="flex justify-between items-end pb-6 border-b border-slate-100">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Student</p>
                        <h2 className="text-2xl font-medium text-slate-900">{student.name}</h2>
                        <p className="text-slate-500">{student.admission_number} • {student.grade} {student.arm}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-6xl font-light text-slate-900">{report.average_score?.toFixed(0)}<span className="text-2xl text-slate-400">%</span></p>
                        <p className="text-sm text-slate-400">Rank {classPosition} of {classSize}</p>
                    </div>
                </div>
            </section>

            {/* Subjects - Clean List */}
            <section className="mb-12">
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-6">Subject Performance</p>
                <div className="space-y-0">
                    {subjects.map((subject, idx) => (
                        <div key={idx} className="flex items-center justify-between py-4 border-b border-slate-100 group hover:bg-slate-50 -mx-4 px-4 transition-colors">
                            <div className="flex items-center gap-6">
                                <span className="text-sm text-slate-300 w-6">{String(idx + 1).padStart(2, '0')}</span>
                                <span className="font-medium text-slate-900">{subject.subject_name}</span>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-sm text-slate-400">
                                    {subject.ca_score} + {subject.exam_score}
                                </div>
                                <div className="w-20 text-right">
                                    <span className="text-lg font-medium text-slate-900">{subject.total_score}</span>
                                </div>
                                <div className="w-12 text-center">
                                    <span className={`inline-block w-8 h-8 leading-8 rounded-full text-sm font-bold ${
                                        subject.grade === 'A' ? 'bg-slate-900 text-white' :
                                        subject.grade === 'B' ? 'bg-slate-700 text-white' :
                                        subject.grade === 'C' ? 'bg-slate-400 text-white' :
                                        subject.grade === 'D' ? 'bg-slate-300 text-slate-700' :
                                        'bg-slate-200 text-slate-500'
                                    }`}>
                                        {subject.grade}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Comments - Minimal */}
            <section className="mb-12 space-y-6">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Class Teacher</p>
                    <p className="text-slate-700 leading-relaxed">{report.teacher_comment || '—'}</p>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Principal</p>
                    <p className="text-slate-700 leading-relaxed">{report.principal_comment || '—'}</p>
                </div>
            </section>

            {/* Footer */}
            <footer className="pt-8 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-400">{schoolConfig?.school_address}</p>
            </footer>
        </div>
    );
};

// Helper function
const getOrdinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
};

// Export all designs
export const ResultSheetDesigns = {
    modern: ModernGradientResultSheet,
    banded: BandedRowsResultSheet,
    executive: ExecutiveDarkResultSheet,
    minimalist: MinimalistResultSheet
};

export default ResultSheetDesigns;

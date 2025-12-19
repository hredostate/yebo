import React, { useState, useMemo } from 'react';
import { 
    CheckCircleIcon, 
    ClockIcon, 
    ExclamationCircleIcon, 
    CalendarIcon,
    UploadCloudIcon
} from './common/icons';
import type { LessonPlan, LessonPlanCoverage, LessonPlanAssignment } from '../types';

interface CoverageReportingPanelProps {
    lessonPlans: LessonPlan[];
    coverageData: LessonPlanCoverage[];
    onUpdateCoverage: (coverage: Partial<LessonPlanCoverage>) => Promise<void>;
    onUploadEvidence?: (planId: number, file: File) => Promise<void>;
}

const CoverageReportingPanel: React.FC<CoverageReportingPanelProps> = ({
    lessonPlans,
    coverageData,
    onUpdateCoverage,
    onUploadEvidence
}) => {
    const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
    const [editingCoverage, setEditingCoverage] = useState<number | null>(null);
    const [coverageForm, setCoverageForm] = useState<Partial<LessonPlanCoverage>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get approved lesson plans with their assignments
    const approvedPlans = useMemo(() => {
        return lessonPlans.filter(p => p.status === 'approved' || p.status === 'published');
    }, [lessonPlans]);

    const getCoverageForPlan = (planId: number, assignmentId: number) => {
        return coverageData.find(
            c => c.lesson_plan_id === planId && c.teaching_entity_id === assignmentId
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Fully Covered':
                return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
            case 'Partially Covered':
                return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
            case 'Not Covered':
                return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
            default:
                return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Fully Covered':
                return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
            case 'Partially Covered':
                return <ClockIcon className="w-5 h-5 text-yellow-600" />;
            case 'Not Covered':
                return <ExclamationCircleIcon className="w-5 h-5 text-red-600" />;
            default:
                return <ClockIcon className="w-5 h-5 text-slate-600" />;
        }
    };

    const handleEditCoverage = (planId: number, assignmentId: number) => {
        const existing = getCoverageForPlan(planId, assignmentId);
        if (existing) {
            setCoverageForm(existing);
            setEditingCoverage(existing.id);
        } else {
            setCoverageForm({
                lesson_plan_id: planId,
                teaching_entity_id: assignmentId,
                coverage_status: 'not_started',
                notes: '',
            });
            setEditingCoverage(-1); // New coverage
        }
        setExpandedPlan(planId);
    };

    const handleSubmitCoverage = async () => {
        if (!coverageForm.coverage_status) {
            alert('Please select a coverage status');
            return;
        }

        setIsSubmitting(true);
        try {
            await onUpdateCoverage({
                ...coverageForm,
                coverage_date: new Date().toISOString(),
            });
            setEditingCoverage(null);
            setCoverageForm({});
        } catch (error) {
            console.error('Error updating coverage:', error);
            alert('Failed to update coverage. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileUpload = async (planId: number, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !onUploadEvidence) return;

        try {
            await onUploadEvidence(planId, file);
            alert('Evidence uploaded successfully');
        } catch (error) {
            console.error('Error uploading evidence:', error);
            alert('Failed to upload evidence. Please try again.');
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
                    Coverage Reporting
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Report coverage after teaching each lesson plan. Track progress per class/arm.
                </p>

                {approvedPlans.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <p>No approved lesson plans to report coverage for</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {approvedPlans.map(plan => (
                            <div
                                key={plan.id}
                                className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                            >
                                {/* Plan Header */}
                                <div
                                    className="p-4 bg-slate-50 dark:bg-slate-750 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                                                {plan.title}
                                            </h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                {plan.subject} • Week of {new Date(plan.week_start_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="text-sm text-slate-600 dark:text-slate-400">
                                            {plan.assignments?.length || 0} class{(plan.assignments?.length || 0) !== 1 ? 'es' : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {expandedPlan === plan.id && (
                                    <div className="p-4 space-y-3">
                                        {plan.assignments && plan.assignments.length > 0 ? (
                                            plan.assignments.map(assignment => {
                                                const coverage = getCoverageForPlan(plan.id, assignment.teaching_entity_id);
                                                const isEditing = editingCoverage === coverage?.id || 
                                                    (editingCoverage === -1 && 
                                                     coverageForm.lesson_plan_id === plan.id && 
                                                     coverageForm.teaching_entity_id === assignment.teaching_entity_id);

                                                return (
                                                    <div
                                                        key={assignment.id}
                                                        className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                                                    >
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <h4 className="font-medium text-slate-800 dark:text-slate-100">
                                                                    {assignment.teaching_entity?.academic_class?.name} - {assignment.teaching_entity?.subject_name}
                                                                </h4>
                                                            </div>
                                                            {coverage && (
                                                                <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${getStatusColor(coverage.coverage_status)}`}>
                                                                    {getStatusIcon(coverage.coverage_status)}
                                                                    {coverage.coverage_status}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {!isEditing ? (
                                                            <div>
                                                                {coverage ? (
                                                                    <div className="space-y-2 text-sm">
                                                                        {coverage.coverage_date && (
                                                                            <p className="text-slate-600 dark:text-slate-400">
                                                                                <CalendarIcon className="w-4 h-4 inline mr-1" />
                                                                                Taught on: {new Date(coverage.coverage_date).toLocaleDateString()}
                                                                            </p>
                                                                        )}
                                                                        {coverage.notes && (
                                                                            <p className="text-slate-700 dark:text-slate-300">
                                                                                <strong>Notes:</strong> {coverage.notes}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                                                                        No coverage reported yet
                                                                    </p>
                                                                )}
                                                                <button
                                                                    onClick={() => handleEditCoverage(plan.id, assignment.teaching_entity_id)}
                                                                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                                                >
                                                                    {coverage ? 'Update Coverage' : 'Report Coverage'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {/* Coverage Status */}
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                                        Coverage Status
                                                                    </label>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {[
                                                                            { value: 'not_started', label: 'Not Started' },
                                                                            { value: 'Partially Covered', label: 'Partially Covered' },
                                                                            { value: 'Fully Covered', label: 'Fully Covered' },
                                                                            { value: 'Not Covered', label: 'Not Covered' }
                                                                        ].map(status => (
                                                                            <button
                                                                                key={status.value}
                                                                                onClick={() => setCoverageForm({ ...coverageForm, coverage_status: status.value as any })}
                                                                                className={`py-2 px-3 rounded text-sm font-medium transition ${
                                                                                    coverageForm.coverage_status === status.value
                                                                                        ? 'bg-blue-600 text-white'
                                                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                                                                }`}
                                                                            >
                                                                                {status.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Notes */}
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                                        Notes (adjustments made, challenges, etc.)
                                                                    </label>
                                                                    <textarea
                                                                        value={coverageForm.notes || ''}
                                                                        onChange={(e) => setCoverageForm({ ...coverageForm, notes: e.target.value })}
                                                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                                                        rows={3}
                                                                        placeholder="Any adjustments or observations..."
                                                                    />
                                                                </div>

                                                                {/* Evidence Upload */}
                                                                {onUploadEvidence && (
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                                            Upload Evidence (optional)
                                                                        </label>
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="file"
                                                                                accept="image/*,.pdf"
                                                                                onChange={(e) => handleFileUpload(plan.id, e)}
                                                                                className="hidden"
                                                                                id={`evidence-${plan.id}-${assignment.id}`}
                                                                            />
                                                                            <label
                                                                                htmlFor={`evidence-${plan.id}-${assignment.id}`}
                                                                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer"
                                                                            >
                                                                                <UploadCloudIcon className="w-5 h-5" />
                                                                                Choose File
                                                                            </label>
                                                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                                                Photos of board, student work, etc.
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Actions */}
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={handleSubmitCoverage}
                                                                        disabled={isSubmitting}
                                                                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                                                    >
                                                                        {isSubmitting ? 'Saving...' : 'Save Coverage'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingCoverage(null);
                                                                            setCoverageForm({});
                                                                        }}
                                                                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                                No class assignments for this plan
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CoverageReportingPanel;

import React, { useState, useEffect } from 'react';
import type { LessonPlanCoverage, AcademicClass } from '../types';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from './common/icons';

interface ArmCoverageTrackerProps {
    lessonPlanId: number;
    academicClassId: number;
    onUpdate?: () => void;
}

const ArmCoverageTracker: React.FC<ArmCoverageTrackerProps> = ({
    lessonPlanId,
    academicClassId,
    onUpdate
}) => {
    const [coverage, setCoverage] = useState<LessonPlanCoverage[]>([]);
    const [academicClass, setAcademicClass] = useState<AcademicClass | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadCoverageData();
    }, [lessonPlanId, academicClassId]);

    const loadCoverageData = async () => {
        setLoading(true);
        try {
            // Load academic class info
            const { data: classData, error: classError } = await supabase
                .from('academic_classes')
                .select('*')
                .eq('id', academicClassId)
                .single();

            if (classError) throw classError;
            setAcademicClass(classData);

            // Load existing coverage records
            const { data: coverageData, error: coverageError } = await supabase
                .from('lesson_plan_coverage')
                .select('*')
                .eq('lesson_plan_id', lessonPlanId)
                .eq('academic_class_id', academicClassId);

            if (coverageError) throw coverageError;
            setCoverage(coverageData || []);
        } catch (error) {
            console.error('Error loading coverage data:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateCoverageStatus = async (
        armId: number,
        status: 'Pending' | 'Fully Covered' | 'Partially Covered' | 'Not Covered',
        percentage: number
    ) => {
        setSaving(true);
        try {
            // Check if coverage record exists
            const existing = coverage.find(c => c.arm_id === armId);

            if (existing) {
                // Update existing
                const { error } = await supabase
                    .from('lesson_plan_coverage')
                    .update({
                        coverage_status: status,
                        coverage_percentage: percentage,
                        covered_date: status === 'Fully Covered' ? new Date().toISOString().split('T')[0] : null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Create new
                const { error } = await supabase
                    .from('lesson_plan_coverage')
                    .insert({
                        lesson_plan_id: lessonPlanId,
                        academic_class_id: academicClassId,
                        arm_id: armId,
                        coverage_status: status,
                        coverage_percentage: percentage,
                        covered_date: status === 'Fully Covered' ? new Date().toISOString().split('T')[0] : null
                    });

                if (error) throw error;
            }

            // Reload data
            await loadCoverageData();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error updating coverage status:', error);
        } finally {
            setSaving(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Fully Covered':
                return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            case 'Partially Covered':
                return <ClockIcon className="h-5 w-5 text-yellow-500" />;
            case 'Not Covered':
                return <XCircleIcon className="h-5 w-5 text-red-500" />;
            default:
                return <ClockIcon className="h-5 w-5 text-slate-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Fully Covered':
                return 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
            case 'Partially Covered':
                return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
            case 'Not Covered':
                return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
            default:
                return 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Spinner size="md" />
            </div>
        );
    }

    if (!academicClass) {
        return (
            <div className="text-sm text-slate-600 dark:text-slate-400 p-4">
                Academic class not found
            </div>
        );
    }

    // Parse arms from academic class (format: "JSS 1 Gold", "JSS 1 Silver", etc.)
    // For simplicity, we'll show a single arm entry for this class
    const armName = academicClass.arm || 'Main';
    const armCoverage = coverage.find(c => c.arm_id === academicClass.id) || {
        coverage_status: 'Pending',
        coverage_percentage: 0
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Coverage Tracking: {academicClass.name}
            </h3>

            <div className={`border rounded-lg p-4 ${getStatusColor(armCoverage.coverage_status as string)}`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {getStatusIcon(armCoverage.coverage_status as string)}
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                            {armName}
                        </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {armCoverage.coverage_percentage}%
                    </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => updateCoverageStatus(academicClass.id, 'Fully Covered', 100)}
                        disabled={saving}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
                    >
                        Fully Covered
                    </button>
                    <button
                        onClick={() => updateCoverageStatus(academicClass.id, 'Partially Covered', 50)}
                        disabled={saving}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50"
                    >
                        Partially Covered
                    </button>
                    <button
                        onClick={() => updateCoverageStatus(academicClass.id, 'Not Covered', 0)}
                        disabled={saving}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                    >
                        Not Covered
                    </button>
                    <button
                        onClick={() => updateCoverageStatus(academicClass.id, 'Pending', 0)}
                        disabled={saving}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-slate-500 hover:bg-slate-600 text-white disabled:opacity-50"
                    >
                        Reset
                    </button>
                </div>

                {saving && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <Spinner size="xs" />
                        Updating...
                    </div>
                )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
                Track which arms have covered this lesson plan. This helps identify coverage gaps.
            </div>
        </div>
    );
};

export default ArmCoverageTracker;

import React, { useState, useEffect } from 'react';
import { CloseIcon, CheckCircleIcon, XCircleIcon, ClockIcon, StarIcon } from './common/icons';
import type { LessonPlan, LessonPlanReviewEvidence, LessonPlanAssignment } from '../types';

interface LessonPlanReviewModalProps {
    plan: LessonPlan;
    assignments: LessonPlanAssignment[];
    onClose: () => void;
    onSubmitReview: (review: Partial<LessonPlanReviewEvidence>) => Promise<void>;
    reviewerId: string;
}

const MINIMUM_REVIEW_TIME = 60; // seconds
const MINIMUM_FEEDBACK_LENGTH = 50; // characters

const LessonPlanReviewModal: React.FC<LessonPlanReviewModalProps> = ({
    plan,
    assignments,
    onClose,
    onSubmitReview,
    reviewerId
}) => {
    const [timeSpent, setTimeSpent] = useState(0);
    const [openedAt] = useState(new Date().toISOString());
    const [canApprove, setCanApprove] = useState(false);
    
    const [checklist, setChecklist] = useState({
        objectives_clear: false,
        activities_aligned: false,
        assessment_appropriate: false,
        materials_listed: false,
        time_realistic: false,
    });
    
    const [qualityRating, setQualityRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
    const [feedback, setFeedback] = useState('');
    const [decision, setDecision] = useState<'approved' | 'revision_required' | 'rejected' | null>(null);
    const [revisionNotes, setRevisionNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Timer effect
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeSpent((prev) => {
                const newTime = prev + 1;
                if (newTime >= MINIMUM_REVIEW_TIME && allChecklistChecked() && feedback.length >= MINIMUM_FEEDBACK_LENGTH && qualityRating) {
                    setCanApprove(true);
                }
                return newTime;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [checklist, feedback, qualityRating]);

    const allChecklistChecked = () => {
        return Object.values(checklist).every(v => v === true);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleChecklistChange = (key: keyof typeof checklist) => {
        setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmit = async () => {
        if (!decision || !qualityRating) {
            alert('Please select a decision and quality rating');
            return;
        }

        if (feedback.length < MINIMUM_FEEDBACK_LENGTH) {
            alert(`Feedback must be at least ${MINIMUM_FEEDBACK_LENGTH} characters`);
            return;
        }

        if (!allChecklistChecked()) {
            alert('Please complete all checklist items');
            return;
        }

        if (timeSpent < MINIMUM_REVIEW_TIME) {
            alert(`Please spend at least ${MINIMUM_REVIEW_TIME} seconds reviewing the plan`);
            return;
        }

        if ((decision === 'revision_required' || decision === 'rejected') && !revisionNotes) {
            alert('Please provide revision notes');
            return;
        }

        setIsSubmitting(true);
        try {
            const review: Partial<LessonPlanReviewEvidence> = {
                lesson_plan_id: plan.id,
                reviewer_id: reviewerId,
                time_spent_seconds: timeSpent,
                checklist_responses: checklist,
                quality_rating: qualityRating,
                feedback,
                decision,
                revision_notes: revisionNotes || undefined,
                opened_at: openedAt,
                decided_at: new Date().toISOString(),
            };

            await onSubmitReview(review);
            onClose();
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Failed to submit review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full my-8">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            Review Lesson Plan
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {plan.title}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded">
                            <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <span className="font-mono text-lg text-blue-600 dark:text-blue-400">
                                {formatTime(timeSpent)}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {/* Assigned Classes */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Classes/Arms this plan applies to:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {assignments.map((assignment) => (
                                <span
                                    key={assignment.id}
                                    className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-3 py-1 rounded-full text-sm"
                                >
                                    {assignment.teaching_entity?.academic_class?.name} - {assignment.teaching_entity?.subject_name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Plan Content Preview */}
                    <div className="mb-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Plan Overview
                        </h3>
                        {plan.objectives && (
                            <div className="mb-3">
                                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">Objectives:</h4>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{plan.objectives}</p>
                            </div>
                        )}
                        {plan.activities && (
                            <div className="mb-3">
                                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">Activities:</h4>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{plan.activities}</p>
                            </div>
                        )}
                        {plan.materials && (
                            <div className="mb-3">
                                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">Materials:</h4>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{plan.materials}</p>
                            </div>
                        )}
                    </div>

                    {/* Review Checklist */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">
                            Review Checklist <span className="text-red-500">*</span>
                        </h3>
                        <div className="space-y-2">
                            {[
                                { key: 'objectives_clear', label: 'Learning objectives are clear and measurable' },
                                { key: 'activities_aligned', label: 'Activities align with objectives' },
                                { key: 'assessment_appropriate', label: 'Assessment methods are appropriate' },
                                { key: 'materials_listed', label: 'Materials/resources are listed' },
                                { key: 'time_realistic', label: 'Time allocation is realistic' },
                            ].map((item) => (
                                <label
                                    key={item.key}
                                    className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checklist[item.key as keyof typeof checklist]}
                                        onChange={() => handleChecklistChange(item.key as keyof typeof checklist)}
                                        className="w-5 h-5 text-blue-600 rounded"
                                    />
                                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Quality Rating */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">
                            Quality Rating <span className="text-red-500">*</span>
                        </h3>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => setQualityRating(rating as 1 | 2 | 3 | 4 | 5)}
                                    className={`p-2 rounded transition ${
                                        qualityRating && qualityRating >= rating
                                            ? 'text-yellow-500'
                                            : 'text-slate-300 dark:text-slate-600'
                                    } hover:scale-110`}
                                >
                                    <StarIcon className="w-8 h-8 fill-current" />
                                </button>
                            ))}
                        </div>
                        {qualityRating && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                {qualityRating === 5 && 'Excellent - Exemplary work'}
                                {qualityRating === 4 && 'Very Good - Exceeds expectations'}
                                {qualityRating === 3 && 'Good - Meets expectations'}
                                {qualityRating === 2 && 'Fair - Needs improvement'}
                                {qualityRating === 1 && 'Poor - Significant revision needed'}
                            </p>
                        )}
                    </div>

                    {/* Feedback */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Feedback <span className="text-red-500">*</span>
                            <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                                (Minimum {MINIMUM_FEEDBACK_LENGTH} characters - {feedback.length}/{MINIMUM_FEEDBACK_LENGTH})
                            </span>
                        </h3>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                            rows={6}
                            placeholder="Provide detailed feedback on the lesson plan..."
                        />
                    </div>

                    {/* Decision */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">
                            Decision <span className="text-red-500">*</span>
                        </h3>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDecision('approved')}
                                disabled={!canApprove}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                                    decision === 'approved'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                } ${
                                    !canApprove
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-green-700 hover:text-white'
                                }`}
                            >
                                <CheckCircleIcon className="w-5 h-5 inline mr-2" />
                                Approve
                            </button>
                            <button
                                onClick={() => setDecision('revision_required')}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                                    decision === 'revision_required'
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-yellow-700 hover:text-white'
                                }`}
                            >
                                Revision Required
                            </button>
                            <button
                                onClick={() => setDecision('rejected')}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                                    decision === 'rejected'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-red-700 hover:text-white'
                                }`}
                            >
                                <XCircleIcon className="w-5 h-5 inline mr-2" />
                                Reject
                            </button>
                        </div>
                    </div>

                    {/* Revision Notes (shown if revision required or rejected) */}
                    {(decision === 'revision_required' || decision === 'rejected') && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Revision Notes <span className="text-red-500">*</span>
                            </h3>
                            <textarea
                                value={revisionNotes}
                                onChange={(e) => setRevisionNotes(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-yellow-500"
                                rows={4}
                                placeholder="Specify what needs to be revised..."
                            />
                        </div>
                    )}

                    {/* Warning message */}
                    {timeSpent < MINIMUM_REVIEW_TIME && (
                        <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                                ⏱️ Please spend at least {MINIMUM_REVIEW_TIME} seconds reviewing this plan before making a decision.
                                Time remaining: {MINIMUM_REVIEW_TIME - timeSpent} seconds
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !decision || !canApprove}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LessonPlanReviewModal;

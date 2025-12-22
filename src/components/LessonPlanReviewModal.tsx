import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CloseIcon, CheckCircleIcon, XCircleIcon, ClockIcon, StarIcon } from './common/icons';
import type { LessonPlan, LessonPlanReviewEvidence, LessonPlanAssignment } from '../types';
import { useReviewCooldown } from '../hooks/useReviewCooldown';

interface LessonPlanReviewModalProps {
    plan: LessonPlan;
    assignments: LessonPlanAssignment[];
    onClose: () => void;
    onSubmitReview: (review: Partial<LessonPlanReviewEvidence>) => Promise<void>;
    reviewerId: string;
}

const MINIMUM_REVIEW_TIME = 60; // seconds
const MINIMUM_FEEDBACK_LENGTH = 50; // characters

// Simple Jaccard similarity
const calculateSimilarity = (str1: string, str2: string): number => {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
};

const LessonPlanReviewModal: React.FC<LessonPlanReviewModalProps> = ({
    plan,
    assignments,
    onClose,
    onSubmitReview,
    reviewerId
}) => {
    const [timeSpent, setTimeSpent] = useState(0);
    const [activeTimeSpent, setActiveTimeSpent] = useState(0);
    const [openedAt] = useState(new Date().toISOString());
    const [canApprove, setCanApprove] = useState(false);
    
    // Visibility/Focus tracking
    const [isPaused, setIsPaused] = useState(false);
    const [pauseCount, setPauseCount] = useState(0);
    
    // Scroll tracking
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [scrollPercentage, setScrollPercentage] = useState(0);
    
    // Cooldown system
    const { cooldownRemaining, startCooldown, isInCooldown } = useReviewCooldown();
    
    // Checklist randomization
    const [randomizedChecklist] = useState(() => {
        const items = [
            { key: 'objectives_clear', label: 'Learning objectives are clear and measurable' },
            { key: 'activities_aligned', label: 'Activities align with objectives' },
            { key: 'assessment_appropriate', label: 'Assessment methods are appropriate' },
            { key: 'materials_listed', label: 'Materials/resources are listed' },
            { key: 'time_realistic', label: 'Time allocation is realistic' },
        ];
        return items.sort(() => Math.random() - 0.5);
    });
    
    const [checklist, setChecklist] = useState({
        objectives_clear: false,
        activities_aligned: false,
        assessment_appropriate: false,
        materials_listed: false,
        time_realistic: false,
    });
    const [checklistCompletionOrder, setChecklistCompletionOrder] = useState<string[]>([]);
    
    const [qualityRating, setQualityRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
    const [feedback, setFeedback] = useState('');
    const [feedbackWarning, setFeedbackWarning] = useState<string | null>(null);
    const [decision, setDecision] = useState<'approved' | 'revision_required' | 'rejected' | null>(null);
    const [revisionNotes, setRevisionNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Visibility change tracking
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsPaused(true);
                setPauseCount(prev => prev + 1);
            } else {
                setIsPaused(false);
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Timer effect - pauses when tab not visible
    useEffect(() => {
        if (isPaused) return;
        
        const interval = setInterval(() => {
            setTimeSpent(prev => prev + 1);
            setActiveTimeSpent(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [isPaused]);
    
    // Update canApprove based on all requirements
    useEffect(() => {
        const meetsRequirements = 
            timeSpent >= MINIMUM_REVIEW_TIME && 
            allChecklistChecked() && 
            feedback.length >= MINIMUM_FEEDBACK_LENGTH && 
            qualityRating !== null &&
            hasScrolledToBottom;
        setCanApprove(meetsRequirements);
    }, [timeSpent, checklist, feedback, qualityRating, hasScrolledToBottom]);

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
        // Track completion order
        if (!checklist[key]) {
            setChecklistCompletionOrder(prev => [...prev, key]);
        }
    };
    
    const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const percentage = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
        setScrollPercentage(Math.min(percentage, 100));
        
        if (scrollTop + clientHeight >= scrollHeight - 20) {
            setHasScrolledToBottom(true);
        }
    };
    
    const checkFeedbackSimilarity = (newFeedback: string) => {
        const recentFeedbacks = JSON.parse(localStorage.getItem('recentReviewFeedbacks') || '[]') as string[];
        
        const normalizedNew = newFeedback.toLowerCase().trim();
        
        for (const oldFeedback of recentFeedbacks) {
            const similarity = calculateSimilarity(normalizedNew, oldFeedback.toLowerCase());
            if (similarity > 0.8) {
                setFeedbackWarning('This feedback is very similar to a recent review. Please provide unique feedback.');
                return false;
            }
        }
        
        setFeedbackWarning(null);
        return true;
    };
    
    const handleFeedbackChange = (value: string) => {
        setFeedback(value);
        if (value.length >= MINIMUM_FEEDBACK_LENGTH) {
            checkFeedbackSimilarity(value);
        }
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
        
        if (!hasScrolledToBottom) {
            alert('Please scroll through the entire lesson plan before submitting');
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
                active_review_time_seconds: activeTimeSpent,
                checklist_responses: checklist,
                quality_rating: qualityRating,
                feedback,
                decision,
                revision_notes: revisionNotes || undefined,
                opened_at: openedAt,
                decided_at: new Date().toISOString(),
                pause_count: pauseCount,
                scroll_depth_reached: scrollPercentage,
                feedback_similarity_warning: feedbackWarning !== null,
                checklist_completion_order: checklistCompletionOrder,
            };

            await onSubmitReview(review);
            
            // Store feedback for similarity checking
            const recentFeedbacks = JSON.parse(localStorage.getItem('recentReviewFeedbacks') || '[]') as string[];
            recentFeedbacks.unshift(feedback.toLowerCase().trim());
            if (recentFeedbacks.length > 10) {
                recentFeedbacks.pop();
            }
            localStorage.setItem('recentReviewFeedbacks', JSON.stringify(recentFeedbacks));
            
            // Start cooldown
            startCooldown();
            
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
                {/* Cooldown Overlay */}
                {isInCooldown && (
                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-50 rounded-lg">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg text-center max-w-md">
                            <ClockIcon className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                                Review Cooldown Active
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-4">
                                Please wait {cooldownRemaining} seconds before reviewing another plan.
                                This ensures thorough and thoughtful reviews.
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
                
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
                        <div className={`flex items-center gap-2 px-3 py-2 rounded ${
                            isPaused 
                                ? 'bg-yellow-50 dark:bg-yellow-900/20' 
                                : 'bg-blue-50 dark:bg-blue-900/20'
                        }`}>
                            <ClockIcon className={`w-5 h-5 ${
                                isPaused 
                                    ? 'text-yellow-600 dark:text-yellow-400' 
                                    : 'text-blue-600 dark:text-blue-400'
                            }`} />
                            <span className={`font-mono text-lg ${
                                isPaused 
                                    ? 'text-yellow-600 dark:text-yellow-400' 
                                    : 'text-blue-600 dark:text-blue-400'
                            }`}>
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
                
                {/* Pause indicator */}
                {isPaused && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 p-3">
                        <p className="text-yellow-800 dark:text-yellow-200 text-sm text-center">
                            ⏸️ Timer paused - return to this tab to continue
                        </p>
                    </div>
                )}
                
                {/* Progress Indicator */}
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex flex-wrap gap-3 items-center justify-center text-sm">
                        <div className={`flex items-center gap-1 ${timeSpent >= MINIMUM_REVIEW_TIME ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {timeSpent >= MINIMUM_REVIEW_TIME ? '✓' : '○'} Timer ({timeSpent}/{MINIMUM_REVIEW_TIME}s)
                        </div>
                        <div className={`flex items-center gap-1 ${hasScrolledToBottom ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {hasScrolledToBottom ? '✓' : '○'} Scroll ({scrollPercentage}%)
                        </div>
                        <div className={`flex items-center gap-1 ${allChecklistChecked() ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {allChecklistChecked() ? '✓' : '○'} Checklist
                        </div>
                        <div className={`flex items-center gap-1 ${qualityRating ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {qualityRating ? '✓' : '○'} Rating
                        </div>
                        <div className={`flex items-center gap-1 ${feedback.length >= MINIMUM_FEEDBACK_LENGTH ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {feedback.length >= MINIMUM_FEEDBACK_LENGTH ? '✓' : '○'} Feedback
                        </div>
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

                    {/* Plan Content Preview - Scrollable */}
                    <div className="mb-6 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                                Plan Overview <span className="text-red-500">*</span>
                            </h3>
                            {!hasScrolledToBottom && (
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    📜 Please scroll through the entire plan
                                </p>
                            )}
                        </div>
                        <div 
                            className="max-h-64 overflow-y-auto p-4"
                            onScroll={handleContentScroll}
                        >
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
                            {plan.assessment_methods && (
                                <div className="mb-3">
                                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">Assessment Methods:</h4>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">{plan.assessment_methods}</p>
                                </div>
                            )}
                            {plan.sessions && plan.sessions.length > 0 && (
                                <div className="mb-3">
                                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">Sessions:</h4>
                                    {plan.sessions.map((session: any, idx: number) => (
                                        <div key={idx} className="mb-2 pl-3 border-l-2 border-slate-300 dark:border-slate-600">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Session {idx + 1}</p>
                                            {session.content && <p className="text-xs text-slate-600 dark:text-slate-400">{session.content}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Spacer to ensure scrollable */}
                            <div className="h-20"></div>
                        </div>
                    </div>

                    {/* Review Checklist - Randomized */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">
                            Review Checklist <span className="text-red-500">*</span>
                        </h3>
                        <div className="space-y-2">
                            {randomizedChecklist.map((item) => (
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
                            <span className={`text-sm font-normal ml-2 ${
                                feedback.length < MINIMUM_FEEDBACK_LENGTH 
                                    ? 'text-red-500 dark:text-red-400'
                                    : 'text-green-600 dark:text-green-400'
                            }`}>
                                ({feedback.length}/{MINIMUM_FEEDBACK_LENGTH} characters)
                            </span>
                        </h3>
                        <textarea
                            value={feedback}
                            onChange={(e) => handleFeedbackChange(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                            rows={6}
                            placeholder="Provide detailed feedback on the lesson plan..."
                        />
                        {feedbackWarning && (
                            <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                                    ⚠️ {feedbackWarning}
                                </p>
                            </div>
                        )}
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

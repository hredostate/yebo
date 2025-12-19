import React, { useState, useMemo } from 'react';
import { 
    ClockIcon, 
    CheckCircleIcon, 
    ExclamationTriangleIcon, 
    ChartBarIcon,
    StarIcon,
    UserIcon,
    CalendarIcon,
    FilterIcon
} from './common/icons';
import type { 
    LessonPlan, 
    UserProfile, 
    AcademicTeachingAssignment,
    LessonPlanReviewEvidence,
    LessonPlanCoverage
} from '../types';
import LessonPlanReviewModal from './LessonPlanReviewModal';

interface TeamLessonPlanHubProps {
    lessonPlans: LessonPlan[];
    teachingAssignments: AcademicTeachingAssignment[];
    teamMembers: UserProfile[];
    currentUser: UserProfile;
    onSubmitReview: (planId: number, review: Partial<LessonPlanReviewEvidence>) => Promise<void>;
    reviewEvidence: LessonPlanReviewEvidence[];
    coverageData: LessonPlanCoverage[];
}

const TeamLessonPlanHub: React.FC<TeamLessonPlanHubProps> = ({
    lessonPlans,
    teachingAssignments,
    teamMembers,
    currentUser,
    onSubmitReview,
    reviewEvidence,
    coverageData
}) => {
    const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [reviewingPlan, setReviewingPlan] = useState<LessonPlan | null>(null);

    // Get unique values for filters
    const teachers = useMemo(() => {
        const teacherSet = new Set(teachingAssignments.map(a => a.teacher_user_id));
        return teamMembers.filter(m => teacherSet.has(m.id));
    }, [teachingAssignments, teamMembers]);

    const subjects = useMemo(() => {
        const subjectSet = new Set(lessonPlans.map(p => p.subject).filter(Boolean));
        return Array.from(subjectSet).sort();
    }, [lessonPlans]);

    const weeks = useMemo(() => {
        const weekSet = new Set(lessonPlans.map(p => p.week_start_date).filter(Boolean));
        return Array.from(weekSet).sort().reverse();
    }, [lessonPlans]);

    // Filter lesson plans
    const filteredPlans = useMemo(() => {
        return lessonPlans.filter(plan => {
            if (selectedTeacher && plan.author_id !== selectedTeacher) return false;
            if (selectedSubject && plan.subject !== selectedSubject) return false;
            if (selectedWeek && plan.week_start_date !== selectedWeek) return false;
            if (selectedStatus && plan.status !== selectedStatus) return false;
            return true;
        });
    }, [lessonPlans, selectedTeacher, selectedSubject, selectedWeek, selectedStatus]);

    // Categorize plans
    const pendingReview = filteredPlans.filter(p => p.status === 'submitted' || p.status === 'under_review');
    const reviewedThisWeek = useMemo(() => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return reviewEvidence.filter(r => new Date(r.created_at) >= weekAgo);
    }, [reviewEvidence]);

    const missingPlans = useMemo(() => {
        const currentWeekStart = new Date();
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);
        const weekStr = currentWeekStart.toISOString().split('T')[0];
        
        const teachersWithPlans = new Set(
            filteredPlans.filter(p => p.week_start_date === weekStr).map(p => p.author_id)
        );
        
        return teachers.filter(t => !teachersWithPlans.has(t.id));
    }, [teachers, filteredPlans]);

    // Calculate stats
    const stats = useMemo(() => {
        const plansThisWeek = filteredPlans.filter(p => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(p.created_at) >= weekAgo;
        });

        const avgReviewTime = reviewedThisWeek.length > 0
            ? Math.floor(reviewedThisWeek.reduce((sum, r) => sum + r.time_spent_seconds, 0) / reviewedThisWeek.length)
            : 0;

        const coverageRate = coverageData.length > 0
            ? (coverageData.filter(c => c.coverage_status === 'Fully Covered').length / coverageData.length) * 100
            : 0;

        const avgQuality = reviewedThisWeek.length > 0
            ? reviewedThisWeek.reduce((sum, r) => sum + r.quality_rating, 0) / reviewedThisWeek.length
            : 0;

        return {
            plansSubmitted: plansThisWeek.length,
            avgReviewTime: Math.floor(avgReviewTime / 60), // Convert to minutes
            coverageRate: Math.round(coverageRate),
            avgQuality: avgQuality.toFixed(1)
        };
    }, [filteredPlans, reviewedThisWeek, coverageData]);

    const handleReview = (plan: LessonPlan) => {
        setReviewingPlan(plan);
    };

    const handleSubmitReview = async (review: Partial<LessonPlanReviewEvidence>) => {
        if (!reviewingPlan) return;
        await onSubmitReview(reviewingPlan.id, review);
        setReviewingPlan(null);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                    Team Lesson Plan Hub
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                    Consolidated view of lesson plans across your team
                </p>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Plans This Week</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.plansSubmitted}</p>
                        </div>
                        <CalendarIcon className="w-8 h-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Avg Review Time</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.avgReviewTime}m</p>
                        </div>
                        <ClockIcon className="w-8 h-8 text-purple-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Coverage Rate</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.coverageRate}%</p>
                        </div>
                        <ChartBarIcon className="w-8 h-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Avg Quality</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.avgQuality}</p>
                        </div>
                        <StarIcon className="w-8 h-8 text-yellow-500 fill-current" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                <div className="flex items-center gap-2 mb-3">
                    <FilterIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h2 className="font-semibold text-slate-700 dark:text-slate-300">Filters</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select
                        value={selectedTeacher || ''}
                        onChange={(e) => setSelectedTeacher(e.target.value || null)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                        <option value="">All Teachers</option>
                        {teachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedSubject || ''}
                        onChange={(e) => setSelectedSubject(e.target.value || null)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                        <option value="">All Subjects</option>
                        {subjects.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <select
                        value={selectedWeek || ''}
                        onChange={(e) => setSelectedWeek(e.target.value || null)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                        <option value="">All Weeks</option>
                        {weeks.map(w => (
                            <option key={w} value={w}>{formatDate(w)}</option>
                        ))}
                    </select>

                    <select
                        value={selectedStatus || ''}
                        onChange={(e) => setSelectedStatus(e.target.value || null)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="under_review">Under Review</option>
                        <option value="approved">Approved</option>
                        <option value="revision_required">Revision Required</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Pending Review Section */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <ClockIcon className="w-6 h-6 text-yellow-500" />
                    Pending Review ({pendingReview.length})
                </h2>
                {pendingReview.length === 0 ? (
                    <p className="text-slate-600 dark:text-slate-400">No plans pending review</p>
                ) : (
                    <div className="space-y-3">
                        {pendingReview.map(plan => (
                            <div
                                key={plan.id}
                                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-750"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                                            {plan.title}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <UserIcon className="w-4 h-4" />
                                                {plan.author?.name}
                                            </span>
                                            <span>{plan.subject}</span>
                                            <span>{formatDate(plan.week_start_date)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleReview(plan)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Review →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Reviewed This Week Section */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <CheckCircleIcon className="w-6 h-6 text-green-500" />
                    Reviewed This Week ({reviewedThisWeek.length})
                </h2>
                {reviewedThisWeek.length === 0 ? (
                    <p className="text-slate-600 dark:text-slate-400">No reviews this week</p>
                ) : (
                    <div className="space-y-3">
                        {reviewedThisWeek.map(review => {
                            const plan = lessonPlans.find(p => p.id === review.lesson_plan_id);
                            if (!plan) return null;
                            return (
                                <div
                                    key={review.id}
                                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                                                {plan.title}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <StarIcon
                                                            key={i}
                                                            className={`w-4 h-4 ${
                                                                i < review.quality_rating
                                                                    ? 'text-yellow-500 fill-current'
                                                                    : 'text-slate-300 dark:text-slate-600'
                                                            }`}
                                                        />
                                                    ))}
                                                </span>
                                                <span>{Math.floor(review.time_spent_seconds / 60)}m review</span>
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    review.decision === 'approved' 
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                        : review.decision === 'revision_required'
                                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                }`}>
                                                    {review.decision.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Missing Plans Section */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                    Missing Plans ({missingPlans.length})
                </h2>
                {missingPlans.length === 0 ? (
                    <p className="text-slate-600 dark:text-slate-400">All teachers have submitted plans</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {missingPlans.map(teacher => (
                            <div
                                key={teacher.id}
                                className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-3"
                            >
                                <p className="font-medium text-slate-800 dark:text-slate-100">
                                    {teacher.name}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    No plan submitted this week
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {reviewingPlan && (
                <LessonPlanReviewModal
                    plan={reviewingPlan}
                    assignments={reviewingPlan.assignments || []}
                    onClose={() => setReviewingPlan(null)}
                    onSubmitReview={handleSubmitReview}
                    reviewerId={currentUser.id}
                />
            )}
        </div>
    );
};

export default TeamLessonPlanHub;

import React, { useMemo } from 'react';
import type { LessonPlan, CoverageVote, UserProfile, Team, LessonPlanCoverage } from '../types';
import { UsersIcon } from './common/icons';
import { getDerivedCoverageStatus } from '../utils/coverageHelpers';

interface CoverageFeedbackReportProps {
  lessonPlans: LessonPlan[];
  coverageVotes: CoverageVote[];
  users: UserProfile[];
  teams: Team[];
  currentUser: UserProfile;
  coverageData: LessonPlanCoverage[];
}

const CoverageFeedbackReport: React.FC<CoverageFeedbackReportProps> = ({ lessonPlans, coverageVotes, users, teams, currentUser, coverageData }) => {
    
    const relevantPlans = useMemo(() => {
        const isAdmin = ['Admin', 'Principal'].includes(currentUser.role);
        if (isAdmin) {
            return lessonPlans;
        }

        const myTeam = teams.find(t => t.lead_id === currentUser.id);
        if (myTeam) {
            const memberIds = new Set(myTeam.members.map(m => m.user_id));
            memberIds.add(currentUser.id);
            return lessonPlans.filter(plan => memberIds.has(plan.author_id));
        }

        // Default for non-leads (though they shouldn't see this view)
        return lessonPlans.filter(plan => plan.author_id === currentUser.id);
    }, [lessonPlans, teams, currentUser]);

    const reportData = useMemo(() => {
        return relevantPlans.map(plan => {
            const votes = coverageVotes.filter(v => v.lesson_plan_id === plan.id);
            const concurs = votes.filter(v => v.vote === true).length;
            const disagrees = votes.filter(v => v.vote === false).length;
            return {
                plan,
                concurs,
                disagrees,
                totalVotes: votes.length
            };
        }).sort((a,b) => new Date(b.plan.week_start_date!).getTime() - new Date(a.plan.week_start_date!).getTime());
    }, [relevantPlans, coverageVotes]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
                    <UsersIcon className="w-8 h-8 mr-3 text-cyan-600"/>
                    Coverage Feedback Report
                </h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Review student confirmation of curriculum coverage status.</p>
            </div>
            
            <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-500/10">
                            <tr>
                                <th scope="col" className="px-6 py-3">Lesson / Teacher</th>
                                <th scope="col" className="px-6 py-3">Week Of</th>
                                <th scope="col" className="px-6 py-3">Teacher's Status</th>
                                <th scope="col" className="px-6 py-3 text-center">Student Feedback</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map(({ plan, concurs, disagrees, totalVotes }) => (
                                <tr key={plan.id} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-500/10">
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-slate-900 dark:text-white">{plan.title || 'Untitled Plan'}</p>
                                        <p className="text-xs text-slate-500">{plan.author?.name}</p>
                                    </td>
                                    <td className="px-6 py-4">{new Date(plan.week_start_date + 'T00:00:00').toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-700">
                                            {getDerivedCoverageStatus(plan.id, coverageData)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {totalVotes > 0 ? (
                                            <div className="flex items-center justify-center gap-4">
                                                <span className="font-semibold text-green-600">Concur: {concurs}</span>
                                                <span className="font-semibold text-red-600">Disagree: {disagrees}</span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-center text-slate-400">No student feedback yet.</p>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {reportData.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            No lesson plans with coverage status found for your team.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoverageFeedbackReport;

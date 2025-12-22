import React, { useState, useMemo } from 'react';
import type { 
    UserProfile, 
    Team, 
    Task, 
    ReportRecord, 
    TeamPulse, 
    TeamFeedback,
    LessonPlan,
    AcademicTeachingAssignment,
    LessonPlanReviewEvidence,
    LessonPlanCoverage,
    CoverageVote
} from '../types';
import { TaskStatus } from '../types';
import Spinner from './common/Spinner';
import SearchInput from './common/SearchInput';
import { 
    ClipboardListIcon, 
    FileTextIcon, 
    UsersIcon, 
    ChartBarIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    StarIcon,
    UserIcon,
    PlusCircleIcon,
    EditIcon,
    TrashIcon
} from './common/icons';
import LessonPlanReviewModal from './LessonPlanReviewModal';
import { getDerivedCoverageStatus } from '../utils/coverageHelpers';

interface TeamHubProps {
    // User & Permissions
    users: UserProfile[];
    currentUser: UserProfile;
    userPermissions: string[];
    
    // Team Data
    teams: Team[];
    teamPulse: TeamPulse[];
    teamFeedback: TeamFeedback[];
    tasks: Task[];
    reports: ReportRecord[];
    
    // Lesson Plan Data
    lessonPlans: LessonPlan[];
    teachingAssignments: AcademicTeachingAssignment[];
    reviewEvidence: LessonPlanReviewEvidence[];
    coverageData: LessonPlanCoverage[];
    coverageVotes: CoverageVote[];
    
    // Actions
    onCreateTeam: (teamData: Omit<Team, 'id' | 'members'>) => Promise<Team | null>;
    onUpdateTeam: (teamId: number, teamData: Partial<Team>) => Promise<boolean>;
    onDeleteTeam: (teamId: number) => Promise<boolean>;
    onUpdateTeamMembers: (teamId: number, memberIds: string[]) => Promise<void>;
    onSaveTeamFeedback: (teamId: number, rating: number, comments: string | null) => Promise<boolean>;
    onSubmitReview: (planId: number, review: Partial<LessonPlanReviewEvidence>) => Promise<void>;
}

type TabType = 'overview' | 'teams' | 'lessonPlans' | 'coverage' | 'pulse' | 'members';

// Helper: Get Monday of the current week
const getWeekStartDate = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

// Team Modal Component
interface TeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (teamData: Partial<Omit<Team, 'members'>>) => Promise<void>;
    users: UserProfile[];
    existingTeam?: Team | null;
}

const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, onSave, users, existingTeam }) => {
    const [teamName, setTeamName] = useState(existingTeam?.team_name || '');
    const [leadId, setLeadId] = useState<string | null>(existingTeam?.lead_id || null);
    const [isSaving, setIsSaving] = useState(false);
    
    React.useEffect(() => {
        if(existingTeam) {
            setTeamName(existingTeam.team_name);
            setLeadId(existingTeam.lead_id);
        } else {
            setTeamName('');
            setLeadId(null);
        }
    }, [existingTeam, isOpen]);

    const possibleLeads = users.filter(u => ['Admin', 'Principal', 'Team Lead'].includes(u.role));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamName.trim()) return;
        setIsSaving(true);
        await onSave({
            id: existingTeam?.id,
            team_name: teamName,
            lead_id: leadId,
        });
        setIsSaving(false);
        onClose();
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-lg m-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        {existingTeam ? 'Edit Team' : 'Create New Team'}
                    </h2>
                    <div>
                        <label htmlFor="team-name" className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">
                            Team Name
                        </label>
                        <input 
                            type="text" 
                            id="team-name" 
                            value={teamName} 
                            onChange={e => setTeamName(e.target.value)} 
                            required 
                            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-white" 
                        />
                    </div>
                    <div>
                        <label htmlFor="team-lead" className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">
                            Team Lead (Optional)
                        </label>
                        <select
                            id="team-lead"
                            value={leadId || ''}
                            onChange={e => setLeadId(e.target.value || null)}
                            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                        >
                            <option value="">None</option>
                            {possibleLeads.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-md hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving} 
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center min-w-[100px] justify-center disabled:opacity-50"
                        >
                            {isSaving ? <Spinner size="sm" /> : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Edit Members Modal with Search
interface EditMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (memberIds: string[]) => Promise<void>;
    team: Team;
    users: UserProfile[];
}

const EditMembersModal: React.FC<EditMembersModalProps> = ({ isOpen, onClose, onSave, team, users }) => {
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(team.members.map(m => m.user_id));
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSelectedFirst, setShowSelectedFirst] = useState(false);
    
    const possibleMembers = users.filter(u => ['Teacher', 'Counselor', 'Team Lead'].includes(u.role));

    const filteredMembers = useMemo(() => {
        let filtered = possibleMembers.filter(user => 
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.role.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        if (showSelectedFirst) {
            filtered = [
                ...filtered.filter(u => selectedMemberIds.includes(u.id)),
                ...filtered.filter(u => !selectedMemberIds.includes(u.id))
            ];
        }
        
        return filtered;
    }, [possibleMembers, searchQuery, showSelectedFirst, selectedMemberIds]);

    const handleToggleMember = (userId: string) => {
        setSelectedMemberIds(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(selectedMemberIds);
        setIsSaving(false);
        onClose();
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                    Edit Members for {team.team_name}
                </h2>
                
                <div className="space-y-3 mb-4">
                    <SearchInput 
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search by name, role, or email..."
                    />
                    
                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={showSelectedFirst}
                                onChange={(e) => setShowSelectedFirst(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-slate-600 dark:text-slate-300">Show selected first</span>
                        </label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {filteredMembers.length} of {possibleMembers.length} users shown • {selectedMemberIds.length} selected
                        </span>
                    </div>
                </div>
                
                <div className="flex-grow overflow-y-auto space-y-2 pr-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                    {filteredMembers.map(user => (
                        <label 
                            key={user.id} 
                            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-500/10 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                        >
                            <input 
                                type="checkbox" 
                                checked={selectedMemberIds.includes(user.id)} 
                                onChange={() => handleToggleMember(user.id)} 
                                className="h-4 w-4 rounded text-blue-600" 
                            />
                            <div className="flex-grow">
                                <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {user.role} • {user.email}
                                </div>
                            </div>
                        </label>
                    ))}
                    {filteredMembers.length === 0 && (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            No members match your search.
                        </div>
                    )}
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 mt-4">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-md hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center min-w-[100px] justify-center disabled:opacity-50"
                    >
                        {isSaving ? <Spinner size="sm"/> : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Weekly Feedback Form Component
const TeamFeedbackForm: React.FC<{
    teamId: number;
    teamName: string;
    onSave: (teamId: number, rating: number, comments: string | null) => Promise<boolean>;
    latestFeedbackForWeek: TeamFeedback | undefined;
}> = ({ teamId, teamName, onSave, latestFeedbackForWeek }) => {
    const [rating, setRating] = useState(latestFeedbackForWeek?.rating || 0);
    const [hoverRating, setHoverRating] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) return;
        setIsSaving(true);
        await onSave(teamId, rating, null);
        setIsSaving(false);
    };
    
    if (latestFeedbackForWeek) {
        return (
            <div className="mt-3 p-3 bg-green-500/10 rounded-lg text-center">
                <h4 className="text-sm font-semibold text-green-800 dark:text-green-300">Weekly Feedback Submitted</h4>
                <p className="text-sm text-green-700 dark:text-green-400">You rated your team's performance this week:</p>
                <div className="text-3xl mt-1">{'★'.repeat(latestFeedbackForWeek.rating)}{'☆'.repeat(5 - latestFeedbackForWeek.rating)}</div>
            </div>
        );
    }

    return (
        <div className="mt-3 p-3 bg-slate-500/10 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Submit Weekly Feedback for {teamName}</h4>
            <div className="my-2 flex justify-center text-3xl cursor-pointer">
                {[1, 2, 3, 4, 5].map(star => (
                    <span
                        key={star}
                        className={star <= (hoverRating || rating) ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                    >
                        ★
                    </span>
                ))}
            </div>
            <button
                onClick={handleSubmit}
                disabled={isSaving || rating === 0}
                className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center"
            >
                {isSaving ? <Spinner size="sm" /> : 'Submit Rating'}
            </button>
        </div>
    );
};

// Main TeamHub Component
const TeamHub: React.FC<TeamHubProps> = ({
    users,
    currentUser,
    userPermissions,
    teams,
    teamPulse,
    teamFeedback,
    tasks,
    reports,
    lessonPlans,
    teachingAssignments,
    reviewEvidence,
    coverageData,
    coverageVotes,
    onCreateTeam,
    onUpdateTeam,
    onDeleteTeam,
    onUpdateTeamMembers,
    onSaveTeamFeedback,
    onSubmitReview
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [teamSearchQuery, setTeamSearchQuery] = useState('');
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [editingMembersTeam, setEditingMembersTeam] = useState<Team | null>(null);
    const [reviewingPlan, setReviewingPlan] = useState<LessonPlan | null>(null);

    const canManageTeams = userPermissions.includes('manage-teams') || userPermissions.includes('*');
    const isAdmin = ['Admin', 'Principal'].includes(currentUser.role);
    
    // Get current user's team
    const myTeam = teams.find(team => 
        team.members.some(member => member.user_id === currentUser.id) || 
        team.lead_id === currentUser.id
    );
    const myTeamPulse = myTeam ? teamPulse.find(pulse => pulse.teamId === myTeam.id) : undefined;
    const isMyTeamLead = myTeam?.lead_id === currentUser.id;

    // Calculate stats
    const totalTeams = teams.length;
    const totalMembers = teams.reduce((sum, team) => sum + team.members.length, 0);
    const avgPulseScore = teamPulse.length > 0 
        ? Math.round(teamPulse.reduce((sum, p) => sum + p.overallScore, 0) / teamPulse.length)
        : 0;
    
    // Lesson plan stats
    const pendingReviewPlans = lessonPlans.filter(p => 
        p.status === 'submitted' || p.status === 'under_review'
    );
    const approvedPlans = lessonPlans.filter(p => p.status === 'approved');
    
    // Coverage stats
    const totalPlans = lessonPlans.length;
    const fullyCoveredPlans = coverageData.filter(c => c.coverage_status === 'Fully Covered').length;
    const coverageRate = totalPlans > 0 ? Math.round((fullyCoveredPlans / totalPlans) * 100) : 0;

    // Team handlers
    const handleSaveTeam = async (teamData: Partial<Omit<Team, 'members'>>) => {
        if (teamData.id) {
            await onUpdateTeam(teamData.id, teamData);
        } else {
            await onCreateTeam(teamData as Omit<Team, 'id' | 'members'>);
        }
        setEditingTeam(null);
        setIsCreateModalOpen(false);
    };

    const handleDeleteTeam = async (teamId: number) => {
        if (window.confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
            await onDeleteTeam(teamId);
        }
    };

    // Filter teams for Teams tab
    const filteredTeams = useMemo(() => {
        return teams.filter(team => 
            team.team_name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
            team.lead?.name.toLowerCase().includes(teamSearchQuery.toLowerCase())
        );
    }, [teams, teamSearchQuery]);

    // Filter users for Members tab
    const filteredUsers = useMemo(() => {
        return users.filter(user =>
            user.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
            user.role.toLowerCase().includes(memberSearchQuery.toLowerCase())
        );
    }, [users, memberSearchQuery]);

    // Lesson plan filtering for current user
    const relevantPlans = useMemo(() => {
        if (isAdmin) return lessonPlans;
        
        if (myTeam) {
            const memberIds = new Set(myTeam.members.map(m => m.user_id));
            if (myTeam.lead_id) memberIds.add(myTeam.lead_id);
            return lessonPlans.filter(plan => memberIds.has(plan.author_id));
        }
        
        return lessonPlans.filter(plan => plan.author_id === currentUser.id);
    }, [lessonPlans, myTeam, currentUser.id, isAdmin]);

    const pendingReview = relevantPlans.filter(p => p.status === 'submitted' || p.status === 'under_review');
    const approved = relevantPlans.filter(p => p.status === 'approved');

    // Coverage feedback data
    const coverageReportData = useMemo(() => {
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
        }).sort((a, b) => new Date(b.plan.week_start_date!).getTime() - new Date(a.plan.week_start_date!).getTime());
    }, [relevantPlans, coverageVotes]);

    const studentConcurrence = coverageVotes.length > 0
        ? Math.round((coverageVotes.filter(v => v.vote === true).length / coverageVotes.length) * 100)
        : 0;

    // Get weekly feedback
    const weekStart = getWeekStartDate(new Date());
    const myTeamFeedbackThisWeek = myTeam 
        ? teamFeedback.find(f => f.team_id === myTeam.id && f.week_start_date === weekStart)
        : undefined;

    // Render tabs
    const renderTabButton = (tab: TabType, label: string, badge?: number) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
        >
            {label}
            {badge !== undefined && badge > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                    {badge}
                </span>
            )}
        </button>
    );

    // Overview Tab
    const renderOverviewTab = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Total Teams</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalTeams}</p>
                        </div>
                        <UsersIcon className="w-8 h-8 text-blue-500" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Team Members</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalMembers}</p>
                        </div>
                        <UserIcon className="w-8 h-8 text-green-500" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Avg Pulse Score</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{avgPulseScore}</p>
                        </div>
                        <ChartBarIcon className="w-8 h-8 text-purple-500" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Pending Reviews</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{pendingReviewPlans.length}</p>
                        </div>
                        <ClockIcon className="w-8 h-8 text-orange-500" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Approved Plans</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{approvedPlans.length}</p>
                        </div>
                        <CheckCircleIcon className="w-8 h-8 text-green-500" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Coverage Rate</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{coverageRate}%</p>
                        </div>
                        <FileTextIcon className="w-8 h-8 text-cyan-500" />
                    </div>
                </div>
            </div>

            {/* My Team Section */}
            {myTeam && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">My Team: {myTeam.team_name}</h3>
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Members</h4>
                            <div className="flex flex-wrap gap-2">
                                {myTeam.lead_id && (
                                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm">
                                        {users.find(u => u.id === myTeam.lead_id)?.name} (Lead)
                                    </span>
                                )}
                                {myTeam.members.map(member => (
                                    <span key={member.user_id} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full text-sm">
                                        {member.profile.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                        
                        {isMyTeamLead && (
                            <TeamFeedbackForm
                                teamId={myTeam.id}
                                teamName={myTeam.team_name}
                                onSave={onSaveTeamFeedback}
                                latestFeedbackForWeek={myTeamFeedbackThisWeek}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Team Pulse Leaderboard */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Team Pulse Leaderboard (Top 5)</h3>
                <div className="space-y-3">
                    {teamPulse.slice(0, 5).map((pulse, index) => (
                        <div key={pulse.teamId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <span className="text-2xl font-bold text-slate-400 dark:text-slate-500 w-8">
                                    #{index + 1}
                                </span>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">{pulse.teamName}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Lead: {pulse.leadName}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{pulse.overallScore}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Overall Score</p>
                            </div>
                        </div>
                    ))}
                    {teamPulse.length === 0 && (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-4">No team pulse data available.</p>
                    )}
                </div>
            </div>
        </div>
    );

    // Teams Tab
    const renderTeamsTab = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <SearchInput
                    value={teamSearchQuery}
                    onChange={setTeamSearchQuery}
                    placeholder="Search teams by name or lead..."
                    className="w-full sm:w-96"
                />
                {canManageTeams && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                        <PlusCircleIcon className="w-5 h-5" />
                        <span>Create Team</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTeams.map(team => {
                    const pulse = teamPulse.find(p => p.teamId === team.id);
                    const memberIds = new Set([...team.members.map(m => m.user_id), team.lead_id].filter(Boolean));
                    const openTasks = tasks.filter(t => 
                        memberIds.has(t.user_id) && 
                        t.status !== TaskStatus.Completed && 
                        t.status !== TaskStatus.Archived
                    ).length;

                    return (
                        <div key={team.id} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow hover:shadow-lg transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{team.team_name}</h3>
                                {canManageTeams && (
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setEditingTeam(team)}
                                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                                            title="Edit Team"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTeam(team.id)}
                                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                                            title="Delete Team"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-2 mb-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    <span className="font-medium">Lead:</span> {team.lead?.name || 'Not assigned'}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    <span className="font-medium">Members:</span> {team.members.length}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    <span className="font-medium">Open Tasks:</span> {openTasks}
                                </p>
                                {pulse && (
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        <span className="font-medium">Pulse Score:</span>{' '}
                                        <span className="font-bold text-blue-600 dark:text-blue-400">{pulse.overallScore}</span>
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 mb-4">
                                {team.members.slice(0, 5).map(member => (
                                    <div 
                                        key={member.user_id}
                                        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold"
                                        title={member.profile.name}
                                    >
                                        {member.profile.name.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                {team.members.length > 5 && (
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 text-xs font-bold">
                                        +{team.members.length - 5}
                                    </div>
                                )}
                            </div>

                            {canManageTeams && (
                                <button
                                    onClick={() => setEditingMembersTeam(team)}
                                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium"
                                >
                                    Manage Members
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {filteredTeams.length === 0 && (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    {teamSearchQuery ? 'No teams match your search.' : 'No teams created yet.'}
                </div>
            )}
        </div>
    );

    // Lesson Plans Tab
    const renderLessonPlansTab = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                    <ClockIcon className="w-6 h-6 mr-2 text-orange-500" />
                    Pending Review ({pendingReview.length})
                </h3>
                <div className="space-y-3">
                    {pendingReview.map(plan => (
                        <div key={plan.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{plan.title || 'Untitled Plan'}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {plan.author?.name} • {plan.subject} • Week of {new Date(plan.week_start_date + 'T00:00:00').toLocaleDateString()}
                                </p>
                            </div>
                            {(isAdmin || isMyTeamLead) && (
                                <button
                                    onClick={() => setReviewingPlan(plan)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                >
                                    Review →
                                </button>
                            )}
                        </div>
                    ))}
                    {pendingReview.length === 0 && (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-4">No plans pending review.</p>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                    <CheckCircleIcon className="w-6 h-6 mr-2 text-green-500" />
                    Approved Plans ({approved.length})
                </h3>
                <div className="space-y-3">
                    {approved.slice(0, 10).map(plan => (
                        <div key={plan.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{plan.title || 'Untitled Plan'}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {plan.author?.name} • {plan.subject} • Week of {new Date(plan.week_start_date + 'T00:00:00').toLocaleDateString()}
                                </p>
                            </div>
                            <CheckCircleIcon className="w-6 h-6 text-green-500" />
                        </div>
                    ))}
                    {approved.length === 0 && (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-4">No approved plans yet.</p>
                    )}
                </div>
            </div>
        </div>
    );

    // Coverage Tab
    const renderCoverageTab = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Coverage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Plans</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalPlans}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Fully Covered</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{fullyCoveredPlans}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">In Progress</p>
                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                        {coverageData.filter(c => c.coverage_status === 'Partially Covered' || c.coverage_status === 'Pending').length}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Student Concurrence</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{studentConcurrence}%</p>
                </div>
            </div>

            {/* Coverage Progress Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Coverage Progress</h3>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-8 overflow-hidden">
                    {totalPlans > 0 && (
                        <div className="h-full flex">
                            <div 
                                className="bg-green-500 flex items-center justify-center text-white text-sm font-semibold"
                                style={{ width: `${(fullyCoveredPlans / totalPlans) * 100}%` }}
                            >
                                {fullyCoveredPlans > 0 && `${Math.round((fullyCoveredPlans / totalPlans) * 100)}%`}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Student Feedback Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Student Feedback</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="px-4 py-3">Lesson / Teacher</th>
                                <th className="px-4 py-3">Week Of</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-center">Student Votes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coverageReportData.slice(0, 10).map(({ plan, concurs, disagrees, totalVotes }) => (
                                <tr key={plan.id} className="border-b border-slate-200 dark:border-slate-700">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-slate-900 dark:text-white">{plan.title || 'Untitled'}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{plan.author?.name}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                        {new Date(plan.week_start_date + 'T00:00:00').toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                            {getDerivedCoverageStatus(plan.id, coverageData)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {totalVotes > 0 ? (
                                            <div className="flex items-center justify-center gap-3 text-xs">
                                                <span className="text-green-600 dark:text-green-400 font-semibold">
                                                    ✓ {concurs}
                                                </span>
                                                <span className="text-red-600 dark:text-red-400 font-semibold">
                                                    ✗ {disagrees}
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-center text-slate-400 dark:text-slate-500 text-xs">No votes</p>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {coverageReportData.length === 0 && (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            No coverage data available.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // Pulse Tab
    const renderPulseTab = () => {
        const MetricBar: React.FC<{ label: string; score: number; weight: number }> = ({ label, score, weight }) => {
            const barColor = score > 80 ? 'bg-green-500' : score > 50 ? 'bg-blue-500' : 'bg-yellow-500';
            return (
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label} ({weight}%)</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{score}/100</p>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                        <div className={`${barColor} h-2.5 rounded-full transition-all`} style={{ width: `${score}%` }}></div>
                    </div>
                </div>
            );
        };

        return (
            <div className="space-y-6 animate-fade-in">
                {/* My Team's Performance */}
                {myTeam && myTeamPulse && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                            My Team's Performance: {myTeam.team_name}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <MetricBar label="Reporting Compliance" score={myTeamPulse.reportingCompliance} weight={25} />
                                <MetricBar label="Task Completion" score={myTeamPulse.taskCompletion} weight={25} />
                                <MetricBar label="Positive Sentiment" score={myTeamPulse.positiveSentiment} weight={20} />
                                <MetricBar label="Lead Engagement" score={myTeamPulse.leadEngagement} weight={20} />
                                <MetricBar label="Lead Feedback" score={myTeamPulse.leadFeedbackScore} weight={10} />
                            </div>
                            <div className="flex items-center justify-center">
                                <div className="text-center">
                                    <p className="text-6xl font-bold text-blue-600 dark:text-blue-400">{myTeamPulse.overallScore}</p>
                                    <p className="text-lg text-slate-600 dark:text-slate-400 mt-2">Overall Score</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Rank #{myTeamPulse.rank}</p>
                                </div>
                            </div>
                        </div>
                        
                        {isMyTeamLead && (
                            <TeamFeedbackForm
                                teamId={myTeam.id}
                                teamName={myTeam.team_name}
                                onSave={onSaveTeamFeedback}
                                latestFeedbackForWeek={myTeamFeedbackThisWeek}
                            />
                        )}
                    </div>
                )}

                {/* All Teams Leaderboard */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">All Teams Leaderboard</h3>
                    <div className="space-y-3">
                        {teamPulse.map((pulse, index) => (
                            <div key={pulse.teamId} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <div className="flex items-center space-x-4">
                                    <span className={`text-2xl font-bold w-10 text-center ${
                                        index === 0 ? 'text-yellow-500' : 
                                        index === 1 ? 'text-slate-400' :
                                        index === 2 ? 'text-amber-600' :
                                        'text-slate-400 dark:text-slate-500'
                                    }`}>
                                        #{index + 1}
                                    </span>
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">{pulse.teamName}</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">Lead: {pulse.leadName}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{pulse.overallScore}</p>
                                </div>
                            </div>
                        ))}
                        {teamPulse.length === 0 && (
                            <p className="text-center text-slate-500 dark:text-slate-400 py-4">No team pulse data available.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Members Tab (Admin Only)
    const renderMembersTab = () => {
        if (!canManageTeams) {
            return (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    You don't have permission to view this section.
                </div>
            );
        }

        return (
            <div className="space-y-6 animate-fade-in">
                <SearchInput
                    value={memberSearchQuery}
                    onChange={setMemberSearchQuery}
                    placeholder="Search by name, role, or email..."
                    className="w-full md:w-96"
                />

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3">Team</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => {
                                    const userTeam = teams.find(t => 
                                        t.members.some(m => m.user_id === user.id) || 
                                        t.lead_id === user.id
                                    );
                                    
                                    return (
                                        <tr key={user.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-900 dark:text-white">{user.name}</p>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                                {user.role}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                                {user.email}
                                            </td>
                                            <td className="px-6 py-4">
                                                {userTeam ? (
                                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                                        {userTeam.team_name}
                                                        {userTeam.lead_id === user.id && ' (Lead)'}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-500 text-xs">No team</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredUsers.length === 0 && (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                No users match your search.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
                        <UsersIcon className="w-8 h-8 mr-3 text-blue-600" />
                        Team Hub
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">
                        Central hub for all team-related functionality
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-2">
                    {renderTabButton('overview', 'Overview')}
                    {renderTabButton('teams', 'Teams', teams.length)}
                    {renderTabButton('lessonPlans', 'Lesson Plans', pendingReviewPlans.length)}
                    {renderTabButton('coverage', 'Coverage')}
                    {renderTabButton('pulse', 'Pulse')}
                    {canManageTeams && renderTabButton('members', 'Members')}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'teams' && renderTeamsTab()}
                {activeTab === 'lessonPlans' && renderLessonPlansTab()}
                {activeTab === 'coverage' && renderCoverageTab()}
                {activeTab === 'pulse' && renderPulseTab()}
                {activeTab === 'members' && renderMembersTab()}
            </div>

            {/* Modals */}
            <TeamModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleSaveTeam}
                users={users}
            />
            
            <TeamModal
                isOpen={!!editingTeam}
                onClose={() => setEditingTeam(null)}
                onSave={handleSaveTeam}
                users={users}
                existingTeam={editingTeam}
            />

            {editingMembersTeam && (
                <EditMembersModal
                    isOpen={!!editingMembersTeam}
                    onClose={() => setEditingMembersTeam(null)}
                    onSave={(memberIds) => onUpdateTeamMembers(editingMembersTeam.id, memberIds)}
                    team={editingMembersTeam}
                    users={users}
                />
            )}

            {reviewingPlan && (
                <LessonPlanReviewModal
                    plan={reviewingPlan}
                    onClose={() => setReviewingPlan(null)}
                    onSubmitReview={(review) => onSubmitReview(reviewingPlan.id, review)}
                />
            )}
        </div>
    );
};

export default TeamHub;

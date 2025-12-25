
import React, { useState, useMemo } from 'react';
import type { UserProfile, RoleDetails, RoleTitle, Campus } from '../types';
import { EmploymentStatus } from '../types';
import Spinner from './common/Spinner';
import { SearchIcon } from './common/icons';
import SearchableSelect from './common/SearchableSelect';
import Pagination from './common/Pagination';
import CreateStaffAccountModal from './CreateStaffAccountModal';
import StaffCredentialsModal from './StaffCredentialsModal';
import { useCampusScope } from '../contexts/CampusScopeContext';
import { filterUsersByCampus, getEffectiveCampusId } from '../utils/campusFiltering';

// Helper function for status styling
const getStatusStyling = (status: EmploymentStatus | undefined): string => {
    if (!status || status === EmploymentStatus.Active) {
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
    }
    if (status === EmploymentStatus.Suspended || status === EmploymentStatus.LongLeave) {
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    }
    return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
};

// Helper function to extract username from email
const extractUsername = (email: string): string => {
    if (email.includes('@upsshub.com')) {
        return email.replace('@upsshub.com', '');
    }
    return email.split('@')[0];
};

// Helper function to check if user has login account
const hasLoginAccount = (user: UserProfile): boolean => {
    // Users with @upsshub.com have generated accounts, 
    // or users with any email have an account
    return !!user.email && user.email.trim().length > 0;
};

// --- Main User Management Component ---
interface UserManagementProps {
    users: UserProfile[];
    roles: Record<string, RoleDetails>;
    campuses: Campus[];
    currentUserProfile?: UserProfile;
    onInviteUser: (email: string, role: RoleTitle) => Promise<void>;
    onUpdateUser: (userId: string, userData: Partial<UserProfile>) => Promise<boolean>;
    onDeleteUser: (userId: string) => Promise<boolean>;
    onDeactivateUser: (userId: string, isActive: boolean) => Promise<void>;
    onUpdateUserCampus: (userId: string, campusId: number | null) => Promise<void>;
    onUpdateEmploymentStatus?: (userId: string, status: EmploymentStatus) => Promise<void>;
    onCreateStaffAccount?: (data: {
        name: string;
        role: RoleTitle;
        phone_number: string;
        campus_id?: number;
        sendSms?: boolean;
    }) => Promise<{ success: boolean; credential?: { username: string; password: string }; messagingResults?: any[] }>;
    onResetStaffPassword?: (userId: string) => Promise<{ success: boolean; password?: string; messagingResults?: any[] }>;
}

const UserManagement: React.FC<UserManagementProps> = ({ 
    users = [], 
    roles, 
    campuses = [], 
    currentUserProfile,
    onInviteUser, 
    onUpdateUser, 
    onDeleteUser, 
    onDeactivateUser, 
    onUpdateUserCampus, 
    onUpdateEmploymentStatus,
    onCreateStaffAccount,
    onResetStaffPassword
}) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<EmploymentStatus | 'all'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [credentialsResults, setCredentialsResults] = useState<any[] | null>(null);
    const ITEMS_PER_PAGE = 15;
    
    // Get campus scope context
    const { isSitewideView } = useCampusScope();
    const currentUserCampusId = getEffectiveCampusId(currentUserProfile);

    const filteredUsers = useMemo(() => {
        // First apply campus filtering
        let filtered = filterUsersByCampus(users, currentUserCampusId, isSitewideView);
        
        // Filter by status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(user => 
                user.employment_status === statusFilter || 
                (!user.employment_status && statusFilter === EmploymentStatus.Active)
            );
        }
        
        // Filter by search term
        if (searchTerm.trim()) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(user =>
                user.name.toLowerCase().includes(lowercasedTerm) ||
                user.email.toLowerCase().includes(lowercasedTerm) ||
                user.role.toLowerCase().includes(lowercasedTerm)
            );
        }
        
        return filtered;
    }, [users, searchTerm, statusFilter, isSitewideView, currentUserCampusId]);

    // Pagination logic
    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredUsers, currentPage]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }

    const handleCreateAccount = async (data: {
        name: string;
        role: RoleTitle;
        phone_number: string;
        campus_id?: number;
        sendSms?: boolean;
    }) => {
        if (!onCreateStaffAccount) return { success: false };
        
        const result = await onCreateStaffAccount(data);
        if (result.success && result.credential) {
            // Show credentials modal
            setCredentialsResults([{
                name: data.name,
                username: result.credential.username,
                password: result.credential.password,
                status: 'Success' as const,
                messagingResults: result.messagingResults
            }]);
        }
        return result;
    };

    const handleResetPassword = async (userId: string, userName: string) => {
        if (!onResetStaffPassword) return;
        
        if (!confirm(`Reset password for ${userName}? A new password will be generated and sent via SMS.`)) {
            return;
        }

        const result = await onResetStaffPassword(userId);
        if (result.success && result.password) {
            // Show credentials modal
            setCredentialsResults([{
                name: userName,
                username: '',
                password: result.password,
                status: 'Success' as const,
                messagingResults: result.messagingResults
            }]);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in w-full overflow-hidden">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Manage all staff accounts in the system.</p>
                </div>
                <button 
                    onClick={() => setIsCreateModalOpen(true)} 
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                    Create Staff Account
                </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder="Search by name, email, or role..."
                        className="w-full h-11 pl-10 pr-4 bg-white/60 dark:bg-slate-900/40 border border-slate-300/60 dark:border-slate-700/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as EmploymentStatus | 'all'); setCurrentPage(1); }}
                    className="h-11 px-4 bg-white/60 dark:bg-slate-900/40 border border-slate-300/60 dark:border-slate-700/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Statuses</option>
                    {Object.values(EmploymentStatus).map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
            </div>
            
            <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 overflow-hidden min-w-0">
                <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full text-sm text-left min-w-[900px]">
                        <thead className="text-xs uppercase bg-slate-500/10">
                            <tr>
                                <th className="px-6 py-3 whitespace-nowrap">Name</th>
                                <th className="px-6 py-3 whitespace-nowrap">Email</th>
                                <th className="px-6 py-3 whitespace-nowrap">Username</th>
                                <th className="px-6 py-3 whitespace-nowrap">Role</th>
                                <th className="px-6 py-3 whitespace-nowrap">Status</th>
                                <th className="px-6 py-3 whitespace-nowrap">Campus</th>
                                <th className="px-6 py-3 text-right whitespace-nowrap"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedUsers.map(user => (
                                <tr key={user.id} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-500/10">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.email.includes('@upsshub.com') ? (
                                            <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                {extractUsername(user.email)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{user.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <select
                                            value={user.employment_status || EmploymentStatus.Active}
                                            onChange={(e) => onUpdateEmploymentStatus?.(user.id, e.target.value as EmploymentStatus)}
                                            className={`p-1 rounded-md border text-xs font-medium ${getStatusStyling(user.employment_status)}`}
                                        >
                                            {Object.values(EmploymentStatus).map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <select
                                            value={user.campus_id || ''}
                                            onChange={(e) => onUpdateUserCampus(user.id, e.target.value ? Number(e.target.value) : null)}
                                            className="p-1 rounded-md bg-transparent border border-slate-300 dark:border-slate-600 max-w-[150px]"
                                        >
                                            <option value="">Unassigned</option>
                                            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                                        <button 
                                            onClick={() => setEditingUser(user)} 
                                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            Edit
                                        </button>
                                        {onResetStaffPassword && user.email.includes('@upsshub.com') && (
                                            <button 
                                                onClick={() => handleResetPassword(user.id, user.name)} 
                                                className="font-medium text-green-600 dark:text-green-400 hover:underline"
                                            >
                                                Reset Password
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                if (confirm(`Are you sure you want to delete ${user.name}?`)) {
                                                    onDeleteUser(user.id);
                                                }
                                            }} 
                                            className="font-medium text-red-600 dark:text-red-400 hover:underline"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">No users found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <Pagination 
                    currentPage={currentPage} 
                    totalPages={totalPages} 
                    onPageChange={setCurrentPage} 
                    itemsPerPage={ITEMS_PER_PAGE}
                    totalItems={filteredUsers.length}
                />
            </div>

            {onCreateStaffAccount && (
                <CreateStaffAccountModal 
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreateAccount={handleCreateAccount}
                    roles={Object.keys(roles) as RoleTitle[]}
                    campuses={campuses}
                />
            )}

            {credentialsResults && (
                <StaffCredentialsModal
                    results={credentialsResults}
                    onClose={() => setCredentialsResults(null)}
                />
            )}
            
            {editingUser && (
                <EditUserModal
                    isOpen={!!editingUser}
                    onClose={() => setEditingUser(null)}
                    user={editingUser}
                    onUpdateUser={onUpdateUser}
                    roles={Object.keys(roles) as RoleTitle[]}
                    campuses={campuses}
                />
            )}
        </div>
    );
};

// Edit User Modal
interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    onUpdateUser: (userId: string, userData: Partial<UserProfile>) => Promise<boolean>;
    roles: RoleTitle[];
    campuses: Campus[];
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user, onUpdateUser, roles, campuses }) => {
    const [formData, setFormData] = useState({
        name: user.name,
        email: user.email,
        role: user.role,
        phone_number: user.phone_number || '',
        staff_code: user.staff_code || '',
        campus_id: user.campus_id || null,
        employment_status: user.employment_status || EmploymentStatus.Active,
    });
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const success = await onUpdateUser(user.id, formData);
        setIsSaving(false);
        if (success) {
            onClose();
        }
    };
    
    const inputClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base rounded-xl border border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-md m-4 max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Edit User</h2>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                            className={inputClasses}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            required
                            className={inputClasses}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                        <select 
                            value={formData.role} 
                            onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as RoleTitle }))} 
                            className={inputClasses}
                        >
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                        <input
                            type="text"
                            value={formData.phone_number}
                            onChange={e => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                            className={inputClasses}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Staff Code</label>
                        <input
                            type="text"
                            value={formData.staff_code}
                            onChange={e => setFormData(prev => ({ ...prev, staff_code: e.target.value }))}
                            className={inputClasses}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Campus</label>
                        <select 
                            value={formData.campus_id || ''} 
                            onChange={e => setFormData(prev => ({ ...prev, campus_id: e.target.value ? Number(e.target.value) : null }))} 
                            className={inputClasses}
                        >
                            <option value="">Unassigned</option>
                            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Employment Status</label>
                        <select 
                            value={formData.employment_status} 
                            onChange={e => setFormData(prev => ({ ...prev, employment_status: e.target.value as EmploymentStatus }))} 
                            className={inputClasses}
                        >
                            {Object.values(EmploymentStatus).map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center min-w-[120px] justify-center">
                            {isSaving ? <Spinner size="sm" /> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserManagement;

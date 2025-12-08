
import React, { useState, useMemo } from 'react';
import type { UserProfile, RoleDetails, RoleTitle, Campus } from '../types';
import Spinner from './common/Spinner';
import { SearchIcon } from './common/icons';
import SearchableSelect from './common/SearchableSelect';
import Pagination from './common/Pagination';

// --- Invite User Modal (Component-scoped) ---
interface InviteUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInviteUser: (email: string, role: RoleTitle) => Promise<void>;
    roles: RoleTitle[];
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onInviteUser, roles }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<RoleTitle>('Teacher');
    const [isInviting, setIsInviting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsInviting(true);
        await onInviteUser(email, role);
        setIsInviting(false);
        setEmail('');
        setRole('Teacher');
        onClose();
    };
    
    const inputClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base rounded-xl border border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-md m-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Invite New User</h2>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className={inputClasses}
                        />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Assign Role</label>
                        <select id="role" value={role} onChange={e => setRole(e.target.value as RoleTitle)} className={inputClasses}>
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">Cancel</button>
                        <button type="submit" disabled={isInviting} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center min-w-[120px] justify-center">
                            {isInviting ? <Spinner size="sm" /> : 'Send Invite'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Main User Management Component ---
interface UserManagementProps {
    users: UserProfile[];
    roles: Record<string, RoleDetails>;
    campuses: Campus[];
    onInviteUser: (email: string, role: RoleTitle) => Promise<void>;
    onUpdateUser: (userId: string, userData: Partial<UserProfile>) => Promise<boolean>;
    onDeleteUser: (userId: string) => Promise<boolean>;
    onDeactivateUser: (userId: string, isActive: boolean) => Promise<void>;
    onUpdateUserCampus: (userId: string, campusId: number | null) => Promise<void>;
}

const UserManagement: React.FC<UserManagementProps> = ({ users = [], roles, campuses = [], onInviteUser, onUpdateUser, onDeleteUser, onDeactivateUser, onUpdateUserCampus }) => {
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users;
        const lowercasedTerm = searchTerm.toLowerCase();
        return users.filter(user =>
            user.name.toLowerCase().includes(lowercasedTerm) ||
            user.email.toLowerCase().includes(lowercasedTerm) ||
            user.role.toLowerCase().includes(lowercasedTerm)
        );
    }, [users, searchTerm]);

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

    return (
        <div className="space-y-6 animate-fade-in w-full overflow-hidden">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Manage all staff accounts in the system.</p>
                </div>
                <button onClick={() => setIsInviteModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Invite New User</button>
            </div>
            
             <div className="relative">
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
            
            <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-500/10">
                            <tr>
                                <th className="px-6 py-3 whitespace-nowrap">Name</th>
                                <th className="px-6 py-3 whitespace-nowrap">Email</th>
                                <th className="px-6 py-3 whitespace-nowrap">Role</th>
                                <th className="px-6 py-3 whitespace-nowrap">Campus</th>
                                <th className="px-6 py-3 text-right whitespace-nowrap"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedUsers.map(user => (
                                <tr key={user.id} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-500/10">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{user.role}</td>
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
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No users found.</td>
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

            <InviteUserModal 
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                onInviteUser={onInviteUser}
                roles={Object.keys(roles) as RoleTitle[]}
            />
            
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

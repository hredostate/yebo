import React, { useState } from 'react';
import type { RoleTitle, Campus } from '../types';
import Spinner from './common/Spinner';

interface CreateStaffAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateAccount: (data: {
        name: string;
        role: RoleTitle;
        phone_number: string;
        campus_id?: number;
        sendSms?: boolean;
    }) => Promise<{ success: boolean; credential?: { username: string; password: string }; messagingResults?: any[] }>;
    roles: RoleTitle[];
    campuses: Campus[];
}

const CreateStaffAccountModal: React.FC<CreateStaffAccountModalProps> = ({ 
    isOpen, 
    onClose, 
    onCreateAccount, 
    roles, 
    campuses 
}) => {
    const [formData, setFormData] = useState({
        name: '',
        role: 'Teacher' as RoleTitle,
        phone_number: '',
        campus_id: undefined as number | undefined,
        sendSms: true
    });
    const [isCreating, setIsCreating] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        
        try {
            await onCreateAccount(formData);
            // Reset form
            setFormData({
                name: '',
                role: 'Teacher' as RoleTitle,
                phone_number: '',
                campus_id: undefined,
                sendSms: true
            });
            onClose();
        } catch (error) {
            console.error('Error creating staff account:', error);
        } finally {
            setIsCreating(false);
        }
    };
    
    const inputClasses = "mt-1 block w-full px-3 py-2 text-base rounded-xl border border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-md m-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Create Staff Account</h2>
                    
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Create a login account for a staff member. A username and password will be generated automatically.
                    </p>

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="John Doe"
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Role <span className="text-red-500">*</span>
                        </label>
                        <select 
                            id="role" 
                            value={formData.role} 
                            onChange={e => setFormData({ ...formData, role: e.target.value as RoleTitle })} 
                            className={inputClasses}
                        >
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="phone_number" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            id="phone_number"
                            value={formData.phone_number}
                            onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                            required
                            placeholder="e.g., +1234567890"
                            className={inputClasses}
                        />
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Required for sending login credentials via SMS (include country code)
                        </p>
                    </div>

                    <div>
                        <label htmlFor="campus_id" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Campus (Optional)
                        </label>
                        <select 
                            id="campus_id" 
                            value={formData.campus_id || ''} 
                            onChange={e => setFormData({ ...formData, campus_id: e.target.value ? Number(e.target.value) : undefined })} 
                            className={inputClasses}
                        >
                            <option value="">Unassigned</option>
                            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="sendSms"
                            checked={formData.sendSms}
                            onChange={e => setFormData({ ...formData, sendSms: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="sendSms" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                            Send credentials via SMS
                        </label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30"
                            disabled={isCreating}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isCreating} 
                            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center min-w-[120px] justify-center"
                        >
                            {isCreating ? <Spinner size="sm" /> : 'Create Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateStaffAccountModal;

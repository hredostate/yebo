
import React, { useState, useMemo } from 'react';
import type { ReportCardAnnouncement, Term } from '../types';
import { PlusIcon, TrashIcon, PencilIcon, ChevronUpIcon, ChevronDownIcon } from './common/icons';

interface ReportCardAnnouncementsManagerProps {
    announcements: ReportCardAnnouncement[];
    terms: Term[];
    onSaveAnnouncement: (announcement: Partial<ReportCardAnnouncement>) => Promise<boolean>;
    onDeleteAnnouncement: (id: number) => Promise<boolean>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ReportCardAnnouncementsManager: React.FC<ReportCardAnnouncementsManagerProps> = ({
    announcements,
    terms,
    onSaveAnnouncement,
    onDeleteAnnouncement,
    addToast,
}) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState<Partial<ReportCardAnnouncement>>({
        message: '',
        term_id: null,
        display_position: 'footer',
        is_active: true,
        display_order: 0,
    });
    const [isSaving, setIsSaving] = useState(false);

    // Sort announcements by display_order
    const sortedAnnouncements = useMemo(() => {
        return [...announcements].sort((a, b) => a.display_order - b.display_order);
    }, [announcements]);

    const handleEdit = (announcement: ReportCardAnnouncement) => {
        setEditingId(announcement.id);
        setFormData({
            message: announcement.message,
            term_id: announcement.term_id,
            display_position: announcement.display_position,
            is_active: announcement.is_active,
            display_order: announcement.display_order,
        });
        setIsAdding(false);
    };

    const handleCancel = () => {
        setEditingId(null);
        setIsAdding(false);
        setFormData({
            message: '',
            term_id: null,
            display_position: 'footer',
            is_active: true,
            display_order: 0,
        });
    };

    const handleSave = async () => {
        if (!formData.message?.trim()) {
            addToast('Message is required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const data: Partial<ReportCardAnnouncement> = {
                ...formData,
                message: formData.message.trim(),
            };

            if (editingId) {
                data.id = editingId;
            }

            const success = await onSaveAnnouncement(data);
            if (success) {
                addToast(editingId ? 'Announcement updated' : 'Announcement created', 'success');
                handleCancel();
            } else {
                addToast('Failed to save announcement', 'error');
            }
        } catch (error) {
            console.error('Error saving announcement:', error);
            addToast('Error saving announcement', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this announcement?')) {
            return;
        }

        try {
            const success = await onDeleteAnnouncement(id);
            if (success) {
                addToast('Announcement deleted', 'success');
                if (editingId === id) {
                    handleCancel();
                }
            } else {
                addToast('Failed to delete announcement', 'error');
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            addToast('Error deleting announcement', 'error');
        }
    };

    const handleMoveUp = async (announcement: ReportCardAnnouncement) => {
        const newOrder = Math.max(0, announcement.display_order - 1);
        await onSaveAnnouncement({ id: announcement.id, display_order: newOrder });
    };

    const handleMoveDown = async (announcement: ReportCardAnnouncement) => {
        const newOrder = announcement.display_order + 1;
        await onSaveAnnouncement({ id: announcement.id, display_order: newOrder });
    };

    const getTermName = (termId: number | null | undefined) => {
        if (!termId) return 'All Terms';
        const term = terms.find(t => t.id === termId);
        return term ? `${term.term_name} ${term.session_label || ''}`.trim() : 'Unknown Term';
    };

    const getPositionLabel = (position: string) => {
        const labels: Record<string, string> = {
            header: 'Header (Below school info)',
            footer: 'Footer (Bottom of report)',
            above_signatures: 'Above Signatures',
        };
        return labels[position] || position;
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Report Card Announcements</h2>
                {!isAdding && !editingId && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Add Announcement
                    </button>
                )}
            </div>

            <p className="text-sm text-slate-600 mb-6">
                Create announcements that will appear on all report cards. You can set announcements for specific terms or make them global.
                Use the display position to control where announcements appear on report cards.
            </p>

            {/* Add/Edit Form */}
            {(isAdding || editingId) && (
                <div className="mb-6 p-6 bg-slate-50 rounded-lg border-2 border-blue-300">
                    <h3 className="text-lg font-semibold mb-4 text-slate-800">
                        {editingId ? 'Edit Announcement' : 'New Announcement'}
                    </h3>
                    
                    <div className="space-y-4">
                        {/* Message */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Message <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={formData.message || ''}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                placeholder="e.g., Term Begins: 6th January 2025 | Ends: 28th March 2025"
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Term Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Apply to Term
                                </label>
                                <select
                                    value={formData.term_id || ''}
                                    onChange={(e) => setFormData({ ...formData, term_id: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">All Terms (Global)</option>
                                    {terms.map(term => (
                                        <option key={term.id} value={term.id}>
                                            {term.term_name} {term.session_label || ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    Select a specific term or leave as "All Terms" to show on all report cards
                                </p>
                            </div>

                            {/* Display Position */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Display Position
                                </label>
                                <select
                                    value={formData.display_position || 'footer'}
                                    onChange={(e) => setFormData({ ...formData, display_position: e.target.value as any })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="header">Header (Below school info)</option>
                                    <option value="footer">Footer (Bottom of report)</option>
                                    <option value="above_signatures">Above Signatures</option>
                                </select>
                            </div>

                            {/* Display Order */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Display Order
                                </label>
                                <input
                                    type="number"
                                    value={formData.display_order || 0}
                                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                    min={0}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Lower numbers appear first
                                </p>
                            </div>

                            {/* Active Toggle */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Status
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active ?? true}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="ml-3 text-sm text-slate-700">
                                        {formData.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </label>
                                <p className="text-xs text-slate-500 mt-1">
                                    Only active announcements appear on report cards
                                </p>
                            </div>
                        </div>

                        {/* Preview */}
                        {formData.message && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="text-sm font-semibold text-slate-700 mb-2">Preview:</h4>
                                <div className="p-3 bg-white border border-slate-200 rounded text-sm text-slate-800">
                                    {/* React automatically escapes text content, preventing XSS */}
                                    {formData.message}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !formData.message?.trim()}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSaving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Announcements List */}
            <div className="space-y-3">
                {sortedAnnouncements.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p className="text-lg mb-2">No announcements yet</p>
                        <p className="text-sm">Create your first announcement to get started</p>
                    </div>
                ) : (
                    sortedAnnouncements.map((announcement) => (
                        <div
                            key={announcement.id}
                            className={`p-4 border rounded-lg transition-all ${
                                announcement.is_active
                                    ? 'bg-white border-slate-200'
                                    : 'bg-slate-50 border-slate-300 opacity-60'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                            announcement.is_active
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {announcement.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                                            {getPositionLabel(announcement.display_position)}
                                        </span>
                                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                                            {getTermName(announcement.term_id)}
                                        </span>
                                        <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                                            Order: {announcement.display_order}
                                        </span>
                                    </div>
                                    {/* React automatically escapes text content, preventing XSS */}
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{announcement.message}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleMoveUp(announcement)}
                                        disabled={announcement.display_order === 0}
                                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Move up"
                                    >
                                        <ChevronUpIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleMoveDown(announcement)}
                                        className="p-1 text-slate-400 hover:text-slate-600"
                                        title="Move down"
                                    >
                                        <ChevronDownIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleEdit(announcement)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit"
                                    >
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(announcement.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ReportCardAnnouncementsManager;

import React, { useState } from 'react';
import {
    UploadCloudIcon,
    PlusCircleIcon,
    TrashIcon,
    EyeIcon,
    ShareIcon,
    GlobeIcon,
    XCircleIcon,
    DocumentTextIcon,
    FilmIcon,
    LinkIcon
} from './common/icons';
import type { LearningMaterial, LessonPlan } from '../types';

interface LearningMaterialsManagerProps {
    materials: LearningMaterial[];
    lessonPlans: LessonPlan[];
    onUploadMaterial: (material: Partial<LearningMaterial>, file?: File) => Promise<void>;
    onUpdateMaterial: (id: number, updates: Partial<LearningMaterial>) => Promise<void>;
    onDeleteMaterial: (id: number) => Promise<void>;
    currentUserId: string;
}

const LearningMaterialsManager: React.FC<LearningMaterialsManagerProps> = ({
    materials,
    lessonPlans,
    onUploadMaterial,
    onUpdateMaterial,
    onDeleteMaterial,
    currentUserId
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [materialForm, setMaterialForm] = useState<Partial<LearningMaterial>>({
        material_type: 'document',
        is_shared: false,
        is_published: false,
        tags: []
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filterType, setFilterType] = useState<string>('all');
    const [filterPlan, setFilterPlan] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getMaterialIcon = (type: string) => {
        switch (type) {
            case 'pdf':
            case 'document':
                return <DocumentTextIcon className="w-6 h-6" />;
            case 'video':
                return <FilmIcon className="w-6 h-6" />;
            case 'link':
            case 'presentation':
                return <LinkIcon className="w-6 h-6" />;
            default:
                return <DocumentTextIcon className="w-6 h-6" />;
        }
    };

    const filteredMaterials = materials.filter(m => {
        if (filterType !== 'all' && m.material_type !== filterType) return false;
        if (filterPlan && m.lesson_plan_id !== filterPlan) return false;
        if (searchTerm && !m.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!materialForm.title || !materialForm.lesson_plan_id) {
            alert('Please provide a title and select a lesson plan');
            return;
        }

        if (materialForm.material_type === 'link' && !materialForm.external_url) {
            alert('Please provide a URL for link materials');
            return;
        }

        if ((materialForm.material_type === 'pdf' || materialForm.material_type === 'document' || 
             materialForm.material_type === 'video') && !selectedFile) {
            alert('Please select a file to upload');
            return;
        }

        setIsSubmitting(true);
        try {
            await onUploadMaterial({
                ...materialForm,
                uploaded_by: currentUserId
            }, selectedFile || undefined);
            
            // Reset form
            setMaterialForm({
                material_type: 'document',
                is_shared: false,
                is_published: false,
                tags: []
            });
            setSelectedFile(null);
            setIsAdding(false);
        } catch (error) {
            console.error('Error uploading material:', error);
            alert('Failed to upload material. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleShared = async (material: LearningMaterial) => {
        try {
            await onUpdateMaterial(material.id, { is_shared: !material.is_shared });
        } catch (error) {
            console.error('Error toggling shared status:', error);
            alert('Failed to update material. Please try again.');
        }
    };

    const handleTogglePublished = async (material: LearningMaterial) => {
        try {
            await onUpdateMaterial(material.id, { is_published: !material.is_published });
        } catch (error) {
            console.error('Error toggling published status:', error);
            alert('Failed to update material. Please try again.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this material?')) return;
        
        try {
            await onDeleteMaterial(id);
        } catch (error) {
            console.error('Error deleting material:', error);
            alert('Failed to delete material. Please try again.');
        }
    };

    const handleAddTag = (materialId: number, tag: string) => {
        const material = materials.find(m => m.id === materialId);
        if (!material) return;
        
        const newTags = [...(material.tags || []), tag];
        onUpdateMaterial(materialId, { tags: newTags });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        Learning Materials
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Upload and manage materials for your lesson plans
                    </p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <PlusCircleIcon className="w-5 h-5" />
                    Add Material
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search materials..."
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                        <option value="all">All Types</option>
                        <option value="pdf">PDF</option>
                        <option value="video">Video</option>
                        <option value="link">Link</option>
                        <option value="document">Document</option>
                        <option value="presentation">Presentation</option>
                    </select>
                    <select
                        value={filterPlan || ''}
                        onChange={(e) => setFilterPlan(e.target.value ? parseInt(e.target.value) : null)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                        <option value="">All Lesson Plans</option>
                        {lessonPlans.map(plan => (
                            <option key={plan.id} value={plan.id}>{plan.title}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Add Material Form */}
            {isAdding && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                    Add Learning Material
                                </h3>
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <XCircleIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={materialForm.title || ''}
                                        onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        required
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={materialForm.description || ''}
                                        onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        rows={3}
                                    />
                                </div>

                                {/* Material Type */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Type *
                                    </label>
                                    <select
                                        value={materialForm.material_type || 'document'}
                                        onChange={(e) => setMaterialForm({ ...materialForm, material_type: e.target.value as any })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        required
                                    >
                                        <option value="pdf">PDF</option>
                                        <option value="video">Video</option>
                                        <option value="link">Link</option>
                                        <option value="document">Document</option>
                                        <option value="presentation">Presentation</option>
                                    </select>
                                </div>

                                {/* Lesson Plan */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Attach to Lesson Plan *
                                    </label>
                                    <select
                                        value={materialForm.lesson_plan_id || ''}
                                        onChange={(e) => setMaterialForm({ ...materialForm, lesson_plan_id: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        required
                                    >
                                        <option value="">Select a lesson plan</option>
                                        {lessonPlans.map(plan => (
                                            <option key={plan.id} value={plan.id}>{plan.title}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* File Upload or URL */}
                                {materialForm.material_type === 'link' ? (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            URL *
                                        </label>
                                        <input
                                            type="url"
                                            value={materialForm.external_url || ''}
                                            onChange={(e) => setMaterialForm({ ...materialForm, external_url: e.target.value })}
                                            placeholder="https://..."
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            File *
                                        </label>
                                        <input
                                            type="file"
                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                            accept={materialForm.material_type === 'video' ? 'video/*' : materialForm.material_type === 'pdf' ? '.pdf' : '*'}
                                            required
                                        />
                                    </div>
                                )}

                                {/* Sharing Options */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={materialForm.is_shared || false}
                                            onChange={(e) => setMaterialForm({ ...materialForm, is_shared: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            Share with other teachers
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={materialForm.is_published || false}
                                            onChange={(e) => setMaterialForm({ ...materialForm, is_published: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            Publish to students
                                        </span>
                                    </label>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Uploading...' : 'Upload Material'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAdding(false)}
                                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Materials List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMaterials.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                        <p>No materials found</p>
                    </div>
                ) : (
                    filteredMaterials.map(material => (
                        <div
                            key={material.id}
                            className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow hover:shadow-lg transition"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {getMaterialIcon(material.material_type)}
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                                            {material.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {material.material_type}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(material.id)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {material.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                    {material.description}
                                </p>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                                <button
                                    onClick={() => handleToggleShared(material)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                        material.is_shared
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                    }`}
                                >
                                    <ShareIcon className="w-3 h-3" />
                                    {material.is_shared ? 'Shared' : 'Private'}
                                </button>
                                <button
                                    onClick={() => handleTogglePublished(material)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                        material.is_published
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                    }`}
                                >
                                    <GlobeIcon className="w-3 h-3" />
                                    {material.is_published ? 'Published' : 'Draft'}
                                </button>
                            </div>

                            {material.file_url || material.external_url ? (
                                <a
                                    href={material.file_url || material.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                >
                                    <EyeIcon className="w-4 h-4" />
                                    View/Download
                                </a>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default LearningMaterialsManager;

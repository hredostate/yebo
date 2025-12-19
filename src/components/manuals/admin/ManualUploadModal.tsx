import React, { useState } from 'react';
import { CloseIcon, UploadCloudIcon } from '../../common/icons';
import Spinner from '../../common/Spinner';
import type { ManualFormData, ManualCategory, TargetAudience } from '../../../types/manuals';
import type { RoleTitle } from '../../../types';

interface ManualUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, formData: ManualFormData) => Promise<{ success: boolean; error: string | null }>;
  roles: RoleTitle[];
}

const MANUAL_CATEGORIES: ManualCategory[] = [
  'Academic',
  'Administrative',
  'Safety & Security',
  'IT & Technology',
  'Student Handbook',
  'Teacher Guide',
  'General',
];

const ManualUploadModal: React.FC<ManualUploadModalProps> = ({ isOpen, onClose, onUpload, roles }) => {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<ManualFormData>({
    title: '',
    description: '',
    category: 'General',
    target_audience: [],
    restricted_to_classes: [],
    restricted_to_roles: [],
    is_compulsory: false,
    compulsory_for_roles: [],
    compulsory_for_new_staff: false,
    days_to_complete: 7,
    requires_acknowledgment: true,
    acknowledgment_text: 'I confirm that I have read and understood this manual.',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        // Will be handled in handleSubmit
        return;
      }
      if (selectedFile.size > 25 * 1024 * 1024) {
        // Will be handled in handleSubmit
        return;
      }
      setFile(selectedFile);
      if (!formData.title) {
        setFormData({ ...formData, title: selectedFile.name.replace('.pdf', '') });
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type !== 'application/pdf') {
        // Will be handled in handleSubmit
        return;
      }
      if (droppedFile.size > 25 * 1024 * 1024) {
        // Will be handled in handleSubmit
        return;
      }
      setFile(droppedFile);
      if (!formData.title) {
        setFormData({ ...formData, title: droppedFile.name.replace('.pdf', '') });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      return; // Button is disabled when no file
    }

    // Validate file
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert('File size must be less than 25MB');
      return;
    }

    setIsUploading(true);
    const result = await onUpload(file, formData);
    setIsUploading(false);

    if (result.success) {
      // Reset form
      setFile(null);
      setFormData({
        title: '',
        description: '',
        category: 'General',
        target_audience: [],
        restricted_to_classes: [],
        restricted_to_roles: [],
        is_compulsory: false,
        compulsory_for_roles: [],
        compulsory_for_new_staff: false,
        days_to_complete: 7,
        requires_acknowledgment: true,
        acknowledgment_text: 'I confirm that I have read and understood this manual.',
      });
      onClose();
    }
    // Error handled by parent via toast
  };

  const toggleTargetAudience = (audience: TargetAudience) => {
    const newAudience = formData.target_audience.includes(audience)
      ? formData.target_audience.filter(a => a !== audience)
      : [...formData.target_audience, audience];
    setFormData({ ...formData, target_audience: newAudience });
  };

  const toggleCompulsoryRole = (role: RoleTitle) => {
    const newRoles = formData.compulsory_for_roles.includes(role)
      ? formData.compulsory_for_roles.filter(r => r !== role)
      : [...formData.compulsory_for_roles, role];
    setFormData({ ...formData, compulsory_for_roles: newRoles });
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in overflow-y-auto p-4">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-2xl my-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Upload Manual</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <UploadCloudIcon className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            {file ? (
              <div>
                <p className="text-green-600 dark:text-green-400 font-semibold">{file.name}</p>
                <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="mt-2 text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p className="text-slate-600 dark:text-slate-300 mb-2">
                  Drag and drop your PDF here, or click to browse
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition"
                >
                  Choose File
                </label>
                <p className="text-xs text-slate-500 mt-2">Maximum file size: 25MB</p>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as ManualCategory })}
                className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"
              >
                {MANUAL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium mb-2">Target Audience</label>
            <div className="flex gap-4">
              {(['teachers', 'students', 'both'] as TargetAudience[]).map(audience => (
                <label key={audience} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.target_audience.includes(audience)}
                    onChange={() => toggleTargetAudience(audience)}
                    className="rounded"
                  />
                  <span className="capitalize">{audience}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Compliance Settings */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Compliance Settings</h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_compulsory}
                  onChange={e => setFormData({ ...formData, is_compulsory: e.target.checked })}
                  className="rounded"
                />
                <span>Mark as compulsory reading</span>
              </label>

              {formData.is_compulsory && (
                <div className="ml-6 space-y-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.compulsory_for_new_staff}
                      onChange={e => setFormData({ ...formData, compulsory_for_new_staff: e.target.checked })}
                      className="rounded"
                    />
                    <span>Auto-assign to new staff</span>
                  </label>

                  <div>
                    <label className="block text-sm font-medium mb-1">Compulsory for roles:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {roles.filter(r => !['Student', 'Guardian', 'Parent'].includes(r)).map(role => (
                        <label key={role} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.compulsory_for_roles.includes(role)}
                            onChange={() => toggleCompulsoryRole(role)}
                            className="rounded"
                          />
                          <span>{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Days to complete</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.days_to_complete}
                      onChange={e => setFormData({ ...formData, days_to_complete: parseInt(e.target.value) })}
                      className="w-full max-w-xs p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requires_acknowledgment}
                      onChange={e => setFormData({ ...formData, requires_acknowledgment: e.target.checked })}
                      className="rounded"
                    />
                    <span>Require acknowledgment</span>
                  </label>

                  {formData.requires_acknowledgment && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Acknowledgment text</label>
                      <textarea
                        value={formData.acknowledgment_text}
                        onChange={e => setFormData({ ...formData, acknowledgment_text: e.target.value })}
                        rows={2}
                        className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-500/20 font-semibold rounded-lg"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg flex items-center disabled:opacity-50"
            >
              {isUploading && <Spinner size="sm" />}
              <span className={isUploading ? 'ml-2' : ''}>
                {isUploading ? 'Uploading...' : 'Upload Manual'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualUploadModal;

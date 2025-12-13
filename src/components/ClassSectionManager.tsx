

import React, { useState } from 'react';
import type { ClassSection, UserProfile } from '../types';
import Spinner from './common/Spinner';
import SearchableSelect from './common/SearchableSelect';
import { PlusCircleIcon, EditIcon, TrashIcon, RepeatIcon } from './common/icons';

// --- Modal Component ---
interface ClassSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { id?: number, name: string, subject: string, grade: number, teacher_id: string }) => Promise<void>;
  teachers: UserProfile[];
  initialData?: ClassSection | null;
}

const ClassSectionModal: React.FC<ClassSectionModalProps> = ({ isOpen, onClose, onSave, teachers, initialData }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [grade, setGrade] = useState<number | ''>(initialData?.grade || '');
  const [teacherId, setTeacherId] = useState<string>(initialData?.teacher_id || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !subject || !grade || !teacherId) {
      alert('Please fill out all fields.');
      return;
    }
    setIsSaving(true);
    await onSave({ id: initialData?.id, name, subject, grade: Number(grade), teacher_id: teacherId });
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-md m-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{initialData ? 'Edit' : 'Create'} Class Section</h2>
          <div>
            <label htmlFor="name" className="block text-sm font-medium">Section Name</label>
            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 w-full p-2 border rounded-md" placeholder="e.g., JSS 1A" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="subject" className="block text-sm font-medium">Subject</label>
              <input type="text" id="subject" value={subject} onChange={e => setSubject(e.target.value)} required className="mt-1 w-full p-2 border rounded-md" placeholder="e.g., English" />
            </div>
            <div>
              <label htmlFor="grade" className="block text-sm font-medium">Grade</label>
              <input type="number" id="grade" value={grade} onChange={e => setGrade(Number(e.target.value))} required className="mt-1 w-full p-2 border rounded-md" placeholder="e.g., 7" />
            </div>
          </div>
          <div>
            <label htmlFor="teacher" className="block text-sm font-medium">Teacher</label>
            <SearchableSelect
              options={teachers.map(t => ({ value: t.id, label: t.name }))}
              value={teacherId}
              onChange={value => setTeacherId(value as string)}
              placeholder="Select a teacher"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center min-w-[80px] justify-center">
              {isSaving ? <Spinner size="sm" /> : (initialData ? 'Save' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// --- Main Component ---
interface ClassSectionManagerProps {
  classSections: ClassSection[];
  users: UserProfile[];
  onCreateSection: (data: { name: string, subject: string, grade: number, teacher_id: string }) => Promise<any>;
  onUpdateSection: (id: number, data: Partial<ClassSection>) => Promise<any>;
  onDeleteSection: (id: number) => Promise<any>;
  onImportLegacySections: () => Promise<void>;
}

const ClassSectionManager: React.FC<ClassSectionManagerProps> = ({ classSections, users, onCreateSection, onUpdateSection, onDeleteSection, onImportLegacySections }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ClassSection | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const teachers = users.filter(u => (u.role === 'Teacher' || u.role === 'Team Lead' || u.role === 'Admin' || u.role === 'Principal') && (!u.employment_status || u.employment_status === 'Active'));

  const handleCreate = () => {
      setEditingSection(null);
      setIsModalOpen(true);
  };

  const handleEdit = (section: ClassSection) => {
      setEditingSection(section);
      setIsModalOpen(true);
  };

  const handleSave = async (data: { id?: number, name: string, subject: string, grade: number, teacher_id: string }) => {
      if (data.id) {
          await onUpdateSection(data.id, data);
      } else {
          await onCreateSection(data);
      }
  };

  const handleImport = async () => {
      setIsImporting(true);
      await onImportLegacySections();
      setIsImporting(false);
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Class Section Management</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Define classes and assign teachers.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleImport} disabled={isImporting} className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50">
                {isImporting ? <Spinner size="sm" /> : <><RepeatIcon className="w-4 h-4"/> Import Legacy Data</>}
            </button>
            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                <PlusCircleIcon className="w-4 h-4" /> New Class Section
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-500/10">
                <tr>
                  <th className="px-6 py-3">Section Name</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Grade</th>
                  <th className="px-6 py-3">Teacher</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classSections.length > 0 ? classSections.map(section => (
                  <tr key={section.id} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-500/10">
                    <td className="px-6 py-4 font-medium">{section.name}</td>
                    <td className="px-6 py-4">{section.subject}</td>
                    <td className="px-6 py-4">{section.grade}</td>
                    <td className="px-6 py-4">{users.find(u => u.id === section.teacher_id)?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleEdit(section)} className="text-blue-600 hover:text-blue-800 p-1">
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDeleteSection(section.id)} className="text-red-600 hover:text-red-800 p-1">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )) : (
                    <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No class sections found.</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ClassSectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        teachers={teachers}
        initialData={editingSection}
      />
    </>
  );
};

export default ClassSectionManager;
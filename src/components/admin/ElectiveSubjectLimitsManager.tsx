/**
 * Elective Subject Limits Manager
 * Admin interface for managing optional capacity limits on elective subjects
 */

import React, { useState, useEffect, useCallback } from 'react';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { BookOpenIcon, FilterIcon, SaveIcon } from '../common/icons';
import type { ElectiveSubjectLimit } from '../../types';

interface ElectiveSubjectLimitsManagerProps {
  schoolId: number;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface ElectiveSubjectInfo {
  subjectId: number;
  subjectName: string;
  currentEnrollment: number;
  maxStudents: number | null;
  limitId: number | null;
}

const ElectiveSubjectLimitsManager: React.FC<ElectiveSubjectLimitsManagerProps> = ({
  schoolId,
  addToast
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [arms, setArms] = useState<{ id: number; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedArm, setSelectedArm] = useState<number | null>(null);
  const [electiveSubjects, setElectiveSubjects] = useState<ElectiveSubjectInfo[]>([]);
  const [modifiedLimits, setModifiedLimits] = useState<Map<number, number | null>>(new Map());

  const supabase = requireSupabaseClient();

  // Fetch classes and arms
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const { data: classesData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name');

        const { data: armsData } = await supabase
          .from('arms')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name');

        setClasses(classesData || []);
        setArms(armsData || []);
        
        // Auto-select first class if available
        if (classesData && classesData.length > 0) {
          setSelectedClass(classesData[0].id);
        }
      } catch (error: any) {
        console.error('Error fetching filters:', error);
        addToast('Error loading filters', 'error');
      }
    };

    fetchFilters();
  }, [schoolId, addToast]);

  // Fetch elective subjects and their limits when filters change
  const fetchElectiveSubjects = useCallback(async () => {
    if (!selectedClass) return;

    setIsLoading(true);
    try {
      // Get elective subjects for this class
      const { data: classSubjects, error: subjectsError } = await supabase
        .from('class_subjects')
        .select('subject_id, subjects(id, name)')
        .eq('class_id', selectedClass)
        .eq('is_compulsory', false);

      if (subjectsError) throw subjectsError;

      if (!classSubjects || classSubjects.length === 0) {
        setElectiveSubjects([]);
        setIsLoading(false);
        return;
      }

      const subjectInfos: ElectiveSubjectInfo[] = [];

      for (const cs of classSubjects) {
        const subjectId = cs.subject_id;
        const subjectName = (cs.subjects as any)?.name || 'Unknown';

        // Get current limit
        const { data: limitData } = await supabase
          .from('elective_subject_limits')
          .select('id, max_students')
          .eq('school_id', schoolId)
          .eq('class_id', selectedClass)
          .eq('subject_id', subjectId)
          .eq('arm_id', selectedArm)
          .maybeSingle();

        // Get current enrollment
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .rpc('get_elective_enrollment_count', {
            p_subject_id: subjectId,
            p_class_id: selectedClass,
            p_arm_id: selectedArm
          });

        const currentEnrollment = enrollmentError ? 0 : (enrollmentData || 0);

        subjectInfos.push({
          subjectId,
          subjectName,
          currentEnrollment,
          maxStudents: limitData?.max_students || null,
          limitId: limitData?.id || null
        });
      }

      // Sort by subject name
      subjectInfos.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
      setElectiveSubjects(subjectInfos);
      setModifiedLimits(new Map());
    } catch (error: any) {
      console.error('Error fetching elective subjects:', error);
      addToast('Error loading elective subjects', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass, selectedArm, schoolId, addToast]);

  useEffect(() => {
    fetchElectiveSubjects();
  }, [fetchElectiveSubjects]);

  const handleLimitChange = (subjectId: number, value: string) => {
    const newLimits = new Map(modifiedLimits);
    if (value === '' || value === 'unlimited') {
      newLimits.set(subjectId, null);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        newLimits.set(subjectId, numValue);
      }
    }
    setModifiedLimits(newLimits);
  };

  const handleSave = async () => {
    if (modifiedLimits.size === 0) {
      addToast('No changes to save', 'info');
      return;
    }

    if (!selectedClass) {
      addToast('Please select a class', 'error');
      return;
    }

    setIsSaving(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const [subjectId, maxStudents] of modifiedLimits.entries()) {
        const subjectInfo = electiveSubjects.find(s => s.subjectId === subjectId);
        
        if (!subjectInfo) continue;

        if (subjectInfo.limitId) {
          // Update existing limit
          const { error } = await supabase
            .from('elective_subject_limits')
            .update({ max_students: maxStudents })
            .eq('id', subjectInfo.limitId);

          if (error) {
            console.error('Error updating limit:', error);
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          // Create new limit
          const { error } = await supabase
            .from('elective_subject_limits')
            .insert({
              school_id: schoolId,
              class_id: selectedClass,
              arm_id: selectedArm,
              subject_id: subjectId,
              max_students: maxStudents
            });

          if (error) {
            console.error('Error creating limit:', error);
            errorCount++;
          } else {
            successCount++;
          }
        }
      }

      if (errorCount === 0) {
        addToast(`Successfully updated ${successCount} limit(s)`, 'success');
      } else {
        addToast(`Updated ${successCount} limit(s), ${errorCount} failed`, 'error');
      }

      // Refresh data
      await fetchElectiveSubjects();
    } catch (error: any) {
      console.error('Error saving limits:', error);
      addToast('Error saving limits', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetAllToValue = async (value: number | null) => {
    const newLimits = new Map<number, number | null>();
    electiveSubjects.forEach(subject => {
      newLimits.set(subject.subjectId, value);
    });
    setModifiedLimits(newLimits);
  };

  const handleClearAll = () => {
    handleSetAllToValue(null);
  };

  const getCurrentLimit = (subjectId: number): number | null => {
    if (modifiedLimits.has(subjectId)) {
      return modifiedLimits.get(subjectId) || null;
    }
    const subject = electiveSubjects.find(s => s.subjectId === subjectId);
    return subject?.maxStudents || null;
  };

  if (isLoading && electiveSubjects.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <BookOpenIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Elective Subject Capacity Manager
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">
            Set optional enrollment limits for elective subjects. Leave blank for unlimited capacity.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FilterIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filter by Class and Arm</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Class Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Class <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClass || ''}
              onChange={(e) => setSelectedClass(Number(e.target.value))}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Class</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {/* Arm Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Arm (Optional)
            </label>
            <select
              value={selectedArm || ''}
              onChange={(e) => setSelectedArm(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Arms</option>
              {arms.map(arm => (
                <option key={arm.id} value={arm.id}>{arm.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {selectedClass && electiveSubjects.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleSetAllToValue(20)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Set All to 20
          </button>
          <button
            onClick={() => handleSetAllToValue(30)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Set All to 30
          </button>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Clear All Limits (Unlimited)
          </button>
        </div>
      )}

      {/* Subject Limits Table */}
      {selectedClass ? (
        electiveSubjects.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Elective Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Current Enrollment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Max Students Limit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {electiveSubjects.map((subject) => {
                    const currentLimit = getCurrentLimit(subject.subjectId);
                    const isModified = modifiedLimits.has(subject.subjectId);
                    const isNearCapacity = currentLimit !== null && subject.currentEnrollment >= currentLimit * 0.8;
                    const isFull = currentLimit !== null && subject.currentEnrollment >= currentLimit;

                    return (
                      <tr 
                        key={subject.subjectId} 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isModified ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {subject.subjectName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-700 dark:text-slate-300">
                            {subject.currentEnrollment}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            placeholder="Unlimited"
                            value={currentLimit === null ? '' : currentLimit}
                            onChange={(e) => handleLimitChange(subject.subjectId, e.target.value)}
                            className="w-32 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {currentLimit === null ? (
                            <span className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-xs rounded-full font-medium">
                              Unlimited
                            </span>
                          ) : isFull ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs rounded-full font-medium">
                              Full ({subject.currentEnrollment}/{currentLimit})
                            </span>
                          ) : isNearCapacity ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs rounded-full font-medium">
                              Near Capacity ({subject.currentEnrollment}/{currentLimit})
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs rounded-full font-medium">
                              Available ({subject.currentEnrollment}/{currentLimit})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Save Button */}
            {modifiedLimits.size > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {isSaving ? <Spinner size="sm" /> : <SaveIcon className="h-5 w-5" />}
                  Save Changes ({modifiedLimits.size})
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              No elective subjects found for this class{selectedArm && ' and arm'}.
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
              Make sure elective subjects are configured in the class subjects settings.
            </p>
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400">
            Please select a class to view and manage elective subject limits.
          </p>
        </div>
      )}
    </div>
  );
};

export default ElectiveSubjectLimitsManager;

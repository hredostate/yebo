
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { StudentProfile, Student, ProfileFieldConfig, CustomFieldValue } from '../types';
import Spinner from './common/Spinner';
import { UserCircleIcon, SaveIcon, ArrowLeftIcon, CameraIcon, LockClosedIcon } from './common/icons';

interface StudentProfileEditProps {
  studentProfile: StudentProfile;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
}

const StudentProfileEdit: React.FC<StudentProfileEditProps> = ({ 
  studentProfile, 
  addToast, 
  onNavigate 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [fieldConfigs, setFieldConfigs] = useState<ProfileFieldConfig[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});
  const [formData, setFormData] = useState<Record<string, any>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudentData = useCallback(async () => {
    if (!studentProfile.student_record_id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = requireSupabaseClient();
      
      // Fetch student data
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select(`
          *,
          class:classes(id, name),
          arm:arms(id, name),
          campus:campuses(id, name)
        `)
        .eq('id', studentProfile.student_record_id)
        .single();

      if (studentError) throw studentError;
      setStudentData(student);

      // Fetch field configurations
      const { data: configs, error: configError } = await supabase
        .from('student_profile_field_configs')
        .select('*')
        .eq('school_id', studentProfile.school_id)
        .order('display_order', { ascending: true });

      if (configError) throw configError;
      setFieldConfigs(configs || []);

      // Fetch custom field values
      const { data: customValues, error: customError } = await supabase
        .from('student_custom_field_values')
        .select('*')
        .eq('student_id', studentProfile.student_record_id);

      if (customError) throw customError;

      // Build custom field values map
      const customMap: Record<number, string> = {};
      (customValues || []).forEach((val: CustomFieldValue) => {
        customMap[val.field_config_id] = val.field_value || '';
      });
      setCustomFieldValues(customMap);

      // Initialize form data with built-in field values
      const initialFormData: Record<string, any> = {};
      (configs || []).forEach(config => {
        if (!config.is_custom) {
          initialFormData[config.field_name] = (student as any)[config.field_name] || '';
        }
      });
      setFormData(initialFormData);

    } catch (error: any) {
      console.error('Error fetching student data:', error);
      addToast(`Error loading profile: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [studentProfile, addToast]);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleCustomFieldChange = (fieldConfigId: number, value: string) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldConfigId]: value
    }));
  };

  const handleSave = async () => {
    if (!studentProfile.student_record_id) {
      addToast('Student record not found', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const supabase = requireSupabaseClient();

      // Update built-in fields that are editable
      const editableBuiltInFields = fieldConfigs
        .filter(f => !f.is_custom && f.is_editable_by_student);
      
      if (editableBuiltInFields.length > 0) {
        const updateData: Record<string, any> = {};
        editableBuiltInFields.forEach(config => {
          if (formData[config.field_name] !== undefined) {
            updateData[config.field_name] = formData[config.field_name];
          }
        });

        const { error } = await supabase
          .from('students')
          .update(updateData)
          .eq('id', studentProfile.student_record_id);

        if (error) throw error;
      }

      // Update custom field values
      const editableCustomFields = fieldConfigs
        .filter(f => f.is_custom && f.is_editable_by_student);

      for (const config of editableCustomFields) {
        const value = customFieldValues[config.id] || '';
        
        // Upsert custom field value
        const { error } = await supabase
          .from('student_custom_field_values')
          .upsert({
            school_id: studentProfile.school_id,
            student_id: studentProfile.student_record_id,
            field_config_id: config.id,
            field_value: value,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'student_id,field_config_id'
          });

        if (error) throw error;
      }

      addToast('Profile updated successfully!', 'success');
      await fetchStudentData(); // Refresh data

    } catch (error: any) {
      console.error('Error updating profile:', error);
      addToast(`Error updating profile: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studentProfile.student_record_id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast('Image size must be less than 5MB', 'error');
      return;
    }

    try {
      const supabase = requireSupabaseClient();
      setIsUploadingPhoto(true);

      // Upload to Supabase storage
      const filePath = `student-photos/${studentProfile.student_record_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update student record with new photo URL
      const { error: updateError } = await supabase
        .from('students')
        .update({ photo_url: data.publicUrl })
        .eq('id', studentProfile.student_record_id);

      if (updateError) throw updateError;

      addToast('Photo updated successfully!', 'success');
      await fetchStudentData(); // Refresh data to show new photo

    } catch (error: any) {
      console.error('Error uploading photo:', error);
      addToast(`Error uploading photo: ${error.message}`, 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!studentProfile.student_record_id) return;

    if (!window.confirm('Are you sure you want to remove your photo?')) {
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const supabase = requireSupabaseClient();

      const { error } = await supabase
        .from('students')
        .update({ photo_url: null })
        .eq('id', studentProfile.student_record_id);

      if (error) throw error;

      addToast('Photo removed successfully!', 'success');
      await fetchStudentData(); // Refresh data

    } catch (error: any) {
      console.error('Error removing photo:', error);
      addToast(`Error removing photo: ${error.message}`, 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="text-center p-8">
        <p className="text-slate-600 dark:text-slate-400">Student data not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('Student Dashboard')}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Profile</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">View and edit your profile information</p>
        </div>
      </div>

      {/* Profile Summary (Read-only) */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            {studentData.photo_url ? (
              <img 
                src={studentData.photo_url} 
                alt={studentData.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-blue-500"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <UserCircleIcon className="h-16 w-16 text-white" />
              </div>
            )}
            {/* Photo upload button overlay - only show if photo field is editable */}
            {fieldConfigs.find(f => f.field_name === 'photo_url')?.is_editable_by_student && (
              <>
                <button
                  onClick={handlePhotoClick}
                  disabled={isUploadingPhoto}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Change photo"
                >
                  {isUploadingPhoto ? (
                    <Spinner size="sm" />
                  ) : (
                    <CameraIcon className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{studentData.name}</h2>
            <div className="space-y-1 mt-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Student ID:</span> {studentData.admission_number || 'N/A'}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Class:</span> {studentData.class?.name || 'N/A'} 
                {studentData.arm?.name && ` - ${studentData.arm.name}`}
              </p>
              {studentData.email && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Email:</span> {studentData.email}
                </p>
              )}
              {studentData.date_of_birth && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Date of Birth:</span> {new Date(studentData.date_of_birth).toLocaleDateString()}
                </p>
              )}
            </div>
            {studentData.photo_url && fieldConfigs.find(f => f.field_name === 'photo_url')?.is_editable_by_student && (
              <button
                onClick={handleRemovePhoto}
                disabled={isUploadingPhoto}
                className="mt-3 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        {/* Parent/Guardian Contact (Read-only) */}
        {(studentData.parent_phone_number_1 || studentData.parent_phone_number_2) && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Parent/Guardian Contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {studentData.parent_phone_number_1 && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Primary: {studentData.parent_phone_number_1}
                </p>
              )}
              {studentData.parent_phone_number_2 && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Secondary: {studentData.parent_phone_number_2}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editable Fields - Dynamically Generated */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Profile Fields</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Fields marked with <LockClosedIcon className="inline h-4 w-4" /> are read-only and can only be edited by administrators.
        </p>

        {fieldConfigs.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            No profile fields configured
          </p>
        ) : (
          <div className="space-y-6">
            {fieldConfigs.map(config => {
              // Skip photo field - handled separately above
              if (config.field_type === 'photo') return null;
              
              const isEditable = config.is_editable_by_student;
              const value = config.is_custom 
                ? (customFieldValues[config.id] || '')
                : (formData[config.field_name] || '');

              return (
                <div key={config.id} className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {config.field_label}
                    {config.is_required && <span className="text-red-500">*</span>}
                    {!isEditable && <LockClosedIcon className="h-4 w-4 text-slate-400" title="Read-only field" />}
                  </label>
                  
                  {config.field_type === 'textarea' ? (
                    <textarea
                      value={value}
                      onChange={e => {
                        if (config.is_custom) {
                          handleCustomFieldChange(config.id, e.target.value);
                        } else {
                          handleInputChange(config.field_name, e.target.value);
                        }
                      }}
                      disabled={!isEditable}
                      placeholder={config.placeholder_text || ''}
                      rows={3}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                    />
                  ) : config.field_type === 'select' ? (
                    <select
                      value={value}
                      onChange={e => {
                        if (config.is_custom) {
                          handleCustomFieldChange(config.id, e.target.value);
                        } else {
                          handleInputChange(config.field_name, e.target.value);
                        }
                      }}
                      disabled={!isEditable}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                    >
                      <option value="">Select...</option>
                      {config.field_name === 'emergency_contact_relationship' ? (
                        <>
                          <option value="Parent">Parent</option>
                          <option value="Guardian">Guardian</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Relative">Relative</option>
                          <option value="Friend">Friend</option>
                          <option value="Other">Other</option>
                        </>
                      ) : config.field_options?.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={config.field_type === 'email' ? 'email' : config.field_type === 'phone' ? 'tel' : config.field_type === 'date' ? 'date' : 'text'}
                      value={value}
                      onChange={e => {
                        if (config.is_custom) {
                          handleCustomFieldChange(config.id, e.target.value);
                        } else {
                          handleInputChange(config.field_name, e.target.value);
                        }
                      }}
                      disabled={!isEditable}
                      placeholder={config.placeholder_text || ''}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              );
            })}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-400 disabled:to-slate-500 rounded-lg font-medium text-white transition-all flex items-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Spinner size="sm" />
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon className="h-5 w-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfileEdit;

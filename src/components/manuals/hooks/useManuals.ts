import { useState, useEffect } from 'react';
import { supa, Offline } from '../../../offline/client';
import type { Manual, ManualFormData, ManualCategory, ManualStatus } from '../../../types/manuals';

/**
 * Hook for managing manuals (CRUD operations)
 */
export function useManuals(schoolId: number) {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all manuals for the school
   */
  const fetchManuals = async (filters?: {
    status?: ManualStatus;
    category?: ManualCategory;
    compulsoryOnly?: boolean;
  }) => {
    try {
      setLoading(true);
      setError(null);

      let query = supa
        .from('manuals')
        .select(`
          *,
          uploader:uploaded_by(id, name),
          publisher:published_by(id, name)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.compulsoryOnly) {
        query = query.eq('is_compulsory', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setManuals(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch manuals');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get a single manual by ID
   */
  const getManual = async (manualId: number): Promise<Manual | null> => {
    try {
      const { data, error: fetchError } = await supa
        .from('manuals')
        .select(`
          *,
          uploader:uploaded_by(id, name),
          publisher:published_by(id, name)
        `)
        .eq('id', manualId)
        .single();

      if (fetchError) throw fetchError;

      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch manual');
      return null;
    }
  };

  /**
   * Upload a PDF file and create a manual
   */
  const uploadManual = async (
    file: File,
    formData: ManualFormData,
    userId: string
  ): Promise<{ data: Manual | null; error: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      // Validate file size (max 25MB)
      const MAX_FILE_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size must be less than 25MB');
      }

      // Validate file type
      if (file.type !== 'application/pdf') {
        throw new Error('Only PDF files are allowed');
      }

      // Upload file to storage
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${schoolId}/${fileName}`;

      const uploadResult = await Offline.upload('manuals', filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (uploadResult && 'offlineQueued' in uploadResult) {
        return {
          data: null,
          error: 'Upload queued for when online. Manual will be created once synced.',
        };
      }

      if (uploadResult.error) {
        throw new Error(uploadResult.error.message);
      }

      // Get public URL
      const { data: urlData } = supa.storage.from('manuals').getPublicUrl(filePath);

      // Create manual record
      const { data: manualData, error: insertError } = await supa
        .from('manuals')
        .insert({
          school_id: schoolId,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          file_url: urlData.publicUrl,
          file_path: filePath,
          file_size_bytes: file.size,
          version: 1,
          status: 'draft',
          target_audience: formData.target_audience,
          restricted_to_classes: formData.restricted_to_classes.length > 0 ? formData.restricted_to_classes : null,
          restricted_to_roles: formData.restricted_to_roles.length > 0 ? formData.restricted_to_roles : null,
          is_compulsory: formData.is_compulsory,
          compulsory_for_roles: formData.compulsory_for_roles.length > 0 ? formData.compulsory_for_roles : null,
          compulsory_for_new_staff: formData.compulsory_for_new_staff,
          days_to_complete: formData.days_to_complete,
          requires_acknowledgment: formData.requires_acknowledgment,
          acknowledgment_text: formData.acknowledgment_text || null,
          uploaded_by: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Refresh manuals list
      await fetchManuals();

      return { data: manualData, error: null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to upload manual';
      setError(errorMsg);
      return { data: null, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update manual metadata
   */
  const updateManual = async (
    manualId: number,
    updates: Partial<ManualFormData>
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supa
        .from('manuals')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', manualId);

      if (updateError) throw updateError;

      // Refresh manuals list
      await fetchManuals();

      return { success: true, error: null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to update manual';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Publish a manual
   */
  const publishManual = async (
    manualId: number,
    userId: string
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supa
        .from('manuals')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', manualId);

      if (updateError) throw updateError;

      // Refresh manuals list
      await fetchManuals();

      return { success: true, error: null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to publish manual';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Archive a manual
   */
  const archiveManual = async (
    manualId: number
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supa
        .from('manuals')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', manualId);

      if (updateError) throw updateError;

      // Refresh manuals list
      await fetchManuals();

      return { success: true, error: null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to archive manual';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a manual
   */
  const deleteManual = async (
    manualId: number
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      // Get manual to delete file
      const manual = await getManual(manualId);
      if (!manual) {
        throw new Error('Manual not found');
      }

      // Delete file from storage
      const { error: storageError } = await supa.storage
        .from('manuals')
        .remove([manual.file_path]);

      if (storageError) {
        console.warn('Failed to delete file from storage:', storageError);
      }

      // Delete manual record
      const { error: deleteError } = await supa
        .from('manuals')
        .delete()
        .eq('id', manualId);

      if (deleteError) throw deleteError;

      // Refresh manuals list
      await fetchManuals();

      return { success: true, error: null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete manual';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    manuals,
    loading,
    error,
    fetchManuals,
    getManual,
    uploadManual,
    updateManual,
    publishManual,
    archiveManual,
    deleteManual,
  };
}

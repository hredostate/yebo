import { requireSupabaseClient } from './supabaseClient';
import type { SubjectGroup, SubjectGroupMember } from '../types';

/**
 * Fetch subject groups for a specific class with their members
 */
export async function getSubjectGroupsForClass(
    classId: number,
    schoolId: number
): Promise<{ groups: SubjectGroup[]; members: SubjectGroupMember[] } | null> {
    try {
        const supabase = requireSupabaseClient();
        
        // Fetch groups
        const { data: groups, error: groupsError } = await supabase
            .from('subject_groups')
            .select('*')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .order('group_name');
        
        if (groupsError) {
            console.error('Error fetching subject groups:', groupsError);
            return null;
        }
        
        if (!groups || groups.length === 0) {
            return { groups: [], members: [] };
        }
        
        // Fetch members for all groups
        const groupIds = groups.map(g => g.id);
        const { data: members, error: membersError } = await supabase
            .from('subject_group_members')
            .select('*')
            .in('group_id', groupIds);
        
        if (membersError) {
            console.error('Error fetching subject group members:', membersError);
            return null;
        }
        
        return {
            groups: groups as SubjectGroup[],
            members: (members || []) as SubjectGroupMember[]
        };
    } catch (error) {
        console.error('Error in getSubjectGroupsForClass:', error);
        return null;
    }
}

/**
 * Create a new subject group
 */
export async function createSubjectGroup(
    group: Omit<SubjectGroup, 'id' | 'created_at' | 'updated_at'>
): Promise<SubjectGroup | null> {
    try {
        const supabase = requireSupabaseClient();
        
        const { data, error } = await supabase
            .from('subject_groups')
            .insert([group])
            .select()
            .single();
        
        if (error) {
            console.error('Error creating subject group:', error);
            return null;
        }
        
        return data as SubjectGroup;
    } catch (error) {
        console.error('Error in createSubjectGroup:', error);
        return null;
    }
}

/**
 * Update an existing subject group
 */
export async function updateSubjectGroup(
    groupId: number,
    updates: Partial<Omit<SubjectGroup, 'id' | 'school_id' | 'class_id' | 'created_at'>>
): Promise<boolean> {
    try {
        const supabase = requireSupabaseClient();
        
        const { error } = await supabase
            .from('subject_groups')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', groupId);
        
        if (error) {
            console.error('Error updating subject group:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in updateSubjectGroup:', error);
        return false;
    }
}

/**
 * Delete a subject group (cascade deletes members)
 */
export async function deleteSubjectGroup(groupId: number): Promise<boolean> {
    try {
        const supabase = requireSupabaseClient();
        
        const { error } = await supabase
            .from('subject_groups')
            .delete()
            .eq('id', groupId);
        
        if (error) {
            console.error('Error deleting subject group:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in deleteSubjectGroup:', error);
        return false;
    }
}

/**
 * Add a subject to a group
 */
export async function addSubjectToGroup(
    groupId: number,
    subjectId: number
): Promise<boolean> {
    try {
        const supabase = requireSupabaseClient();
        
        const { error } = await supabase
            .from('subject_group_members')
            .insert([{ group_id: groupId, subject_id: subjectId }]);
        
        if (error) {
            console.error('Error adding subject to group:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in addSubjectToGroup:', error);
        return false;
    }
}

/**
 * Remove a subject from a group
 */
export async function removeSubjectFromGroup(
    groupId: number,
    subjectId: number
): Promise<boolean> {
    try {
        const supabase = requireSupabaseClient();
        
        const { error } = await supabase
            .from('subject_group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('subject_id', subjectId);
        
        if (error) {
            console.error('Error removing subject from group:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in removeSubjectFromGroup:', error);
        return false;
    }
}

/**
 * Validate student subject selections against group constraints
 */
export async function validateStudentSelections(
    studentId: number,
    classId: number,
    schoolId: number,
    selectedSubjectIds: number[]
): Promise<{ isValid: boolean; errors: string[] }> {
    try {
        const result = await getSubjectGroupsForClass(classId, schoolId);
        
        if (!result) {
            return { isValid: true, errors: [] }; // Can't validate, assume valid
        }
        
        const { groups, members } = result;
        const errors: string[] = [];
        
        // For each group, count how many selected subjects belong to it
        for (const group of groups) {
            const groupMemberSubjectIds = members
                .filter(m => m.group_id === group.id)
                .map(m => m.subject_id);
            
            const selectedFromGroup = selectedSubjectIds.filter(id =>
                groupMemberSubjectIds.includes(id)
            );
            
            const count = selectedFromGroup.length;
            
            if (count < group.min_selections) {
                errors.push(
                    `"${group.group_name}" requires at least ${group.min_selections} selection${
                        group.min_selections > 1 ? 's' : ''
                    }, but you have ${count}`
                );
            }
            
            if (count > group.max_selections) {
                errors.push(
                    `"${group.group_name}" allows at most ${group.max_selections} selection${
                        group.max_selections > 1 ? 's' : ''
                    }, but you have ${count}`
                );
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    } catch (error) {
        console.error('Error in validateStudentSelections:', error);
        return { isValid: true, errors: [] }; // Can't validate, assume valid
    }
}

import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../../services/supabaseClient';
import type {
  TransportClassGroup,
  TransportClassGroupMember,
  TransportRoster,
  Term,
  TransportRoute,
} from '../../types';
import { handleSupabaseError } from '../../utils/errorHandling';

interface TeacherTransportGroupManagerProps {
  userId: string;
  schoolId: number;
  currentTerm: Term;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function TeacherTransportGroupManager({
  userId,
  schoolId,
  currentTerm,
  addToast,
}: TeacherTransportGroupManagerProps) {
  const [groups, setGroups] = useState<TransportClassGroup[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<TransportClassGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<TransportRoster[]>([]);
  const [availableStudents, setAvailableStudents] = useState<TransportRoster[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);

  // Form state
  const [groupName, setGroupName] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadGroups();
    loadRoutes();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMembers(selectedGroup.id);
      loadAvailableStudents(selectedGroup.id);
    }
  }, [selectedGroup]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_class_groups')
        .select('*, route:transport_routes!route_id(*), term:terms!term_id(*)')
        .eq('created_by', userId)
        .eq('term_id', currentTerm.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_routes')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('route_name');

      if (error) throw error;
      setRoutes(data || []);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to load routes');
    }
  };

  const loadGroupMembers = async (groupId: number) => {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_class_group_members')
        .select(`
          *,
          student:students(*),
          subscription:transport_subscriptions(
            *,
            route:transport_routes(*),
            stop:transport_stops(*),
            assigned_bus:transport_buses(*)
          )
        `)
        .eq('group_id', groupId);

      if (error) throw error;
      
      // Transform to TransportRoster format
      const roster: TransportRoster[] = (data || []).map(member => ({
        student_id: member.student.id,
        student_name: member.student.name,
        admission_number: member.student.admission_number,
        campus_name: member.student.campus?.name,
        route_name: member.subscription?.route?.route_name || '',
        stop_name: member.subscription?.stop?.stop_name || '',
        bus_number: member.subscription?.assigned_bus?.bus_number || '',
        seat_label: member.subscription?.seat_label,
      }));
      
      setGroupMembers(roster);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to load group members');
    }
  };

  const loadAvailableStudents = async (groupId: number) => {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase.rpc('get_available_students_for_group', {
        p_group_id: groupId,
      });

      if (error) throw error;
      setAvailableStudents(data || []);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to load available students');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      addToast('Please enter a group name', 'warning');
      return;
    }

    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_class_groups')
        .insert({
          school_id: schoolId,
          group_name: groupName,
          created_by: userId,
          term_id: currentTerm.id,
          route_id: selectedRouteId,
          description,
          is_active: true,
        })
        .select('*')
        .single();

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          addToast(
            `A group named "${groupName}" already exists for this term. Please choose a different name.`,
            'warning'
          );
          return;
        }
        throw error;
      }
      
      addToast('Group created successfully', 'success');
      setShowCreateModal(false);
      setGroupName('');
      setSelectedRouteId(null);
      setDescription('');
      loadGroups();
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (studentId: number) => {
    if (!selectedGroup) return;

    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      // Get the student's subscription
      const { data: subscription, error: subError } = await supabase
        .from('transport_subscriptions')
        .select('*')
        .eq('student_id', studentId)
        .eq('term_id', currentTerm.id)
        .eq('status', 'active')
        .single();

      if (subError) throw subError;

      // Add to group
      const { error } = await supabase
        .from('transport_class_group_members')
        .insert({
          group_id: selectedGroup.id,
          student_id: studentId,
          subscription_id: subscription.id,
          added_by: userId,
        });

      if (error) throw error;
      
      addToast('Student added to group', 'success');
      loadGroupMembers(selectedGroup.id);
      loadAvailableStudents(selectedGroup.id);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!selectedGroup) return;

    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('transport_class_group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('student_id', studentId);

      if (error) throw error;
      
      addToast('Student removed from group', 'success');
      loadGroupMembers(selectedGroup.id);
      loadAvailableStudents(selectedGroup.id);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to remove student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Transport Class Groups</h1>
        <p className="text-gray-600 mt-1">Create and manage student groups for transport attendance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">My Groups</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                + New
              </button>
            </div>

            <div className="space-y-2">
              {groups.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No groups yet</p>
              ) : (
                groups.map(group => (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`p-3 border rounded cursor-pointer transition-all ${
                      selectedGroup?.id === group.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <h3 className="font-semibold text-sm">{group.group_name}</h3>
                    {group.route && (
                      <p className="text-xs text-gray-600 mt-1">{group.route.route_name}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Group Details */}
        <div className="lg:col-span-2">
          {selectedGroup ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedGroup.group_name}</h2>
                  {selectedGroup.description && (
                    <p className="text-gray-600 mt-1">{selectedGroup.description}</p>
                  )}
                  {selectedGroup.route && (
                    <p className="text-sm text-gray-500 mt-2">
                      Route: {selectedGroup.route.route_name}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowAddStudentsModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Students
                </button>
              </div>

              {/* Members List */}
              <div>
                <h3 className="font-semibold mb-3">Group Members ({groupMembers.length})</h3>
                {groupMembers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No students in this group yet. Click "Add Students" to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {groupMembers.map(member => (
                      <div
                        key={member.student_id}
                        className="flex justify-between items-center p-3 border border-gray-200 rounded hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-semibold">{member.student_name}</p>
                          <p className="text-sm text-gray-600">
                            {member.route_name} • {member.stop_name}
                            {member.seat_label && ` • Seat ${member.seat_label}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveStudent(member.student_id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-6 text-center text-gray-500">
              Select a group to view details
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Create Transport Group</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="e.g., Morning Route A Students"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Route (Optional)</label>
                <select
                  value={selectedRouteId || ''}
                  onChange={(e) => setSelectedRouteId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">All Routes</option>
                  {routes.map(route => (
                    <option key={route.id} value={route.id}>
                      {route.route_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  rows={3}
                  placeholder="Optional notes about this group"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={loading || !groupName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Students Modal */}
      {showAddStudentsModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Add Students to {selectedGroup.group_name}</h3>
            
            {availableStudents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No available students. All students on this route are already in the group.
              </p>
            ) : (
              <div className="space-y-2">
                {availableStudents.map(student => (
                  <div
                    key={student.student_id}
                    className="flex justify-between items-center p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-semibold">{student.student_name}</p>
                      <p className="text-sm text-gray-600">
                        {student.route_name} • {student.stop_name}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddStudent(student.student_id)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      disabled={loading}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setShowAddStudentsModal(false)}
                className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

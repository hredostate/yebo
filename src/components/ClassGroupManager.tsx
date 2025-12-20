
import React, { useState, useMemo, useEffect } from 'react';
import type { ClassGroup, Student, UserProfile, AttendanceSchedule, AttendanceRecord, BaseDataObject, ClassGroupMember } from '../types';
import { AttendanceStatus, ClassGroupType } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon, UsersIcon, SearchIcon, CloseIcon, CheckCircleIcon } from './common/icons';
import ClassTeacherAttendance from './ClassTeacherAttendance';
import SubjectTeacherAttendance from './SubjectTeacherAttendance';
import SearchableSelect from './common/SearchableSelect';

// --- Modals ---

// 1. Manage Members Modal (Refined)
interface ManageMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (groupId: number, memberIds: number[]) => Promise<boolean>;
    group: ClassGroup;
    allStudents: Student[];
}

const ManageMembersModal: React.FC<ManageMembersModalProps> = ({ isOpen, onClose, onSave, group, allStudents }) => {
    const [activeTab, setActiveTab] = useState<'current' | 'add'>('current');
    const [searchQuery, setSearchQuery] = useState('');
    // Using a Set for efficient lookups. Initialize with IDs of students currently in the group.
    const [memberIdsSet, setMemberIdsSet] = useState<Set<number>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && group) {
            // Map existing members to their student IDs
            const existingIds = new Set((group.members || []).map(m => m.student_id));
            setMemberIdsSet(existingIds);
            setSearchQuery('');
            setActiveTab('current');
        }
    }, [isOpen, group]);

    // Calculate lists based on current selection set
    const { current: currentMembers, potential: potentialMembers } = useMemo(() => {
        const current: Student[] = [];
        const potential: Student[] = [];
        
        allStudents.forEach(student => {
            if (memberIdsSet.has(student.id)) {
                current.push(student);
            } else {
                potential.push(student);
            }
        });
        
        return { 
            current: current.sort((a,b) => a.name.localeCompare(b.name)), 
            potential: potential.sort((a,b) => a.name.localeCompare(b.name)) 
        };
    }, [allStudents, memberIdsSet]);

    const filteredList = useMemo(() => {
        const sourceList = activeTab === 'current' ? currentMembers : potentialMembers;
        if (!searchQuery.trim()) return sourceList;
        
        const lowerQuery = searchQuery.toLowerCase();
        return sourceList.filter(s => 
            s.name.toLowerCase().includes(lowerQuery) || 
            (s.admission_number && s.admission_number.toLowerCase().includes(lowerQuery)) ||
            (s.class?.name && s.class.name.toLowerCase().includes(lowerQuery))
        );
    }, [activeTab, currentMembers, potentialMembers, searchQuery]);

    const handleAdd = (studentId: number) => {
        const newSet = new Set(memberIdsSet);
        newSet.add(studentId);
        setMemberIdsSet(newSet);
    };

    const handleRemove = (studentId: number) => {
        const newSet = new Set(memberIdsSet);
        newSet.delete(studentId);
        setMemberIdsSet(newSet);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(group.id, Array.from(memberIdsSet));
        setIsSaving(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Manage Class Members</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{group.name} • {memberIdsSet.size} Students</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <button 
                        onClick={() => { setActiveTab('current'); setSearchQuery(''); }}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'current' ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-slate-900' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        Current Members ({currentMembers.length})
                    </button>
                    <button 
                        onClick={() => { setActiveTab('add'); setSearchQuery(''); }}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'add' ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-slate-900' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        Add Students
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={activeTab === 'current' ? "Search current members..." : "Search all students..."}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-grow overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50">
                    {filteredList.length > 0 ? (
                        <div className="space-y-2">
                            {filteredList.map(student => (
                                <div key={student.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${activeTab === 'current' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {student.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-white">{student.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {student.class?.name} {student.arm?.name} • ID: {student.admission_number || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {activeTab === 'current' ? (
                                        <button 
                                            onClick={() => handleRemove(student.id)}
                                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                            title="Remove from group"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleAdd(student.id)}
                                            className="p-2 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-lg transition-colors flex items-center gap-2"
                                            title="Add to group"
                                        >
                                            <PlusCircleIcon className="w-5 h-5" />
                                            <span className="text-sm font-semibold">Add</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 py-12">
                            <UsersIcon className="w-12 h-12 mb-2 opacity-20" />
                            <p>No students found matching your search.</p>
                            {activeTab === 'current' && <p className="text-sm mt-1">Go to "Add Students" tab to add members.</p>}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                        {isSaving ? <Spinner size="sm" /> : <><CheckCircleIcon className="w-5 h-5" /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        assignmentData: { teacher_user_id: string; subject_id: number | null; class_id: number; arm_id: number },
        groupData: { name: string; description: string; group_type: 'class_teacher' | 'subject_teacher' }
    ) => Promise<boolean>;
    users: UserProfile[];
    subjects: BaseDataObject[];
    classes: BaseDataObject[];
    arms: BaseDataObject[];
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({ isOpen, onClose, onSave, users, subjects, classes, arms }) => {
    const [teacherUserId, setTeacherUserId] = useState<string>('');
    const [subjectId, setSubjectId] = useState<number | null>(null);
    const [classId, setClassId] = useState<number | null>(null);
    const [armId, setArmId] = useState<number | null>(null);
    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');
    const [groupType, setGroupType] = useState<ClassGroupType>(ClassGroupType.SubjectTeacher);
    const [isSaving, setIsSaving] = useState(false);

    const teachers = useMemo(() => users.filter(u => ['Teacher', 'Team Lead'].includes(u.role)), [users]);

    // Clear subject when switching to ClassTeacher mode
    useEffect(() => {
        if (groupType === ClassGroupType.ClassTeacher) {
            setSubjectId(null);
        }
    }, [groupType]);

    useEffect(() => {
        const teacher = users.find(u => u.id === teacherUserId);
        const subject = subjects.find(s => s.id === subjectId);
        const cls = classes.find(c => c.id === classId);
        const arm = arms.find(a => a.id === armId);

        let autoName = '';
        if (groupType === ClassGroupType.ClassTeacher && teacher && cls) {
            autoName = `${cls.name}${arm ? ` ${arm.name}` : ''} - ${teacher.name}`;
        } else if (groupType === ClassGroupType.SubjectTeacher && teacher && subject && cls) {
            autoName = `${subject.name} - ${cls.name}${arm ? ` ${arm.name}` : ''}`;
        }
        setGroupName(autoName);
    }, [teacherUserId, subjectId, classId, armId, groupType, users, subjects, classes, arms]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validate based on group type
        if (groupType === ClassGroupType.SubjectTeacher) {
            if (!teacherUserId || !subjectId || !classId || !armId || !groupName) {
                alert('Please fill all required fields (Teacher, Subject, Class, Arm, and Group Name).');
                return;
            }
        } else if (groupType === ClassGroupType.ClassTeacher) {
            if (!teacherUserId || !classId || !armId || !groupName) {
                alert('Please fill all required fields (Teacher, Class, Arm, and Group Name).');
                return;
            }
        }

        setIsSaving(true);
        const success = await onSave(
            { teacher_user_id: teacherUserId, subject_id: subjectId, class_id: classId, arm_id: armId! },
            { name: groupName, description, group_type: groupType }
        );
        if (success) {
            onClose();
        }
        setIsSaving(false);
    };
    
    const commonClasses = "mt-1 block w-full text-left text-base rounded-xl border border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";


    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex justify-center items-center animate-fade-in">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-lg space-y-4 shadow-xl">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Class Assignment & Group</h2>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Group Type</label>
                    <select value={groupType} onChange={e => setGroupType(e.target.value as ClassGroupType)} className={`w-full p-2 border rounded-md mt-1 ${commonClasses}`}>
                        <option value={ClassGroupType.SubjectTeacher}>Subject Teacher Group</option>
                        <option value={ClassGroupType.ClassTeacher}>Class Teacher Group</option>
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Teacher *</label>
                        <SearchableSelect options={teachers.map(t => ({value: t.id, label: t.name}))} value={teacherUserId} onChange={(v) => setTeacherUserId(v as string)} placeholder="Select Teacher" />
                    </div>
                     {groupType === ClassGroupType.SubjectTeacher && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Subject *</label>
                            <SearchableSelect options={subjects.map(t => ({value: t.id, label: t.name}))} value={subjectId} onChange={(v) => setSubjectId(v as number)} placeholder="Select Subject" />
                        </div>
                     )}
                     <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Class *</label>
                        <SearchableSelect options={classes.map(t => ({value: t.id, label: t.name}))} value={classId} onChange={(v) => setClassId(v as number)} placeholder="Select Class" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Arm *</label>
                        <SearchableSelect options={arms.map(t => ({value: t.id, label: t.name}))} value={armId} onChange={(v) => setArmId(v as number)} placeholder="Select Arm" />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Generated Group Name *</label>
                    <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} required className={`w-full p-2 border rounded-md mt-1 ${commonClasses}`} />
                </div>
                <textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} className={`w-full p-2 border rounded-md ${commonClasses}`} rows={2}></textarea>
                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-md">Cancel</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center">{isSaving && <Spinner size="sm" />}<span className={isSaving ? 'ml-2' : ''}>Create</span></button>
                </div>
            </form>
        </div>
    );
};

// --- Main Component ---
interface ClassGroupManagerProps {
  classGroups: ClassGroup[];
  students: Student[];
  currentUser: UserProfile;
  onUpdateMembers: (groupId: number, memberIds: number[]) => Promise<boolean>;
  onSaveSchedule: (schedule: Partial<AttendanceSchedule> & { member_id: number }) => Promise<AttendanceSchedule | null>;
  onDeleteSchedule: (scheduleId: number) => Promise<boolean>;
  onSaveRecord: (record: Partial<AttendanceRecord> & { member_id: number; session_date: string; }) => Promise<boolean>;
  onCreateClassAssignment: (
    assignmentData: { teacher_user_id: string; subject_id: number | null; class_id: number; arm_id: number },
    groupData: { name: string; description: string; group_type: 'class_teacher' | 'subject_teacher' }
  ) => Promise<boolean>;
  onDeleteClassAssignment: (groupId: number) => Promise<boolean>;
  users: UserProfile[];
  subjects: BaseDataObject[];
  classes: BaseDataObject[];
  arms: BaseDataObject[];
  userPermissions: string[];
}

const ClassGroupManager: React.FC<ClassGroupManagerProps> = ({
    classGroups,
    students,
    currentUser,
    onUpdateMembers,
    onSaveSchedule,
    onDeleteSchedule,
    onSaveRecord,
    onCreateClassAssignment,
    onDeleteClassAssignment,
    users,
    subjects,
    classes,
    arms,
    userPermissions
}) => {
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [manageMembersGroup, setManageMembersGroup] = useState<ClassGroup | null>(null);

    const isAdmin = userPermissions.includes('manage-class-groups') || userPermissions.includes('*');

    const myGroups = useMemo(() => {
        if (!classGroups || classGroups.length === 0) {
            console.log('No class groups available');
            return [];
        }
        console.log('Filtering class groups:', { 
            totalGroups: classGroups.length, 
            isAdmin, 
            currentUserId: currentUser.id 
        });
        if (isAdmin) return classGroups;
        const filtered = classGroups.filter(g => 
            g.created_by === currentUser.id || 
            g.teaching_entity?.teacher_user_id === currentUser.id
        );
        console.log('Filtered groups for user:', { 
            filteredCount: filtered.length,
            groups: filtered.map(g => ({ id: g.id, name: g.name, created_by: g.created_by, teacher_user_id: g.teaching_entity?.teacher_user_id }))
        });
        return filtered;
    }, [classGroups, currentUser.id, isAdmin]);

    const selectedGroup = myGroups.find(g => g.id === selectedGroupId);

    const handleCreate = async (assignmentData: any, groupData: any) => {
        const success = await onCreateClassAssignment(assignmentData, groupData);
        if (success) setIsAssignmentModalOpen(false);
        return success;
    };
    
    const handleDelete = async (id: number) => {
        if (window.confirm('Delete this class group?')) {
            await onDeleteClassAssignment(id);
            if (selectedGroupId === id) setSelectedGroupId(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Classes & Attendance</h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Manage class groups and record daily attendance.</p>
                </div>
                {isAdmin && (
                    <button onClick={() => setIsAssignmentModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                        <PlusCircleIcon className="w-5 h-5"/> Create Group
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Group List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-slate-800 dark:text-white">My Groups</h3>
                        </div>
                        <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-2 space-y-1">
                            {myGroups.length > 0 ? myGroups.map(group => (
                                <div 
                                    key={group.id} 
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedGroupId === group.id ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    <p className={`font-semibold text-sm ${selectedGroupId === group.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>{group.name}</p>
                                    <p className="text-xs text-slate-500">{group.group_type === 'class_teacher' ? 'Class Register' : 'Subject Class'} • {group.members?.length || 0} Students</p>
                                </div>
                            )) : (
                                <p className="text-center text-slate-500 py-8 text-sm">No groups found.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    {selectedGroup ? (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[400px] flex flex-col">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{selectedGroup.name}</h2>
                                    <p className="text-slate-600 dark:text-slate-400 mt-1">{selectedGroup.description}</p>
                                    <span className="inline-block mt-2 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono text-slate-600 dark:text-slate-300">
                                        {selectedGroup.group_type === 'class_teacher' ? 'Daily Attendance Mode' : 'Subject Schedule Mode'}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setManageMembersGroup(selectedGroup)} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                        <UsersIcon className="w-4 h-4" /> Members
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => handleDelete(selectedGroup.id)} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 flex-grow">
                                {selectedGroup.group_type === 'class_teacher' ? (
                                    <ClassTeacherAttendance
                                        members={selectedGroup.members || []}
                                        onSaveRecord={onSaveRecord}
                                        schoolId={currentUser.school_id}
                                        userId={currentUser.id}
                                        groupId={selectedGroup.id}
                                        groupName={selectedGroup.name}
                                        teacherId={selectedGroup.teaching_entity?.teacher_user_id}
                                        canOverride={isAdmin || selectedGroup.teaching_entity?.teacher_user_id === currentUser.id}
                                    />
                                ) : (
                                    <SubjectTeacherAttendance 
                                        members={selectedGroup.members || []}
                                        onSaveRecord={onSaveRecord}
                                        schoolId={currentUser.school_id}
                                        userId={currentUser.id}
                                    />
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-12">
                            <UsersIcon className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">Select a group to manage attendance</p>
                            {isAdmin && <p className="text-sm mt-2">Or create a new group to get started</p>}
                        </div>
                    )}
                </div>
            </div>
            
            {manageMembersGroup && (
                <ManageMembersModal 
                    isOpen={!!manageMembersGroup}
                    onClose={() => setManageMembersGroup(null)}
                    group={manageMembersGroup}
                    allStudents={students}
                    onSave={onUpdateMembers}
                />
            )}

            {isAssignmentModalOpen && (
                <AssignmentModal 
                    isOpen={isAssignmentModalOpen}
                    onClose={() => setIsAssignmentModalOpen(false)}
                    onSave={handleCreate}
                    users={users}
                    subjects={subjects}
                    classes={classes}
                    arms={arms}
                />
            )}
        </div>
    );
};

export default ClassGroupManager;

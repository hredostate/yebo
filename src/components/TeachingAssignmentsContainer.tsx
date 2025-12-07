


import React from 'react';
import TeachingAssignmentsManager from './TeachingAssignmentsManager';
// FIX: Changed 'TeachingAssignment' to 'AcademicTeachingAssignment' to match the expected data structure.
import type { UserProfile, AcademicTeachingAssignment, BaseDataObject, ClassGroup, AcademicClass, Term } from '../types';

type Props = {
  users: UserProfile[];
  assignments: AcademicTeachingAssignment[];
  subjects: BaseDataObject[];
  classes: BaseDataObject[];
  arms: BaseDataObject[];
  classGroups: ClassGroup[];
  academicClasses: AcademicClass[];
  terms: Term[];
  onCreateAssignment: (
    assignmentData: { teacher_user_id: string; subject_id: number; class_id: number; arm_id: number | null },
    groupData: { name: string; description: string; group_type: 'class_teacher' | 'subject_teacher' }
  ) => Promise<boolean>;
  onDeleteAssignment: (groupId: number) => Promise<boolean>;
};

const TeachingAssignmentsContainer: React.FC<Props> = ({
  users,
  assignments,
  subjects,
  classes,
  arms,
  classGroups,
  academicClasses,
  terms,
  onCreateAssignment,
  onDeleteAssignment,
}) => {
  const handleSave = async (as: Partial<AcademicTeachingAssignment>): Promise<boolean> => {
    // This is a new/existing assignment being saved from the form
    // For now, we don't support editing existing assignments through this interface
    // We only support creating new ones
    if (as.id) {
      console.warn('Editing existing assignments is not yet supported through this interface');
      return false;
    }
    
    if (!as.teacher_user_id || !as.subject_name || !as.academic_class_id) {
      console.error('Missing required fields for assignment creation');
      return false;
    }
    
    // Find the subject by name to get its ID
    const subject = subjects.find(s => s.name === as.subject_name);
    if (!subject) {
      console.error(`Could not find subject with name: ${as.subject_name}`);
      return false;
    }
    
    const academicClass = academicClasses.find(ac => ac.id === as.academic_class_id);
    const teacher = users.find(u => u.id === as.teacher_user_id);

    if (!academicClass || !teacher) {
        console.error("Could not find all required data for assignment creation.");
        return false;
    }

    const classRecord = classes.find(c => c.name === academicClass.level);
    const armRecord = academicClass.arm ? arms.find(a => a.name === academicClass.arm) : null;

    if (!classRecord) {
        console.error(`Could not find a base 'class' matching level: ${academicClass.level}`);
        return false;
    }

    const groupName = `${subject.name} - ${academicClass.name}`;

    const assignmentData = {
        teacher_user_id: as.teacher_user_id,
        subject_id: subject.id,
        class_id: classRecord.id,
        arm_id: armRecord ? armRecord.id : null,
    };
    
    const groupData = {
        name: groupName,
        description: `Subject teacher group for ${groupName} taught by ${teacher.name}`,
        group_type: 'subject_teacher' as const,
    };

    return await onCreateAssignment(assignmentData, groupData);
  };
  
  const handleDelete = async (assignmentId: number): Promise<boolean> => {
    const classGroup = classGroups.find(cg => cg.teaching_entity_id === assignmentId);
    if (!classGroup) {
        console.error("Could not find class group for assignment", assignmentId);
        return false;
    }
    
    return await onDeleteAssignment(classGroup.id);
  };

  return (
    <TeachingAssignmentsManager
      users={users}
      assignments={assignments}
      academicClasses={academicClasses}
      terms={terms}
      classes={classes}
      arms={arms}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
};

export default TeachingAssignmentsContainer;
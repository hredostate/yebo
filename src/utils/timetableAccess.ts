import type { StudentProfile } from '../types.js';

export type TimetableAccessMode = 'student' | 'staff';

export function resolveTimetableAccess(userType: string, studentProfile?: Partial<StudentProfile>) {
    const isStudent = userType === 'student';
    return {
        mode: (isStudent ? 'student' : 'staff') as TimetableAccessMode,
        studentViewClassId: isStudent ? studentProfile?.class_id ?? null : null,
    };
}

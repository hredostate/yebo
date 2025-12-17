export function resolveTimetableAccess(userType, studentProfile) {
    const isStudent = userType === 'student';
    return {
        mode: (isStudent ? 'student' : 'staff'),
        studentViewClassId: isStudent ? studentProfile?.class_id ?? null : null,
    };
}

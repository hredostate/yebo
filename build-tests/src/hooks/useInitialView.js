import { useRef } from 'react';
// Auth-only views that authenticated users should not access
export const AUTH_ONLY_VIEWS = ['teacher-login', 'student-login', 'landing', 'public-ratings'];
// Views that students are allowed to access
export const STUDENT_ALLOWED_VIEWS = [
    'My Subjects',
    'Rate My Teacher',
    'Student Surveys',
    'Student Reports',
    'Student Dashboard',
    'Student Finances',
    'Student Profile Edit',
    'My Strikes & Appeals',
    'Student Lessons',
    'Timetable',
    'My Homework',
    'Absence Requests',
    'School Store',
];
// Helper: Check if a view is allowed for students
export const isStudentAllowedView = (view) => {
    return (STUDENT_ALLOWED_VIEWS.includes(view) ||
        view.startsWith('Student Report/') ||
        view.startsWith('Take Quiz/'));
};
// Helper: Parse initial target view from URL hash
export const getInitialTargetViewFromHash = () => {
    try {
        let hash = decodeURIComponent(window.location.hash.substring(1));
        if (hash.startsWith('/'))
            hash = hash.substring(1);
        // Ignore auth tokens and empty hashes
        if (!hash || hash.includes('access_token=') || hash.includes('error=')) {
            return null;
        }
        return hash;
    }
    catch (e) {
        console.warn('Failed to parse initial URL hash:', window.location.hash, e);
        return null;
    }
};
// Helper: Get Monday of the current week as a string
export const getWeekStartDateString = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};
export const useInitialTargetView = () => useRef(getInitialTargetViewFromHash());

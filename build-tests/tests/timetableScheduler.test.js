import { strict as assert } from 'node:assert';
import { applySchedulingRules } from '../src/services/timetableScheduler.js';
import { resolveTimetableAccess } from '../src/utils/timetableAccess.js';
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    }
    catch (error) {
        console.error(`✗ ${name}`);
        throw error;
    }
}
const subjects = [
    { id: 1, name: 'Math', priority: 1, can_co_run: false },
    { id: 2, name: 'Physics', priority: 3, can_co_run: false },
    { id: 3, name: 'Art', priority: 1, can_co_run: true },
    { id: 4, name: 'Music', priority: 1, can_co_run: true },
    { id: 5, name: 'Lab Science', priority: 2, is_solo: true },
];
function buildEntry(id, overrides = {}) {
    return {
        id,
        school_id: 1,
        term_id: 1,
        day_of_week: 'Monday',
        period_id: 1,
        academic_class_id: 10,
        subject_id: 1,
        teacher_id: 'teacher-1',
        ...overrides,
    };
}
// Student access guard
const studentAccess = resolveTimetableAccess('student', { class_id: 42 });
test('students are routed to student timetable mode', () => {
    assert.strictEqual(studentAccess.mode, 'student');
    assert.strictEqual(studentAccess.studentViewClassId, 42);
});
test('higher priority subject replaces existing assignment', () => {
    const existing = [buildEntry(1, { subject_id: 1 })];
    const candidate = { ...buildEntry(2, { subject_id: 2, teacher_id: 'teacher-2' }), id: undefined };
    const result = applySchedulingRules({ existingEntries: existing, candidateEntry: candidate, subjects });
    assert.ok(!result.error);
    assert.deepStrictEqual(result.entriesToDelete, [1]);
});
test('co-run subjects can share the same slot', () => {
    const existing = [
        buildEntry(1, { subject_id: 3, teacher_id: 't1' }),
        buildEntry(2, { subject_id: 4, teacher_id: 't2' }),
    ];
    const candidate = buildEntry(0, { subject_id: 3, teacher_id: 't3', id: undefined });
    const result = applySchedulingRules({ existingEntries: existing, candidateEntry: candidate, subjects });
    assert.ok(!result.error);
    assert.strictEqual(result.entriesToDelete.length, 0);
});
test('solo subjects block co-running subjects', () => {
    const existing = [buildEntry(1, { subject_id: 5 })];
    const candidate = buildEntry(0, { subject_id: 3, teacher_id: 'teacher-2', id: undefined });
    const result = applySchedulingRules({ existingEntries: existing, candidateEntry: candidate, subjects });
    assert.ok(result.error && result.error.includes('solo'));
});
test('location uniqueness is enforced', () => {
    const existing = [buildEntry(1, { location_id: 7 })];
    const candidate = buildEntry(0, { subject_id: 3, location_id: 7, teacher_id: 'teacher-3', id: undefined });
    const result = applySchedulingRules({ existingEntries: existing, candidateEntry: candidate, subjects });
    assert.ok(result.error?.includes('already booked'));
});
console.log('All timetable scheduling tests passed.');

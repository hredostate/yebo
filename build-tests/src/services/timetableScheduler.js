const DEFAULT_PRIORITY = 1;
function getSubjectConfig(subjectId, subjects) {
    const match = subjects.find((s) => s.id === subjectId);
    return {
        priority: match?.priority ?? DEFAULT_PRIORITY,
        isSolo: !!match?.is_solo,
        canCoRun: !!match?.can_co_run,
        name: match?.name || 'Subject',
    };
}
function pickHighest(entries) {
    if (entries.length === 0)
        return null;
    return [...entries].sort((a, b) => {
        if (b.meta.priority !== a.meta.priority)
            return b.meta.priority - a.meta.priority;
        return (a.meta.name || '').localeCompare(b.meta.name || '') || (a.entry.id || 0) - (b.entry.id || 0);
    })[0];
}
function hasTeacherConflict(existingEntries, candidate) {
    return existingEntries.some((e) => e.day_of_week === candidate.day_of_week &&
        e.period_id === candidate.period_id &&
        e.teacher_id === candidate.teacher_id &&
        e.id !== candidate.id);
}
function hasLocationConflict(existingEntries, candidate) {
    if (!candidate.location_id)
        return null;
    const conflict = existingEntries.find((e) => e.day_of_week === candidate.day_of_week &&
        e.period_id === candidate.period_id &&
        e.location_id === candidate.location_id &&
        e.id !== candidate.id);
    return conflict || null;
}
/**
 * Applies scheduling rules to determine whether a timetable entry can be inserted/updated.
 * Rules covered:
 * - Priority replacement for conflicting subjects
 * - Solo vs co-running subjects
 * - Location uniqueness per slot
 * - Teacher double-booking prevention
 */
export function applySchedulingRules(params) {
    const { existingEntries, candidateEntry, subjects } = params;
    const baseResult = { entriesToUpsert: [], entriesToDelete: [] };
    // Minimal validation
    if (!candidateEntry.day_of_week || !candidateEntry.period_id || !candidateEntry.academic_class_id || !candidateEntry.subject_id || !candidateEntry.teacher_id) {
        return { ...baseResult, error: 'Missing required timetable fields.' };
    }
    if (hasTeacherConflict(existingEntries, candidateEntry)) {
        return { ...baseResult, error: 'Teacher is already assigned to another class in this slot.' };
    }
    const locationConflict = hasLocationConflict(existingEntries, candidateEntry);
    if (locationConflict) {
        const locationName = locationConflict.location?.name || 'Location';
        return { ...baseResult, error: `${locationName} is already booked at this time.` };
    }
    const candidateMeta = getSubjectConfig(candidateEntry.subject_id, subjects);
    const slotEntries = existingEntries.filter((e) => e.day_of_week === candidateEntry.day_of_week &&
        e.period_id === candidateEntry.period_id &&
        e.academic_class_id === candidateEntry.academic_class_id &&
        e.id !== candidateEntry.id);
    const slotEntriesWithMeta = slotEntries.map((entry) => ({ entry, meta: getSubjectConfig(entry.subject_id, subjects) }));
    const soloInSlot = slotEntriesWithMeta.filter(({ meta }) => meta.isSolo);
    // Solo subjects cannot share slots
    if (candidateMeta.isSolo) {
        if (slotEntriesWithMeta.length > 0) {
            const highestExisting = pickHighest(slotEntriesWithMeta);
            if (candidateMeta.priority > highestExisting.meta.priority) {
                baseResult.entriesToDelete.push(...slotEntriesWithMeta.map(({ entry }) => entry.id).filter(Boolean));
            }
            else {
                return { ...baseResult, error: `${highestExisting.meta.name} already occupies this slot with equal or higher priority.` };
            }
        }
    }
    else if (soloInSlot.length > 0) {
        const highestSolo = pickHighest(soloInSlot);
        if (candidateMeta.priority > highestSolo.meta.priority) {
            baseResult.entriesToDelete.push(...slotEntriesWithMeta.map(({ entry }) => entry.id).filter(Boolean));
        }
        else {
            return { ...baseResult, error: `${highestSolo.meta.name} is marked as solo and already scheduled here.` };
        }
    }
    // Handle co-run / non co-run conflicts
    const blockingEntries = slotEntriesWithMeta.filter(({ meta }) => !meta.canCoRun);
    if (blockingEntries.length > 0) {
        const strongestBlocking = pickHighest(blockingEntries);
        if (candidateMeta.canCoRun) {
            // Candidate can co-run but existing entry cannot; treat as conflict resolved by priority
            if (candidateMeta.priority > strongestBlocking.meta.priority) {
                baseResult.entriesToDelete.push(...blockingEntries.map(({ entry }) => entry.id).filter(Boolean));
            }
            else {
                return { ...baseResult, error: `${strongestBlocking.meta.name} already owns this slot.` };
            }
        }
        else {
            if (candidateMeta.priority > strongestBlocking.meta.priority) {
                baseResult.entriesToDelete.push(...blockingEntries.map(({ entry }) => entry.id).filter(Boolean));
            }
            else if (candidateMeta.priority === strongestBlocking.meta.priority) {
                return { ...baseResult, error: `${strongestBlocking.meta.name} has the same priority and remains scheduled.` };
            }
            else {
                return { ...baseResult, error: `${strongestBlocking.meta.name} has higher priority for this slot.` };
            }
        }
    }
    else if (slotEntriesWithMeta.length > 0 && !candidateMeta.canCoRun) {
        const highestExisting = pickHighest(slotEntriesWithMeta);
        if (candidateMeta.priority > highestExisting.meta.priority) {
            baseResult.entriesToDelete.push(...slotEntriesWithMeta.map(({ entry }) => entry.id).filter(Boolean));
        }
        else if (candidateMeta.priority === highestExisting.meta.priority) {
            return { ...baseResult, error: `${highestExisting.meta.name} already occupies this slot at the same priority.` };
        }
        else {
            return { ...baseResult, error: `${highestExisting.meta.name} has higher priority for this slot.` };
        }
    }
    baseResult.entriesToUpsert.push(candidateEntry);
    // In dry-run we only surface potential deletes but do not mutate
    return baseResult;
}
export function canAddCoRunningSubject(existingEntries, candidate, subjects) {
    const decision = applySchedulingRules({ existingEntries, candidateEntry: candidate, subjects, dryRun: true });
    return !decision.error;
}

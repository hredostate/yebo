export const filterAcademicClassesBySessionAndQuery = (academicClasses, sessionLabel, query) => {
    const lowerQuery = (query || '').trim().toLowerCase();
    return academicClasses
        .filter(ac => (sessionLabel ? ac.session_label === sessionLabel : true))
        .filter(ac => {
        if (!lowerQuery)
            return true;
        const haystack = `${ac.name} ${ac.arm || ''} ${ac.session_label} ${ac.level || ''}`.toLowerCase();
        return haystack.includes(lowerQuery);
    });
};

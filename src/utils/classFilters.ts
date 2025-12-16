import type { AcademicClass } from '../types.js';

export const filterAcademicClassesBySessionAndQuery = (
  academicClasses: AcademicClass[],
  sessionLabel?: string,
  query?: string
) => {
  const lowerQuery = (query || '').trim().toLowerCase();
  return academicClasses
    .filter(ac => (sessionLabel ? ac.session_label === sessionLabel : true))
    .filter(ac => {
      if (!lowerQuery) return true;
      const haystack = `${ac.name} ${ac.arm || ''} ${ac.session_label} ${ac.level || ''}`.toLowerCase();
      return haystack.includes(lowerQuery);
    });
};

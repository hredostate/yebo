/**
 * Shared utility functions for report card rendering
 */

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
export function getOrdinal(n: number | string | null | undefined): string {
  if (n == null || n === 'N/A') return '-';
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (isNaN(num)) return '-';
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Sanitize strings for HTML output
 */
export function sanitize(str: string | number | undefined | null): string {
  if (str == null) return '';
  const text = String(str);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Categorize assessment component scores into CA and Exam
 */
export function categorizeComponentScore(componentScores: Record<string, number>): { caScore: number; examScore: number } {
  let caScore = 0;
  let examScore = 0;
  
  Object.entries(componentScores).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('exam') || lowerKey.includes('test') || lowerKey.includes('final')) {
      examScore += value;
    } else {
      caScore += value;
    }
  });
  
  return { caScore, examScore };
}

/**
 * Get grade badge CSS class
 */
export function getGradeBadgeClass(grade: string): string {
  const firstChar = grade.charAt(0).toUpperCase();
  return `urc-grade-badge grade-${firstChar}`;
}

/**
 * Format position as "Xth of Y" or "N/A" if data unavailable
 */
export function formatPosition(position: number | string | null | undefined, total: number | string | null | undefined): string {
  if (position == null || position === 'N/A' || total == null || total === 'N/A') {
    return 'N/A';
  }
  const pos = typeof position === 'string' ? parseInt(position, 10) : position;
  const tot = typeof total === 'string' ? parseInt(total, 10) : total;
  if (isNaN(pos) || isNaN(tot)) return 'N/A';
  return `${getOrdinal(pos)} of ${tot}`;
}

/**
 * Check if valid ranking data exists
 */
export function hasValidRanking(position: number | string | null | undefined, total: number | string | null | undefined): boolean {
  if (position == null || position === 'N/A' || total == null || total === 'N/A') {
    return false;
  }
  const pos = typeof position === 'string' ? parseInt(position, 10) : position;
  const tot = typeof total === 'string' ? parseInt(total, 10) : total;
  return !isNaN(pos) && !isNaN(tot);
}

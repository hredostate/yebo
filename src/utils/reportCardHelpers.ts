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

/**
 * Calculate percentile rank from position and total
 * Formula: ((total - position + 1) / total) * 100
 * Example: Position 3 out of 45 = ((45 - 3 + 1) / 45) * 100 = 95.5%
 */
export function calculatePercentile(position: number | string | null | undefined, total: number | string | null | undefined): number | null {
  if (!hasValidRanking(position, total)) {
    return null;
  }
  const pos = typeof position === 'string' ? parseInt(position, 10) : position!;
  const tot = typeof total === 'string' ? parseInt(total, 10) : total!;
  return ((tot - pos + 1) / tot) * 100;
}

/**
 * Format percentile as "Top X%" for high performers or "Xth percentile" for others
 * - For 90th percentile and above: "Top X%" (e.g., "Top 5%", "Top 10%")
 * - For below 90th percentile: "Xth percentile" (e.g., "75th percentile")
 */
export function formatPercentile(percentile: number | null | undefined): string {
  if (percentile == null || isNaN(percentile)) {
    return 'N/A';
  }
  
  if (percentile >= 90) {
    const topPercentage = Math.ceil(100 - percentile);
    return `Top ${topPercentage}%`;
  } else {
    const rounded = Math.round(percentile);
    return `${getOrdinal(rounded)} percentile`;
  }
}

/**
 * Match component score using semantic/fuzzy matching
 * Handles component name variations and abbreviations
 * 
 * @param componentName - The component name from the class assessment structure (e.g., "FA", "SA")
 * @param componentScores - The subject's component scores object (e.g., {"Assessment 1": 20, "Assessment 2": 19})
 * @returns The matched score value or null if no match found
 */
export function matchComponentScore(
  componentName: string,
  componentScores: Record<string, number> | undefined | null
): number | null {
  // Return null if no component scores exist
  if (!componentScores) {
    return null;
  }
  
  // First try exact match
  if (componentScores[componentName] !== undefined && componentScores[componentName] !== null) {
    return componentScores[componentName];
  }
  
  // Try semantic/fuzzy matching
  const compNameLower = componentName.toLowerCase().trim();
  const compNameNormalized = compNameLower.replace(/[.\s-]/g, '');
  
  for (const [key, val] of Object.entries(componentScores)) {
    const keyLower = key.toLowerCase().trim();
    const keyNormalized = keyLower.replace(/[.\s-]/g, '');
    
    // Check for various matching patterns
    if (
      keyLower === compNameLower || // Exact case-insensitive match
      keyNormalized === compNameNormalized || // Normalized match (ignoring spaces, dots, hyphens)
      keyLower.includes(compNameLower) || // Component name is substring of key
      compNameLower.includes(keyLower) || // Key is substring of component name
      // Specific semantic matches
      (compNameNormalized === 'fa' && keyNormalized.includes('assessment1')) ||
      (compNameNormalized === 'sa' && keyNormalized.includes('assessment2')) ||
      (compNameNormalized === 'hw' && (keyNormalized.includes('homeactivity') || keyNormalized.includes('homework'))) ||
      (compNameNormalized === 'hol' && keyNormalized.includes('holiday')) ||
      (compNameNormalized === 'pro' && keyNormalized.includes('project')) ||
      (compNameNormalized === 'el' && keyNormalized.includes('elearning')) ||
      (compNameNormalized === 'eva' && keyNormalized.includes('evaluation'))
    ) {
      return val;
    }
  }
  
  // No match found
  return null;
}

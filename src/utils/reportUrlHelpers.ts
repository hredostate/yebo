/**
 * URL Utilities for Report Cards
 * Shared functions for generating human-friendly URLs
 */

/**
 * Create a URL-friendly slug from a student name
 * @param name - The student's full name
 * @returns A URL-safe slug (lowercase, hyphens, no special chars)
 */
export function createStudentSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/--+/g, '-')     // Replace multiple hyphens with single
        .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
}

/**
 * Generate a unique public report token
 * Uses crypto.randomUUID() if available, falls back to timestamp-based generation
 * @returns A unique token string
 */
export function generateReportToken(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return (crypto as any).randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Parse and sanitize public report token from the current URL location
 * Handles various URL formats and edge cases:
 * - /report/<token> (backward compatible)
 * - /report/<token>/<slug> (canonical with student name slug)
 * - Strips `:1` suffix, query params, hash fragments
 * - Removes forward slashes from token
 * 
 * @param location - Optional Location object (defaults to window.location)
 * @returns Sanitized token string, or empty string if invalid
 */
export function parsePublicReportTokenFromLocation(location?: Location): string {
    const loc = location || (typeof window !== 'undefined' ? window.location : null);
    if (!loc) return '';
    
    // Extract everything after /report/
    const reportPath = loc.pathname.split('/report/')[1];
    if (!reportPath) return '';
    
    // Take only the first path segment (before any /)
    const firstSegment = reportPath.split('/')[0];
    if (!firstSegment) return '';
    
    // Remove any :1 suffix, query params (?), or hash fragments (#)
    // Also handle other potential URL artifacts
    const cleanToken = firstSegment
        .split(/[?:#]/)[0]  // Remove query/hash/colon artifacts
        .trim()
        .replace(/\/$/, ''); // Remove trailing slash if any
    
    // Defensive: ensure token doesn't contain forward slashes
    // (This shouldn't happen after split, but extra safety)
    if (cleanToken.includes('/')) {
        console.warn('Token contains forward slash, extracting first part only');
        return cleanToken.split('/')[0];
    }
    
    return cleanToken;
}

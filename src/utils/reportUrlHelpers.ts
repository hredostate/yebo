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

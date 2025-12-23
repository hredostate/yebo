/**
 * SMS Helper Utilities
 * Utilities for sanitizing and formatting SMS content
 */

/**
 * Sanitize text for SMS to remove blocked keywords (years)
 * Kudi SMS blocks messages containing year patterns like "2025", "2024/2025"
 * 
 * This function removes:
 * - Academic year patterns in parentheses: (2024/2025)
 * - Academic year patterns without parentheses: 2024/2025
 * - Academic year patterns with dashes: 2024-2025
 * - Standalone years in range 2020-2039
 * 
 * @param text - The text to sanitize
 * @returns Sanitized text with year patterns removed
 */
export function sanitizeForSms(text: string): string {
    if (!text) return text;
    
    return text
        .replace(/\s*\(\d{4}\/\d{4}\)/g, '')  // Remove "(2024/2025)" patterns
        .replace(/\s*\d{4}\/\d{4}/g, '')       // Remove "2024/2025" patterns
        .replace(/\s*\d{4}-\d{4}/g, '')        // Remove "2024-2025" patterns
        .replace(/\b(202[0-9]|203[0-9])\b/g, '') // Remove standalone years 2020-2039
        .replace(/\s+/g, ' ')                  // Clean up extra spaces
        .trim();
}

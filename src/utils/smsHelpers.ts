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
 * - Standalone years in range 2020-2099 (covers academic years)
 * 
 * @param text - The text to sanitize
 * @returns Sanitized text with year patterns removed
 */
export function sanitizeForSms(text: string): string {
    if (!text) return text;
    
    return text
        // Remove academic year patterns in parentheses like "(2024/2025)"
        .replace(/\s*\(\d{4}\/\d{4}\)/g, '')
        // Remove academic year patterns with slash like "2024/2025"
        .replace(/\s*\b\d{4}\/\d{4}\b/g, '')
        // Remove academic year patterns with dash like "2024-2025"
        .replace(/\s*\b\d{4}-\d{4}\b/g, '')
        // Remove standalone years 2020-2099 (covers current and near future academic years)
        .replace(/\b(20[2-9][0-9]|210[0-9])\b/g, '')
        // Clean up extra spaces
        .replace(/\s+/g, ' ')
        .trim();
}

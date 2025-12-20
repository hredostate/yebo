/**
 * Utility functions for generating student admission numbers
 * Format: {CAMPUS}/{YY}/{NNNN}
 * Example: UPSS/25/0001, CAM/25/0123, CAGS/25/1234
 */

/**
 * Class name to campus mapping
 * Maps specific class names to their corresponding campus prefixes
 */
const CLASS_TO_CAMPUS: Record<string, string> = {
  // UPSS Campus classes
  'JSS 1': 'UPSS',
  'JSS 2': 'UPSS',
  'JSS 3': 'UPSS',
  'SS1': 'UPSS',
  'SS2': 'UPSS',
  'SS3': 'UPSS',
  
  // CAM Campus classes
  'Elementary 1': 'CAM',
  'Elementary 2': 'CAM',
  'Elementary 3': 'CAM',
  'Elementary 4': 'CAM',
  'Elementary 5': 'CAM',
  'Level 1': 'CAM',
  'Level 2': 'CAM',
  'Level 3': 'CAM',
  'Preschool': 'CAM',
  'Dahlia': 'CAM',
  'Tulip': 'CAM',
  
  // CAGS Campus classes
  'Grade 1': 'CAGS',
  'Grade 2': 'CAGS',
  'Grade 3': 'CAGS',
  'Grade 4': 'CAGS',
  'Grade 5': 'CAGS',
  'Kindergarten 1': 'CAGS',
  'Kindergarten 2': 'CAGS',
  'Kindergarten 3': 'CAGS',
  'Preschool A': 'CAGS',
  'Preschool B': 'CAGS',
};

/**
 * Get campus prefix from class name
 * @param className - The name of the class
 * @returns Campus prefix (UPSS, CAM, CAGS) or null if not found
 */
export function getCampusFromClassName(className: string): string | null {
  if (!className) return null;
  
  // Try exact match first
  if (CLASS_TO_CAMPUS[className]) {
    return CLASS_TO_CAMPUS[className];
  }
  
  // Try case-insensitive match
  const normalizedClassName = className.trim();
  const matchedKey = Object.keys(CLASS_TO_CAMPUS).find(
    key => key.toLowerCase() === normalizedClassName.toLowerCase()
  );
  
  return matchedKey ? CLASS_TO_CAMPUS[matchedKey] : null;
}

/**
 * Extract the sequential number from an admission number
 * @param admissionNumber - Admission number in format CAMPUS/YY/NNNN
 * @returns The sequential number or 0 if invalid
 */
function extractSequentialNumber(admissionNumber: string): number {
  if (!admissionNumber) return 0;
  
  const parts = admissionNumber.split('/');
  if (parts.length !== 3) return 0;
  
  const seqNum = parseInt(parts[2], 10);
  return isNaN(seqNum) ? 0 : seqNum;
}

/**
 * Get the current year in YY format
 * @returns Two-digit year string (e.g., "25" for 2025)
 */
function getCurrentYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  return year.toString().slice(-2);
}

/**
 * Find the next sequential number for a given campus prefix
 * @param campusPrefix - Campus prefix (UPSS, CAM, CAGS)
 * @param existingNumbers - Array of existing admission numbers
 * @returns The next sequential number (1-9999)
 */
function getNextSequentialNumber(campusPrefix: string, existingNumbers: string[]): number {
  const currentYear = getCurrentYear();
  const prefix = `${campusPrefix}/${currentYear}/`;
  
  // Filter admission numbers for the same campus and year
  const relevantNumbers = existingNumbers
    .filter(num => num && num.startsWith(prefix))
    .map(extractSequentialNumber)
    .filter(num => num > 0);
  
  // If no existing numbers, start at 1
  if (relevantNumbers.length === 0) {
    return 1;
  }
  
  // Find the maximum number and add 1
  const maxNumber = Math.max(...relevantNumbers);
  return maxNumber + 1;
}

/**
 * Format a sequential number with leading zeros
 * @param num - The sequential number (1-9999)
 * @returns Four-digit string with leading zeros (e.g., "0001", "0123", "1234")
 */
function formatSequentialNumber(num: number): string {
  return num.toString().padStart(4, '0');
}

/**
 * Generate an admission number for a student based on their class
 * @param className - The name of the student's class
 * @param existingNumbers - Array of all existing admission numbers in the school
 * @returns Generated admission number in format CAMPUS/YY/NNNN or null if class is not recognized
 * 
 * @example
 * generateAdmissionNumber('JSS 1', ['UPSS/25/0001', 'UPSS/25/0002'])
 * // Returns: 'UPSS/25/0003'
 * 
 * @example
 * generateAdmissionNumber('Elementary 1', [])
 * // Returns: 'CAM/25/0001'
 * 
 * @example
 * generateAdmissionNumber('Grade 5', ['CAGS/25/0099', 'CAGS/24/0001'])
 * // Returns: 'CAGS/25/0100'
 */
export function generateAdmissionNumber(
  className: string,
  existingNumbers: string[]
): string | null {
  // Get campus prefix from class name
  const campusPrefix = getCampusFromClassName(className);
  if (!campusPrefix) {
    console.warn(`Unable to determine campus for class: ${className}`);
    return null;
  }
  
  // Get current year in YY format
  const year = getCurrentYear();
  
  // Get next sequential number
  const seqNum = getNextSequentialNumber(campusPrefix, existingNumbers);
  
  // Validate sequential number is within range
  if (seqNum > 9999) {
    console.error(`Sequential number exceeded maximum for ${campusPrefix}/${year}`);
    return null;
  }
  
  // Format and return the admission number
  const formattedSeqNum = formatSequentialNumber(seqNum);
  return `${campusPrefix}/${year}/${formattedSeqNum}`;
}

/**
 * Check if an admission number is valid
 * @param admissionNumber - The admission number to validate
 * @returns true if valid, false otherwise
 */
export function isValidAdmissionNumber(admissionNumber: string): boolean {
  if (!admissionNumber) return false;
  
  const parts = admissionNumber.split('/');
  if (parts.length !== 3) return false;
  
  const [campus, year, seqNum] = parts;
  
  // Check campus prefix
  if (!['UPSS', 'CAM', 'CAGS'].includes(campus)) return false;
  
  // Check year (must be 2 digits)
  if (!/^\d{2}$/.test(year)) return false;
  
  // Check sequential number (must be 4 digits)
  if (!/^\d{4}$/.test(seqNum)) return false;
  
  return true;
}

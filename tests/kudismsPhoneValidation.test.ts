import assert from 'assert';

/**
 * Test utilities for phone number formatting and validation
 * These functions mirror the implementation in supabase/functions/kudisms-send/index.ts
 */

/**
 * Format phone number to Nigerian format (234XXXXXXXXXX)
 * Returns null for invalid inputs
 */
function formatPhoneNumber(phoneNumber: string | null | undefined): string | null {
  // Handle null/undefined/empty input
  if (!phoneNumber || phoneNumber.trim() === '') {
    return null;
  }
  
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // If doesn't start with 234, add it
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  
  // Validate the final formatted number is exactly 13 digits (234 + 10 digits)
  if (cleaned.length !== 13 || !cleaned.startsWith('234')) {
    return null;
  }
  
  return cleaned;
}

/**
 * Validate if a phone number is valid Nigerian format
 * Returns true if valid, false otherwise
 */
function validatePhoneNumber(phoneNumber: string | null | undefined): boolean {
  const formatted = formatPhoneNumber(phoneNumber);
  return formatted !== null;
}

// Test valid inputs
console.log('Testing valid phone numbers...');
assert.strictEqual(formatPhoneNumber('08012345678'), '2348012345678', 'Valid 11-digit number starting with 0');
assert.strictEqual(formatPhoneNumber('2348012345678'), '2348012345678', 'Valid 12-digit number with 234');
assert.strictEqual(formatPhoneNumber('+2348012345678'), '2348012345678', 'Valid number with + prefix');
assert.strictEqual(formatPhoneNumber('0803 456 7890'), '2348034567890', 'Valid number with spaces');
assert.strictEqual(formatPhoneNumber('080-345-67890'), '2348034567890', 'Valid number with hyphens');
assert.strictEqual(formatPhoneNumber('08123456789'), '2348123456789', 'Valid 11-digit number starting with 081');
assert.strictEqual(validatePhoneNumber('08012345678'), true, 'Validation: Valid number');

// Test invalid inputs - empty/null/undefined
console.log('Testing invalid phone numbers (empty/null/undefined)...');
assert.strictEqual(formatPhoneNumber(''), null, 'Empty string returns null');
assert.strictEqual(formatPhoneNumber('   '), null, 'Whitespace-only string returns null');
assert.strictEqual(formatPhoneNumber(null), null, 'Null input returns null');
assert.strictEqual(formatPhoneNumber(undefined), null, 'Undefined input returns null');
assert.strictEqual(validatePhoneNumber(''), false, 'Validation: Empty string is invalid');
assert.strictEqual(validatePhoneNumber(null), false, 'Validation: Null is invalid');

// Test invalid inputs - too short
console.log('Testing invalid phone numbers (too short)...');
assert.strictEqual(formatPhoneNumber('123'), null, 'Too short number returns null');
assert.strictEqual(formatPhoneNumber('0801234'), null, 'Incomplete number returns null');
assert.strictEqual(formatPhoneNumber('234801234'), null, 'Too short with 234 prefix returns null');
assert.strictEqual(validatePhoneNumber('123'), false, 'Validation: Too short is invalid');

// Test invalid inputs - too long
console.log('Testing invalid phone numbers (too long)...');
assert.strictEqual(formatPhoneNumber('080123456789012'), null, 'Too long number returns null');
assert.strictEqual(formatPhoneNumber('23480123456789'), null, 'Too long with 234 prefix returns null');
assert.strictEqual(validatePhoneNumber('080123456789012'), false, 'Validation: Too long is invalid');

// Test edge cases
console.log('Testing edge cases...');
assert.strictEqual(formatPhoneNumber('08012345678extra'), '2348012345678', 'Number with trailing text extracts valid digits');
assert.strictEqual(formatPhoneNumber('abc08012345678def'), '2348012345678', 'Number with surrounding text extracts valid digits');
assert.strictEqual(formatPhoneNumber('234'), null, 'Just "234" returns null');
assert.strictEqual(formatPhoneNumber('0'), null, 'Just "0" returns null');

console.log('All phone number validation tests passed!');

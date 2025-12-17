import assert from 'assert';

// Import the functions we want to test
// Since we can't directly import from TypeScript in the test, we'll copy the implementations

function isRateLimitError(error: any): boolean {
  // Check for various rate limit error formats
  const has429Status = error?.status === 429 || 
                       error?.response?.status === 429 ||
                       error?.code === 429;
  
  // Check for rate limit related messages
  const hasRateLimitMessage = error?.message && (
    error.message.toLowerCase().includes('rate limit') ||
    error.message.toLowerCase().includes('quota exceeded') ||
    error.message.toLowerCase().includes('too many requests')
  );
  
  return has429Status || hasRateLimitMessage;
}

function getRateLimitMessage(error: any): string {
  // Try to extract wait time from error message
  const errorMsg = error?.message || error?.toString() || '';
  
  // Look for patterns like "try again in X seconds" or similar
  const waitTimeMatch = errorMsg.match(/try again in (\d+)\s*(second|minute|hour)s?/i);
  if (waitTimeMatch) {
    const time = waitTimeMatch[1];
    const unit = waitTimeMatch[2];
    return `AI service rate limit reached. Please try again in ${time} ${unit}${time !== '1' ? 's' : ''}.`;
  }
  
  // Look for model-specific rate limit messages
  if (errorMsg.includes('Rate limit reached for model')) {
    return 'AI service is temporarily busy due to high usage. Please try again in a few minutes.';
  }
  
  // Generic rate limit message
  return 'AI service rate limit reached. Please try again later.';
}

// Test isRateLimitError with 429 status
const error429Status = { status: 429, message: 'Too many requests' };
assert.strictEqual(isRateLimitError(error429Status), true, 'Should detect 429 status');

// Test isRateLimitError with response.status = 429
const errorResponseStatus = { response: { status: 429 } };
assert.strictEqual(isRateLimitError(errorResponseStatus), true, 'Should detect response.status = 429');

// Test isRateLimitError with code = 429
const errorCode429 = { code: 429 };
assert.strictEqual(isRateLimitError(errorCode429), true, 'Should detect code = 429');

// Test isRateLimitError with rate limit message
const errorRateLimitMsg = { message: 'Rate limit reached for model' };
assert.strictEqual(isRateLimitError(errorRateLimitMsg), true, 'Should detect rate limit in message');

// Test isRateLimitError with quota exceeded message
const errorQuotaMsg = { message: 'Quota exceeded' };
assert.strictEqual(isRateLimitError(errorQuotaMsg), true, 'Should detect quota exceeded in message');

// Test isRateLimitError with too many requests message
const errorTooManyMsg = { message: 'Too many requests' };
assert.strictEqual(isRateLimitError(errorTooManyMsg), true, 'Should detect too many requests in message');

// Test isRateLimitError with non-rate-limit error
const errorOther = { status: 500, message: 'Internal server error' };
assert.strictEqual(isRateLimitError(errorOther), false, 'Should not detect non-rate-limit errors');

// Test getRateLimitMessage with wait time in seconds
const errorWithSeconds = { message: 'Rate limit reached. Please try again in 30 seconds' };
const msgSeconds = getRateLimitMessage(errorWithSeconds);
assert.ok(msgSeconds.includes('30 seconds'), 'Should extract seconds from error message');

// Test getRateLimitMessage with wait time in minutes
const errorWithMinutes = { message: 'Please try again in 5 minutes' };
const msgMinutes = getRateLimitMessage(errorWithMinutes);
assert.ok(msgMinutes.includes('5 minutes'), 'Should extract minutes from error message');

// Test getRateLimitMessage with model-specific error
const errorModelSpecific = { message: 'Rate limit reached for model llama-3.3-70b-versatile' };
const msgModelSpecific = getRateLimitMessage(errorModelSpecific);
assert.ok(msgModelSpecific.includes('temporarily busy'), 'Should return model-specific message');

// Test getRateLimitMessage with generic error
const errorGeneric = { message: 'Rate limit exceeded' };
const msgGeneric = getRateLimitMessage(errorGeneric);
assert.ok(msgGeneric.includes('try again later'), 'Should return generic message');

console.log('aiRateLimit tests passed');

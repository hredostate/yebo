/**
 * Test percentile-based position display functionality
 */

import { calculatePercentile, formatPercentile, hasValidRanking } from '../src/utils/reportCardHelpers.js';

console.log('=== Testing Percentile Functions ===\n');

// Test calculatePercentile
console.log('1. Testing calculatePercentile function:');
console.log('   Position 3 out of 45:', calculatePercentile(3, 45), '(Expected: ~95.56)');
console.log('   Position 1 out of 100:', calculatePercentile(1, 100), '(Expected: 100)');
console.log('   Position 50 out of 100:', calculatePercentile(50, 100), '(Expected: 51)');
console.log('   Position 90 out of 100:', calculatePercentile(90, 100), '(Expected: 11)');
console.log('   Position null:', calculatePercentile(null, 45), '(Expected: null)');
console.log('');

// Test formatPercentile
console.log('2. Testing formatPercentile function:');
console.log('   Percentile 100:', formatPercentile(100), '(Expected: "Top 0%")');
console.log('   Percentile 95.56:', formatPercentile(95.56), '(Expected: "Top 5%")');
console.log('   Percentile 91:', formatPercentile(91), '(Expected: "Top 9%")');
console.log('   Percentile 90:', formatPercentile(90), '(Expected: "Top 10%")');
console.log('   Percentile 89:', formatPercentile(89), '(Expected: "89th percentile")');
console.log('   Percentile 51:', formatPercentile(51), '(Expected: "51st percentile")');
console.log('   Percentile null:', formatPercentile(null), '(Expected: "N/A")');
console.log('');

// Test combined workflow
console.log('3. Testing combined workflow (position to formatted percentile):');
const testCases = [
  { position: 1, total: 45, expected: 'Top 0%' },
  { position: 2, total: 45, expected: 'Top 3%' },
  { position: 3, total: 45, expected: 'Top 5%' },
  { position: 5, total: 45, expected: 'Top 9%' },
  { position: 10, total: 45, expected: '80th percentile' },
  { position: 30, total: 45, expected: '36th percentile' },
  { position: 45, total: 45, expected: '2nd percentile' },
];

testCases.forEach(({ position, total, expected }) => {
  const percentile = calculatePercentile(position, total);
  const formatted = formatPercentile(percentile);
  const status = formatted === expected ? '✅' : '❌';
  console.log(`   ${status} Position ${position}/${total}: "${formatted}" (Expected: "${expected}")`);
});
console.log('');

// Test edge cases
console.log('4. Testing edge cases:');
console.log('   Invalid position (null):', formatPercentile(calculatePercentile(null, 45)), '(Expected: "N/A")');
console.log('   Invalid total (null):', formatPercentile(calculatePercentile(10, null)), '(Expected: "N/A")');
console.log('   String position "3":', formatPercentile(calculatePercentile("3", 45)), '(Expected: "Top 5%")');
console.log('   String total "45":', formatPercentile(calculatePercentile(3, "45")), '(Expected: "Top 5%")');
console.log('   Both strings "3"/"45":', formatPercentile(calculatePercentile("3", "45")), '(Expected: "Top 5%")');
console.log('');

console.log('✅ All percentile tests completed!\n');

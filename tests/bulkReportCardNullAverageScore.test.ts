/**
 * Test suite for BulkReportCardGenerator null averageScore handling
 * Ensures that averageScore checks handle both null and undefined values correctly
 */

import { strict as assert } from 'node:assert';

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn())
    .then(() => {
      console.log(`✓ ${name}`);
    })
    .catch((error) => {
      console.error(`✗ ${name}`);
      throw error;
    });
}

// Run all tests sequentially
(async () => {
  // Test 1: Verify CSV summary function uses proper null check
  await test('buildCsvSummary uses != null check for averageScore', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract buildCsvSummary function
    const buildCsvSummaryMatch = content.match(/const buildCsvSummary = \(studentsToSummarize: StudentWithDebt\[\]\) => \{[\s\S]+?\n  \};/);
    assert.ok(buildCsvSummaryMatch, 'Should find buildCsvSummary function');
    
    const functionBody = buildCsvSummaryMatch[0];
    
    // Check that it uses != null (not !== undefined)
    assert.ok(
      functionBody.includes('s.averageScore != null'),
      'buildCsvSummary should use != null check for averageScore'
    );
    
    // Ensure old check is removed
    assert.ok(
      !functionBody.includes('s.averageScore !== undefined'),
      'buildCsvSummary should not use !== undefined check for averageScore'
    );
  });

  // Test 2: Verify student list display uses proper null check
  await test('Student list display uses != null check for averageScore', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Find the display code that shows averageScore in the UI (around line 1177)
    // Looking for the pattern: student.averageScore and toFixed(1)
    const averageScoreDisplayPattern = /\{student\.averageScore\s+!=\s+null\s+&&\s+\([^}]+\.toFixed\(1\)/;
    
    assert.ok(
      averageScoreDisplayPattern.test(content),
      'Student display should use != null check for averageScore before calling toFixed()'
    );
    
    // Ensure the old pattern is not present
    const oldPattern = /\{student\.averageScore\s+!==\s+undefined\s+&&\s+\([^}]+\.toFixed\(1\)/;
    assert.ok(
      !oldPattern.test(content),
      'Student display should not use !== undefined check for averageScore'
    );
  });

  // Test 3: Verify no other uses of !== undefined with averageScore
  await test('No remaining !== undefined checks for averageScore', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Check for any remaining averageScore !== undefined patterns
    const remainingBadPatterns = content.match(/averageScore\s+!==\s+undefined/g);
    
    assert.ok(
      !remainingBadPatterns || remainingBadPatterns.length === 0,
      'Should not have any averageScore !== undefined checks remaining'
    );
  });

  // Test 4: Verify StudentWithDebt interface allows null averageScore
  await test('StudentWithDebt interface properly types averageScore as optional', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract StudentWithDebt interface
    const interfaceMatch = content.match(/interface StudentWithDebt extends Student \{[\s\S]+?\n\}/);
    assert.ok(interfaceMatch, 'Should find StudentWithDebt interface');
    
    const interfaceBody = interfaceMatch[0];
    
    // Check that averageScore is optional (has ? or is explicitly typed with | null | undefined)
    assert.ok(
      interfaceBody.includes('averageScore?:') || 
      interfaceBody.includes('averageScore: number | null') ||
      interfaceBody.includes('averageScore: number | undefined'),
      'StudentWithDebt interface should mark averageScore as optional or nullable'
    );
  });

  console.log('\nAll BulkReportCardGenerator null averageScore tests passed!');
})();

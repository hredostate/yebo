/**
 * Test suite for BulkReportCardGenerator Supabase client initialization fix
 * Ensures requireSupabaseClient() is properly called in all functions that use the database
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
  // Test 1: Verify requireSupabaseClient is imported in BulkReportCardGenerator
  await test('BulkReportCardGenerator imports requireSupabaseClient', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Check import statement
    assert.ok(
      content.includes("import { requireSupabaseClient } from '../services/supabaseClient'"),
      'Should import requireSupabaseClient from supabaseClient service'
    );
  });

  // Test 2: Verify fetchStudentData calls requireSupabaseClient
  await test('fetchStudentData function calls requireSupabaseClient()', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract fetchStudentData function
    const fetchStudentDataMatch = content.match(/const fetchStudentData = async \(\) => \{[^}]+\{[\s\S]+?\n  \};/);
    assert.ok(fetchStudentDataMatch, 'Should find fetchStudentData function');
    
    const functionBody = fetchStudentDataMatch[0];
    
    // Check that it calls requireSupabaseClient
    assert.ok(
      functionBody.includes('const supabase = requireSupabaseClient()'),
      'fetchStudentData should call requireSupabaseClient()'
    );
    
    // Check that old check is removed
    assert.ok(
      !functionBody.includes('if (!supabase)'),
      'fetchStudentData should not have old supabase check'
    );
  });

  // Test 3: Verify handleShareReportLinks calls requireSupabaseClient
  await test('handleShareReportLinks function calls requireSupabaseClient()', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract handleShareReportLinks function
    const handleShareMatch = content.match(/const handleShareReportLinks = async \(\) => \{[\s\S]+?^  \};/m);
    assert.ok(handleShareMatch, 'Should find handleShareReportLinks function');
    
    const functionBody = handleShareMatch[0];
    
    // Check that it calls requireSupabaseClient
    assert.ok(
      functionBody.includes('const supabase = requireSupabaseClient()'),
      'handleShareReportLinks should call requireSupabaseClient()'
    );
  });

  // Test 4: Verify renderReportCanvas already has requireSupabaseClient (unchanged)
  await test('renderReportCanvas function already uses requireSupabaseClient()', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract renderReportCanvas function
    const renderMatch = content.match(/const renderReportCanvas = async \([\s\S]+?\n  \};/);
    assert.ok(renderMatch, 'Should find renderReportCanvas function');
    
    const functionBody = renderMatch[0];
    
    // Check that it already calls requireSupabaseClient
    assert.ok(
      functionBody.includes('const supabase = requireSupabaseClient()'),
      'renderReportCanvas should already call requireSupabaseClient()'
    );
  });

  // Test 5: Verify no direct usage of undefined 'supabase' variable
  await test('No usage of undefined supabase variable', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'src/components/BulkReportCardGenerator.tsx');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Get all async functions that use supabase
    const asyncFunctions = content.match(/const \w+ = async \([^)]*\) => \{[\s\S]+?\n  \};/g) || [];
    
    for (const func of asyncFunctions) {
      // If function uses 'await supabase', it should have 'const supabase = requireSupabaseClient()'
      if (func.includes('await supabase') || func.match(/supabase\s*\./)) {
        // Skip if it's a parameter or property access on a different object
        if (func.includes('const supabase =') || func.includes('let supabase =')) {
          // This is fine - the function defines supabase locally
          continue;
        }
        
        // If we get here, the function uses supabase without defining it
        const funcName = func.match(/const (\w+) = async/)?.[1] || 'unknown';
        assert.fail(
          `Function ${funcName} uses supabase without calling requireSupabaseClient()`
        );
      }
    }
    
    assert.ok(true, 'All async functions properly initialize supabase');
  });

  console.log('\nAll BulkReportCardGenerator Supabase fix tests passed!');
})();

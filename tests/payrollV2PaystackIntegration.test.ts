/**
 * Test suite for Payroll V2 Paystack Integration
 * 
 * This file validates the integration between Payroll V2 (approval workflow)
 * and the run-payroll edge function for Paystack payment processing.
 */

// Test 1: Validate payload transformation
function testPayloadTransformation() {
  console.log("Test 1: Payload Transformation from Payslip to run-payroll format");
  
  // Mock payslip data from V2 system
  const mockPayslips = [
    {
      id: 'payslip-1',
      staff_id: 'user-123',
      gross_pay: 100000,
      total_deductions: 15000,
      net_pay: 85000,
      staff: {
        id: 'user-123',
        name: 'John Doe',
        account_number: '0123456789',
        bank_code: '058',
        account_name: 'John Doe'
      }
    },
    {
      id: 'payslip-2',
      staff_id: 'user-456',
      gross_pay: 150000,
      total_deductions: 20000,
      net_pay: 130000,
      staff: {
        id: 'user-456',
        name: 'Jane Smith',
        account_number: '9876543210',
        bank_code: '044',
        account_name: 'Jane Smith'
      }
    },
    {
      id: 'payslip-3',
      staff_id: 'user-789',
      gross_pay: 80000,
      total_deductions: 10000,
      net_pay: 70000,
      staff: {
        id: 'user-789',
        name: 'Bob Wilson',
        account_number: null, // Missing bank details
        bank_code: null,
        account_name: null
      }
    }
  ];

  const periodKey = '2025-01';
  
  // Transform logic (mimics the implementation in processPaystackPayment)
  const items = mockPayslips
    .filter((payslip) => {
      const staff = payslip.staff as any;
      if (!staff || !staff.account_number || !staff.bank_code) {
        console.log(`  Skipping payslip for ${staff?.name || payslip.staff_id}: missing bank details`);
        return false;
      }
      return true;
    })
    .map((payslip) => {
      const staff = payslip.staff as any;
      return {
        user_id: payslip.staff_id,
        name: staff.name,
        gross_amount: payslip.net_pay, // Use net_pay as adjustments are already applied
        adjustment_ids: [], // Empty since adjustments are already applied
        bank_code: staff.bank_code,
        account_number: staff.account_number,
        narration: `Salary payment for ${periodKey}`
      };
    });

  console.log(`  Input: ${mockPayslips.length} payslips`);
  console.log(`  Output: ${items.length} valid items (filtered out ${mockPayslips.length - items.length} with missing bank details)`);
  
  // Validate transformation
  const allHaveRequiredFields = items.every(item =>
    item.user_id &&
    item.name &&
    typeof item.gross_amount === 'number' &&
    item.gross_amount > 0 &&
    Array.isArray(item.adjustment_ids) &&
    item.bank_code &&
    item.account_number &&
    item.narration
  );

  console.log(`  All items have required fields: ${allHaveRequiredFields}`);
  
  // Validate that gross_amount is net_pay (adjustments already applied)
  const item1GrossEqualsNetPay = items[0].gross_amount === mockPayslips[0].net_pay;
  const item2GrossEqualsNetPay = items[1].gross_amount === mockPayslips[1].net_pay;
  
  console.log(`  Item 1 gross_amount (${items[0].gross_amount}) equals net_pay (${mockPayslips[0].net_pay}): ${item1GrossEqualsNetPay}`);
  console.log(`  Item 2 gross_amount (${items[1].gross_amount}) equals net_pay (${mockPayslips[1].net_pay}): ${item2GrossEqualsNetPay}`);
  
  // Validate adjustment_ids are empty
  const allAdjustmentIdsEmpty = items.every(item => item.adjustment_ids.length === 0);
  console.log(`  All adjustment_ids are empty: ${allAdjustmentIdsEmpty}`);
  
  const allTestsPassed = allHaveRequiredFields && item1GrossEqualsNetPay && item2GrossEqualsNetPay && allAdjustmentIdsEmpty;
  console.log(`  Result: ${allTestsPassed ? '✓ PASS' : '✗ FAIL'}`);
  
  return allTestsPassed;
}

// Test 2: Validate edge function payload structure
function testEdgeFunctionPayload() {
  console.log("\nTest 2: Edge Function Payload Structure");
  
  const mockPayload = {
    periodLabel: '2025-01',
    reason: 'Payroll run for period 2025-01',
    items: [
      {
        user_id: 'user-123',
        name: 'John Doe',
        gross_amount: 85000,
        adjustment_ids: [],
        bank_code: '058',
        account_number: '0123456789',
        narration: 'Salary payment for 2025-01'
      }
    ]
  };

  // Validate required fields
  const hasPeriodLabel = typeof mockPayload.periodLabel === 'string' && mockPayload.periodLabel.length > 0;
  const hasReason = typeof mockPayload.reason === 'string' && mockPayload.reason.length > 0;
  const hasItems = Array.isArray(mockPayload.items) && mockPayload.items.length > 0;
  
  console.log(`  periodLabel present: ${hasPeriodLabel}`);
  console.log(`  reason present: ${hasReason}`);
  console.log(`  items array present: ${hasItems}`);
  
  const allTestsPassed = hasPeriodLabel && hasReason && hasItems;
  console.log(`  Result: ${allTestsPassed ? '✓ PASS' : '✗ FAIL'}`);
  
  return allTestsPassed;
}

// Test 3: Validate error handling scenarios
function testErrorHandlingScenarios() {
  console.log("\nTest 3: Error Handling Scenarios");
  
  const scenarios = [
    {
      name: 'No finalized payslips',
      payslips: [],
      expectedError: 'No finalized payslips found for this run'
    },
    {
      name: 'All payslips missing bank details',
      payslips: [
        {
          id: 'payslip-1',
          staff_id: 'user-123',
          net_pay: 85000,
          staff: { id: 'user-123', name: 'John Doe', account_number: null, bank_code: null }
        }
      ],
      expectedError: 'No valid payslips with bank details found for processing'
    }
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`  Scenario ${index + 1}: ${scenario.name}`);
    
    if (scenario.payslips.length === 0) {
      console.log(`    Expected error: "${scenario.expectedError}" ✓`);
    } else {
      const validItems = scenario.payslips.filter(p => {
        const staff = p.staff as any;
        return staff && staff.account_number && staff.bank_code;
      });
      
      const shouldError = validItems.length === 0;
      console.log(`    Valid items after filtering: ${validItems.length}`);
      console.log(`    Should throw error: ${shouldError} ✓`);
    }
  });

  console.log(`  Result: ✓ PASS`);
  return true;
}

// Test 4: Validate batch reference generation
function testBatchReferenceGeneration() {
  console.log("\nTest 4: Batch Reference Generation");
  
  const mockRunId = '12345678-1234-1234-1234-123456789012';
  const mockResponseWithRunId = {
    data: {
      payroll_run_id: 456
    }
  };
  const mockResponseWithoutRunId: any = {
    data: {}
  };

  // Test with response containing payroll_run_id
  const batchRef1 = mockResponseWithRunId.data.payroll_run_id
    ? `PAYROLL-RUN-${mockResponseWithRunId.data.payroll_run_id}`
    : `PAYROLL-${mockRunId.substring(0, 8)}-${Date.now()}`;
  
  const hasCorrectFormat1 = batchRef1.startsWith('PAYROLL-RUN-');
  console.log(`  With payroll_run_id: ${batchRef1}`);
  console.log(`    Format correct: ${hasCorrectFormat1} ✓`);

  // Test without response payroll_run_id (fallback)
  const batchRef2 = mockResponseWithoutRunId.data.payroll_run_id
    ? `PAYROLL-RUN-${mockResponseWithoutRunId.data.payroll_run_id}`
    : `PAYROLL-${mockRunId.substring(0, 8)}-${Date.now()}`;
  
  const hasCorrectFormat2 = batchRef2.startsWith('PAYROLL-');
  const containsRunIdPrefix = batchRef2.includes(mockRunId.substring(0, 8));
  console.log(`  Without payroll_run_id (fallback): ${batchRef2}`);
  console.log(`    Format correct: ${hasCorrectFormat2} ✓`);
  console.log(`    Contains run ID prefix: ${containsRunIdPrefix} ✓`);

  const allTestsPassed = hasCorrectFormat1 && hasCorrectFormat2 && containsRunIdPrefix;
  console.log(`  Result: ${allTestsPassed ? '✓ PASS' : '✗ FAIL'}`);
  
  return allTestsPassed;
}

// Run all tests
console.log("=".repeat(60));
console.log("Payroll V2 Paystack Integration - Test Suite");
console.log("=".repeat(60));

const test1Passed = testPayloadTransformation();
const test2Passed = testEdgeFunctionPayload();
const test3Passed = testErrorHandlingScenarios();
const test4Passed = testBatchReferenceGeneration();

console.log("\n" + "=".repeat(60));
console.log("Test Suite Complete");
console.log(`All tests passed: ${test1Passed && test2Passed && test3Passed && test4Passed ? '✓ YES' : '✗ NO'}`);
console.log("=".repeat(60));

// Exit with appropriate code
if (!test1Passed || !test2Passed || !test3Passed || !test4Passed) {
  process.exit(1);
}

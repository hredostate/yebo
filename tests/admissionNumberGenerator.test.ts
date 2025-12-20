import assert from 'assert';
import { 
  generateAdmissionNumber, 
  getCampusFromClassName,
  isValidAdmissionNumber 
} from '../src/utils/admissionNumber.js';

type TestFn = () => void;
const test = (name: string, fn: TestFn) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
};

// Test getCampusFromClassName
test('getCampusFromClassName returns UPSS for JSS classes', () => {
  assert.equal(getCampusFromClassName('JSS 1'), 'UPSS');
  assert.equal(getCampusFromClassName('JSS 2'), 'UPSS');
  assert.equal(getCampusFromClassName('JSS 3'), 'UPSS');
});

test('getCampusFromClassName returns UPSS for SS classes', () => {
  assert.equal(getCampusFromClassName('SS1'), 'UPSS');
  assert.equal(getCampusFromClassName('SS2'), 'UPSS');
  assert.equal(getCampusFromClassName('SS3'), 'UPSS');
});

test('getCampusFromClassName returns CAM for Elementary classes', () => {
  assert.equal(getCampusFromClassName('Elementary 1'), 'CAM');
  assert.equal(getCampusFromClassName('Elementary 2'), 'CAM');
  assert.equal(getCampusFromClassName('Elementary 3'), 'CAM');
  assert.equal(getCampusFromClassName('Elementary 4'), 'CAM');
  assert.equal(getCampusFromClassName('Elementary 5'), 'CAM');
});

test('getCampusFromClassName returns CAM for Level classes', () => {
  assert.equal(getCampusFromClassName('Level 1'), 'CAM');
  assert.equal(getCampusFromClassName('Level 2'), 'CAM');
  assert.equal(getCampusFromClassName('Level 3'), 'CAM');
});

test('getCampusFromClassName returns CAM for Preschool and flower classes', () => {
  assert.equal(getCampusFromClassName('Preschool'), 'CAM');
  assert.equal(getCampusFromClassName('Dahlia'), 'CAM');
  assert.equal(getCampusFromClassName('Tulip'), 'CAM');
});

test('getCampusFromClassName returns CAGS for Grade classes', () => {
  assert.equal(getCampusFromClassName('Grade 1'), 'CAGS');
  assert.equal(getCampusFromClassName('Grade 2'), 'CAGS');
  assert.equal(getCampusFromClassName('Grade 3'), 'CAGS');
  assert.equal(getCampusFromClassName('Grade 4'), 'CAGS');
  assert.equal(getCampusFromClassName('Grade 5'), 'CAGS');
});

test('getCampusFromClassName returns CAGS for Kindergarten classes', () => {
  assert.equal(getCampusFromClassName('Kindergarten 1'), 'CAGS');
  assert.equal(getCampusFromClassName('Kindergarten 2'), 'CAGS');
  assert.equal(getCampusFromClassName('Kindergarten 3'), 'CAGS');
});

test('getCampusFromClassName returns CAGS for Preschool A/B', () => {
  assert.equal(getCampusFromClassName('Preschool A'), 'CAGS');
  assert.equal(getCampusFromClassName('Preschool B'), 'CAGS');
});

test('getCampusFromClassName handles case-insensitive matching', () => {
  assert.equal(getCampusFromClassName('jss 1'), 'UPSS');
  assert.equal(getCampusFromClassName('JSS 1'), 'UPSS');
  assert.equal(getCampusFromClassName('elementary 1'), 'CAM');
  assert.equal(getCampusFromClassName('ELEMENTARY 1'), 'CAM');
  assert.equal(getCampusFromClassName('grade 1'), 'CAGS');
  assert.equal(getCampusFromClassName('GRADE 1'), 'CAGS');
});

test('getCampusFromClassName returns null for unrecognized classes', () => {
  assert.equal(getCampusFromClassName('Unknown Class'), null);
  assert.equal(getCampusFromClassName(''), null);
  assert.equal(getCampusFromClassName('Form 1'), null);
});

// Test generateAdmissionNumber format
test('generateAdmissionNumber creates correct format for UPSS', () => {
  const result = generateAdmissionNumber('JSS 1', []);
  assert(result !== null);
  assert(result.startsWith('UPSS/'));
  assert(/^UPSS\/\d{2}\/\d{4}$/.test(result));
});

test('generateAdmissionNumber creates correct format for CAM', () => {
  const result = generateAdmissionNumber('Elementary 1', []);
  assert(result !== null);
  assert(result.startsWith('CAM/'));
  assert(/^CAM\/\d{2}\/\d{4}$/.test(result));
});

test('generateAdmissionNumber creates correct format for CAGS', () => {
  const result = generateAdmissionNumber('Grade 1', []);
  assert(result !== null);
  assert(result.startsWith('CAGS/'));
  assert(/^CAGS\/\d{2}\/\d{4}$/.test(result));
});

test('generateAdmissionNumber starts at 0001 with no existing numbers', () => {
  const result = generateAdmissionNumber('JSS 1', []);
  assert(result !== null);
  assert(result.endsWith('/0001'));
});

test('generateAdmissionNumber increments sequential number correctly', () => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  const existing = [
    `UPSS/${currentYear}/0001`,
    `UPSS/${currentYear}/0002`,
    `UPSS/${currentYear}/0003`,
  ];
  
  const result = generateAdmissionNumber('JSS 1', existing);
  assert(result !== null);
  assert.equal(result, `UPSS/${currentYear}/0004`);
});

test('generateAdmissionNumber handles gaps in sequential numbers', () => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  const existing = [
    `UPSS/${currentYear}/0001`,
    `UPSS/${currentYear}/0005`,
    `UPSS/${currentYear}/0003`,
  ];
  
  const result = generateAdmissionNumber('JSS 1', existing);
  assert(result !== null);
  assert.equal(result, `UPSS/${currentYear}/0006`); // Should be max + 1
});

test('generateAdmissionNumber ignores different campus numbers', () => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  const existing = [
    `UPSS/${currentYear}/0001`,
    `CAM/${currentYear}/0099`,  // Different campus
    `CAGS/${currentYear}/0050`, // Different campus
  ];
  
  const result = generateAdmissionNumber('JSS 1', existing);
  assert(result !== null);
  assert.equal(result, `UPSS/${currentYear}/0002`); // Only counts UPSS numbers
});

test('generateAdmissionNumber ignores different year numbers', () => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const lastYear = (parseInt(currentYear) - 1).toString().padStart(2, '0');
  
  const existing = [
    `UPSS/${currentYear}/0001`,
    `UPSS/${lastYear}/0099`,    // Different year
  ];
  
  const result = generateAdmissionNumber('JSS 1', existing);
  assert(result !== null);
  assert.equal(result, `UPSS/${currentYear}/0002`); // Only counts current year
});

test('generateAdmissionNumber formats numbers with leading zeros', () => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  const existing = [`UPSS/${currentYear}/0099`];
  
  const result = generateAdmissionNumber('JSS 1', existing);
  assert(result !== null);
  assert.equal(result, `UPSS/${currentYear}/0100`);
});

test('generateAdmissionNumber handles high sequential numbers', () => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  const existing = [`UPSS/${currentYear}/1234`];
  
  const result = generateAdmissionNumber('JSS 1', existing);
  assert(result !== null);
  assert.equal(result, `UPSS/${currentYear}/1235`);
});

test('generateAdmissionNumber returns null for unrecognized class', () => {
  const result = generateAdmissionNumber('Unknown Class', []);
  assert.equal(result, null);
});

test('generateAdmissionNumber handles empty existing numbers array', () => {
  const result = generateAdmissionNumber('JSS 1', []);
  assert(result !== null);
  assert(result.endsWith('/0001'));
});

test('generateAdmissionNumber handles invalid admission numbers in existing array', () => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  const existing = [
    `UPSS/${currentYear}/0001`,
    'INVALID',
    '',
    'UPSS/XX/YYYY',
    `UPSS/${currentYear}/0002`,
  ];
  
  const result = generateAdmissionNumber('JSS 1', existing);
  assert(result !== null);
  assert.equal(result, `UPSS/${currentYear}/0003`); // Should ignore invalid entries
});

test('generateAdmissionNumber works for all UPSS classes', () => {
  const upssClasses = ['JSS 1', 'JSS 2', 'JSS 3', 'SS1', 'SS2', 'SS3'];
  
  upssClasses.forEach(className => {
    const result = generateAdmissionNumber(className, []);
    assert(result !== null);
    assert(result.startsWith('UPSS/'));
  });
});

test('generateAdmissionNumber works for all CAM classes', () => {
  const camClasses = [
    'Elementary 1', 'Elementary 2', 'Elementary 3', 'Elementary 4', 'Elementary 5',
    'Level 1', 'Level 2', 'Level 3',
    'Preschool', 'Dahlia', 'Tulip'
  ];
  
  camClasses.forEach(className => {
    const result = generateAdmissionNumber(className, []);
    assert(result !== null);
    assert(result.startsWith('CAM/'));
  });
});

test('generateAdmissionNumber works for all CAGS classes', () => {
  const cagsClasses = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
    'Kindergarten 1', 'Kindergarten 2', 'Kindergarten 3',
    'Preschool A', 'Preschool B'
  ];
  
  cagsClasses.forEach(className => {
    const result = generateAdmissionNumber(className, []);
    assert(result !== null);
    assert(result.startsWith('CAGS/'));
  });
});

// Test isValidAdmissionNumber
test('isValidAdmissionNumber accepts valid UPSS numbers', () => {
  assert.equal(isValidAdmissionNumber('UPSS/25/0001'), true);
  assert.equal(isValidAdmissionNumber('UPSS/25/1234'), true);
  assert.equal(isValidAdmissionNumber('UPSS/99/9999'), true);
});

test('isValidAdmissionNumber accepts valid CAM numbers', () => {
  assert.equal(isValidAdmissionNumber('CAM/25/0001'), true);
  assert.equal(isValidAdmissionNumber('CAM/25/0123'), true);
});

test('isValidAdmissionNumber accepts valid CAGS numbers', () => {
  assert.equal(isValidAdmissionNumber('CAGS/25/0001'), true);
  assert.equal(isValidAdmissionNumber('CAGS/25/1234'), true);
});

test('isValidAdmissionNumber rejects invalid campus prefixes', () => {
  assert.equal(isValidAdmissionNumber('INVALID/25/0001'), false);
  assert.equal(isValidAdmissionNumber('UPS/25/0001'), false);
  assert.equal(isValidAdmissionNumber('UPSS2/25/0001'), false);
});

test('isValidAdmissionNumber rejects invalid year format', () => {
  assert.equal(isValidAdmissionNumber('UPSS/2025/0001'), false);
  assert.equal(isValidAdmissionNumber('UPSS/5/0001'), false);
  assert.equal(isValidAdmissionNumber('UPSS/XX/0001'), false);
});

test('isValidAdmissionNumber rejects invalid sequential number format', () => {
  assert.equal(isValidAdmissionNumber('UPSS/25/001'), false);   // Too short
  assert.equal(isValidAdmissionNumber('UPSS/25/00001'), false); // Too long
  assert.equal(isValidAdmissionNumber('UPSS/25/XXXX'), false);  // Not numeric
});

test('isValidAdmissionNumber rejects invalid formats', () => {
  assert.equal(isValidAdmissionNumber('UPSS-25-0001'), false);
  assert.equal(isValidAdmissionNumber('UPSS/25'), false);
  assert.equal(isValidAdmissionNumber('UPSS'), false);
  assert.equal(isValidAdmissionNumber(''), false);
  assert.equal(isValidAdmissionNumber('UPSS/25/0001/extra'), false);
});

test('generateAdmissionNumber generates unique numbers in batch', () => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const existing: string[] = [];
  const generated: string[] = [];
  
  // Generate 5 admission numbers in sequence
  for (let i = 0; i < 5; i++) {
    const result = generateAdmissionNumber('JSS 1', [...existing, ...generated]);
    assert(result !== null);
    generated.push(result);
  }
  
  // Check all are unique
  const uniqueSet = new Set(generated);
  assert.equal(uniqueSet.size, 5);
  
  // Check they are sequential
  assert.equal(generated[0], `UPSS/${currentYear}/0001`);
  assert.equal(generated[1], `UPSS/${currentYear}/0002`);
  assert.equal(generated[2], `UPSS/${currentYear}/0003`);
  assert.equal(generated[3], `UPSS/${currentYear}/0004`);
  assert.equal(generated[4], `UPSS/${currentYear}/0005`);
});

console.log('\n✅ All admission number generator tests passed!');

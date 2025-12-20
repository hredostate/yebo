import assert from 'assert';

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

// Helper function for flexible CSV header matching (same as in StudentListView.tsx)
const getColumnValue = (row: Record<string, string>, variations: string[]): string => {
  for (const variation of variations) {
    // Try exact match first
    if (row[variation] !== undefined) return row[variation];
    // Try case-insensitive match
    const key = Object.keys(row).find(k => k.toLowerCase().trim() === variation.toLowerCase().trim());
    if (key && row[key] !== undefined) return row[key];
  }
  return '';
};

// Define header variations for testing
const nameVariations = ['Name', 'name', 'Student Name', 'student_name', 'StudentName', 'Full Name', 'full_name', 'STUDENT NAME', 'NAME'];
const admissionVariations = ['Admission Number', 'admission_number', 'Admission No', 'admission_no', 'AdmissionNumber', 'Adm No', 'ID', 'Student ID', 'student_id', 'ADMISSION NUMBER'];
const emailVariations = ['Email', 'email', 'Email/Username', 'Username', 'username', 'EMAIL', 'E-mail', 'e-mail', 'Student Email'];
const classVariations = ['Class', 'class', 'Class Name', 'class_name', 'ClassName', 'Grade', 'grade', 'CLASS', 'Form'];

test('getColumnValue finds exact match', () => {
  const row = { 'Name': 'John Doe', 'Age': '15' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, 'John Doe');
});

test('getColumnValue finds case-insensitive match', () => {
  const row = { 'name': 'Jane Smith', 'Age': '16' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, 'Jane Smith');
});

test('getColumnValue finds variation match - Student Name', () => {
  const row = { 'Student Name': 'Alice Johnson', 'Age': '14' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, 'Alice Johnson');
});

test('getColumnValue finds variation match - student_name', () => {
  const row = { 'student_name': 'Bob Brown', 'Age': '15' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, 'Bob Brown');
});

test('getColumnValue finds variation match - STUDENT NAME', () => {
  const row = { 'STUDENT NAME': 'Charlie Davis', 'Age': '17' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, 'Charlie Davis');
});

test('getColumnValue finds variation match - Full Name', () => {
  const row = { 'Full Name': 'Diana Evans', 'Age': '16' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, 'Diana Evans');
});

test('getColumnValue returns empty string when no match', () => {
  const row = { 'Student': 'Eve Foster', 'Age': '15' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, '');
});

test('getColumnValue handles admission number variations', () => {
  const testCases: Array<{ row: Record<string, string>, expected: string }> = [
    { row: { 'Admission Number': 'ADM001' }, expected: 'ADM001' },
    { row: { 'admission_number': 'ADM002' }, expected: 'ADM002' },
    { row: { 'Admission No': 'ADM003' }, expected: 'ADM003' },
    { row: { 'ID': 'ADM004' }, expected: 'ADM004' },
    { row: { 'Student ID': 'ADM005' }, expected: 'ADM005' },
    { row: { 'ADMISSION NUMBER': 'ADM006' }, expected: 'ADM006' },
  ];

  testCases.forEach(({ row, expected }) => {
    const value = getColumnValue(row, admissionVariations);
    assert.equal(value, expected);
  });
});

test('getColumnValue handles email variations', () => {
  const testCases: Array<{ row: Record<string, string>, expected: string }> = [
    { row: { 'Email': 'test@example.com' }, expected: 'test@example.com' },
    { row: { 'email': 'user@example.com' }, expected: 'user@example.com' },
    { row: { 'Email/Username': 'admin@example.com' }, expected: 'admin@example.com' },
    { row: { 'Username': 'student@example.com' }, expected: 'student@example.com' },
    { row: { 'EMAIL': 'caps@example.com' }, expected: 'caps@example.com' },
    { row: { 'E-mail': 'hyphen@example.com' }, expected: 'hyphen@example.com' },
  ];

  testCases.forEach(({ row, expected }) => {
    const value = getColumnValue(row, emailVariations);
    assert.equal(value, expected);
  });
});

test('getColumnValue handles class variations', () => {
  const testCases: Array<{ row: Record<string, string>, expected: string }> = [
    { row: { 'Class': 'JSS 1' }, expected: 'JSS 1' },
    { row: { 'class': 'JSS 2' }, expected: 'JSS 2' },
    { row: { 'Class Name': 'JSS 3' }, expected: 'JSS 3' },
    { row: { 'Grade': 'SS 1' }, expected: 'SS 1' },
    { row: { 'CLASS': 'SS 2' }, expected: 'SS 2' },
    { row: { 'Form': 'SS 3' }, expected: 'SS 3' },
  ];

  testCases.forEach(({ row, expected }) => {
    const value = getColumnValue(row, classVariations);
    assert.equal(value, expected);
  });
});

test('getColumnValue handles mixed case with spaces', () => {
  const row = { '  Student Name  ': 'Grace Hill' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, 'Grace Hill');
});

test('getColumnValue prioritizes exact match over case-insensitive', () => {
  const row = { 'Name': 'First Match', 'name': 'Second Match' };
  const value = getColumnValue(row, nameVariations);
  assert.equal(value, 'First Match');
});

test('getColumnValue works with partial data', () => {
  const row = { 'Name': 'Henry Ivy' }; // Only name provided
  const name = getColumnValue(row, nameVariations);
  const email = getColumnValue(row, emailVariations);
  const className = getColumnValue(row, classVariations);
  
  assert.equal(name, 'Henry Ivy');
  assert.equal(email, '');
  assert.equal(className, '');
});

// Upsert logic tests
type Student = {
  id: number;
  name: string;
  admission_number?: string;
  email?: string;
  class_id?: number;
};

const findExistingStudent = (
  students: Student[],
  csvData: { admission_number?: string; email?: string }
): Student | undefined => {
  // First, try to match by admission_number if provided and non-empty
  if (csvData.admission_number?.trim()) {
    const byAdmission = students.find(s => 
      s.admission_number?.trim() && 
      s.admission_number.toLowerCase().trim() === csvData.admission_number!.toLowerCase().trim()
    );
    if (byAdmission) return byAdmission;
  }
  
  // If no match, try by email
  if (csvData.email?.trim()) {
    const byEmail = students.find(s => 
      s.email?.trim() && 
      s.email.toLowerCase().trim() === csvData.email!.toLowerCase().trim()
    );
    if (byEmail) return byEmail;
  }
  
  return undefined;
};

test('findExistingStudent matches by admission_number', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', admission_number: 'ADM001', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', admission_number: 'ADM002', email: 'jane@example.com' },
  ];
  
  const csvData = { admission_number: 'ADM001', email: 'different@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student');
  assert.equal(found!.id, 1);
  assert.equal(found!.name, 'John Doe');
});

test('findExistingStudent matches by admission_number case-insensitive', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', admission_number: 'ADM001', email: 'john@example.com' },
  ];
  
  const csvData = { admission_number: 'adm001' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student with case-insensitive match');
  assert.equal(found!.id, 1);
});

test('findExistingStudent falls back to email when admission_number not matched', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', admission_number: 'ADM001', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', admission_number: 'ADM002', email: 'jane@example.com' },
  ];
  
  const csvData = { admission_number: 'ADM999', email: 'jane@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student by email');
  assert.equal(found!.id, 2);
  assert.equal(found!.name, 'Jane Smith');
});

test('findExistingStudent matches by email when admission_number not provided', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ];
  
  const csvData = { email: 'john@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student by email only');
  assert.equal(found!.id, 1);
});

test('findExistingStudent matches email case-insensitive', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', email: 'John@Example.com' },
  ];
  
  const csvData = { email: 'john@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student with case-insensitive email match');
  assert.equal(found!.id, 1);
});

test('findExistingStudent returns undefined when no match', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', admission_number: 'ADM001', email: 'john@example.com' },
  ];
  
  const csvData = { admission_number: 'ADM999', email: 'notfound@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.equal(found, undefined, 'Should not find any student');
});

test('findExistingStudent handles students without admission_number or email', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ];
  
  const csvData = { admission_number: 'ADM001', email: 'jane@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student by email');
  assert.equal(found!.id, 2);
});

test('findExistingStudent prioritizes admission_number over email', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', admission_number: 'ADM001', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', admission_number: 'ADM002', email: 'john@example.com' }, // Same email
  ];
  
  const csvData = { admission_number: 'ADM002', email: 'john@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student');
  assert.equal(found!.id, 2, 'Should prioritize admission_number match over email');
  assert.equal(found!.name, 'Jane Smith');
});

test('findExistingStudent handles empty string admission_number', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
  ];
  
  const csvData = { admission_number: '', email: 'john@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student by email when admission_number is empty string');
  assert.equal(found!.id, 1);
});

test('findExistingStudent handles whitespace-only admission_number', () => {
  const students: Student[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
  ];
  
  const csvData = { admission_number: '   ', email: 'john@example.com' };
  const found = findExistingStudent(students, csvData);
  
  assert.ok(found, 'Should find student by email when admission_number is whitespace');
  assert.equal(found!.id, 1);
});

console.log('\nAll student CSV upload tests passed! ✓');

import { strict as assert } from 'node:assert';
import { parseCsv, findColumnByVariations } from '../src/utils/feesCsvUtils.js';
import { filterAcademicClassesBySessionAndQuery } from '../src/utils/classFilters.js';

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

test('parses BOM and quoted headers without dropping columns', () => {
  const csv = '\uFEFF"Student ID" , " Math Score " , "Remark"\n1,75,"Great"';
  const parsed = parseCsv(csv);

  assert.deepEqual(parsed.headers, ['Student ID', 'Math Score', 'Remark']);
  assert.equal(parsed.rows[0]['Math Score'], '75');
  assert.equal(parsed.rows[0]['Remark'], 'Great');
});

test('retains extra columns and trailing empty columns', () => {
  const csv = 'student_id,math,extra_col,\n2,88,meta,';
  const parsed = parseCsv(csv);

  assert.equal(parsed.headers.length, 4);
  assert.equal(parsed.rows[0]['extra_col'], 'meta');
  assert.strictEqual(parsed.rows[0][''], '');
});

test('identifies missing required student_id column via header map', () => {
  const csv = 'name,remark\nAda,Great';
  const parsed = parseCsv(csv);
  const headerMap = new Map(parsed.normalizedHeaders.map((h, idx) => [h, parsed.headers[idx]]));

  const studentIdColumn = findColumnByVariations(headerMap, ['student_id', 'student id']);
  assert.equal(studentIdColumn, undefined);
});

test('captures duplicate headers instead of overriding values', () => {
  const csv = 'score,score,student_id\n10,11,3';
  const parsed = parseCsv(csv);

  assert.ok(parsed.headers.includes('score (2)'));
  assert.ok(parsed.duplicateHeaders.includes('score'));
  assert.equal(parsed.rows[0]['score'], '10');
  assert.equal(parsed.rows[0]['score (2)'], '11');
});

test('keeps blank values for optional numeric fields', () => {
  const csv = 'student_id,math,remark\n4,, ';
  const parsed = parseCsv(csv);

  assert.equal(parsed.rows[0]['math'], '');
  assert.equal(parsed.rows[0]['remark'], '');
});

test('filters academic classes by session and search query', () => {
  const classes = [
    { id: 1, name: 'JSS 1 Gold (2023/2024)', arm: 'Gold', session_label: '2023/2024', level: 'JSS 1', is_active: true },
    { id: 2, name: 'JSS 2 Ruby (2022/2023)', arm: 'Ruby', session_label: '2022/2023', level: 'JSS 2', is_active: true },
    { id: 3, name: 'JSS 1 Silver (2023/2024)', arm: 'Silver', session_label: '2023/2024', level: 'JSS 1', is_active: true },
  ] as any;

  const filtered = filterAcademicClassesBySessionAndQuery(classes, '2023/2024', 'silver');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 3);

  const allCurrentSession = filterAcademicClassesBySessionAndQuery(classes, '2023/2024', '');
  assert.equal(allCurrentSession.length, 2);
});

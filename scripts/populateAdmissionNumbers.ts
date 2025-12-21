#!/usr/bin/env node
/**
 * Migration script to populate admission numbers for existing students
 * 
 * Usage:
 *   npm run migrate:admission-numbers         # Dry-run mode (default)
 *   npm run migrate:admission-numbers:live    # Live mode (applies changes)
 * 
 * Environment variables required:
 *   - SUPABASE_URL or VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { generateAdmissionNumber } from '../src/utils/admissionNumber.js';

// Parse command line arguments
const args = process.argv.slice(2);
const isLiveMode = args.includes('--live');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Required: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface Student {
  id: number;
  name: string;
  admission_number: string | null;
  class_id: number | null;
  school_id: number;
}

interface Class {
  id: number;
  name: string;
}

interface UpdateRecord {
  studentId: number;
  studentName: string;
  className: string;
  newAdmissionNumber: string;
}

interface SkipRecord {
  studentId: number;
  studentName: string;
  reason: string;
}

async function populateAdmissionNumbers() {
  console.log('\n=== Admission Number Migration Script ===\n');
  console.log(`Mode: ${isLiveMode ? '🔴 LIVE MODE (changes will be applied)' : '🟡 DRY-RUN MODE (no changes will be made)'}\n`);

  try {
    // Step 1: Fetch all existing admission numbers
    console.log('📊 Fetching existing admission numbers...');
    const { data: allStudents, error: allStudentsError } = await supabase
      .from('students')
      .select('admission_number')
      .not('admission_number', 'is', null)
      .neq('admission_number', '');

    if (allStudentsError) {
      throw new Error(`Failed to fetch existing admission numbers: ${allStudentsError.message}`);
    }

    const existingNumbers = allStudents
      .map(s => s.admission_number)
      .filter((num): num is string => !!num);

    console.log(`✓ Found ${existingNumbers.length} existing admission numbers\n`);

    // Step 2: Fetch all classes for lookup
    console.log('📚 Fetching class information...');
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name');

    if (classesError) {
      throw new Error(`Failed to fetch classes: ${classesError.message}`);
    }

    const classMap = new Map<number, string>();
    classes?.forEach((cls: Class) => {
      classMap.set(cls.id, cls.name);
    });

    console.log(`✓ Loaded ${classes?.length || 0} classes\n`);

    // Step 3: Find students without admission numbers
    console.log('🔍 Finding students without admission numbers...');
    const { data: studentsWithoutNumbers, error: studentsError } = await supabase
      .from('students')
      .select('id, name, admission_number, class_id, school_id')
      .or('admission_number.is.null,admission_number.eq.');

    if (studentsError) {
      throw new Error(`Failed to fetch students: ${studentsError.message}`);
    }

    console.log(`✓ Found ${studentsWithoutNumbers?.length || 0} students without admission numbers\n`);

    if (!studentsWithoutNumbers || studentsWithoutNumbers.length === 0) {
      console.log('✅ All students already have admission numbers. Nothing to do.\n');
      return;
    }

    // Step 4: Process students and generate admission numbers
    console.log('⚙️  Processing students...\n');

    const updates: UpdateRecord[] = [];
    const skipped: SkipRecord[] = [];
    const generatedNumbers = [...existingNumbers]; // Track all numbers to avoid duplicates

    for (const student of studentsWithoutNumbers as Student[]) {
      // Skip if no class assigned
      if (!student.class_id) {
        skipped.push({
          studentId: student.id,
          studentName: student.name,
          reason: 'No class assigned',
        });
        continue;
      }

      // Get class name
      const className = classMap.get(student.class_id);
      if (!className) {
        skipped.push({
          studentId: student.id,
          studentName: student.name,
          reason: `Class ID ${student.class_id} not found`,
        });
        continue;
      }

      // Generate admission number
      const newAdmissionNumber = generateAdmissionNumber(className, generatedNumbers);
      
      if (!newAdmissionNumber) {
        skipped.push({
          studentId: student.id,
          studentName: student.name,
          reason: `Unrecognized class name: ${className}`,
        });
        continue;
      }

      // Add to updates list
      updates.push({
        studentId: student.id,
        studentName: student.name,
        className: className,
        newAdmissionNumber: newAdmissionNumber,
      });

      // Track generated number to avoid duplicates in this batch
      generatedNumbers.push(newAdmissionNumber);
    }

    // Step 5: Display summary
    console.log('📋 Summary:');
    console.log(`   Total students without admission numbers: ${studentsWithoutNumbers.length}`);
    console.log(`   Students to update: ${updates.length}`);
    console.log(`   Students skipped: ${skipped.length}\n`);

    if (skipped.length > 0) {
      console.log('⚠️  Skipped students:');
      skipped.forEach(record => {
        console.log(`   - ID ${record.studentId}: ${record.studentName} (${record.reason})`);
      });
      console.log('');
    }

    if (updates.length > 0) {
      console.log('📝 Updates to be applied:');
      updates.forEach(record => {
        console.log(`   - ID ${record.studentId}: ${record.studentName} [${record.className}] → ${record.newAdmissionNumber}`);
      });
      console.log('');
    }

    // Step 6: Apply updates if in live mode
    if (isLiveMode) {
      if (updates.length === 0) {
        console.log('✅ No updates to apply.\n');
        return;
      }

      console.log('🚀 Applying updates to database...\n');

      let successCount = 0;
      let failureCount = 0;

      for (const update of updates) {
        try {
          const { error: updateError } = await supabase
            .from('students')
            .update({ admission_number: update.newAdmissionNumber })
            .eq('id', update.studentId);

          if (updateError) {
            console.error(`   ❌ Failed to update student ${update.studentId}: ${updateError.message}`);
            failureCount++;
          } else {
            console.log(`   ✓ Updated student ${update.studentId}: ${update.studentName} → ${update.newAdmissionNumber}`);
            successCount++;
          }
        } catch (error: any) {
          console.error(`   ❌ Failed to update student ${update.studentId}: ${error.message}`);
          failureCount++;
        }
      }

      console.log('\n📊 Results:');
      console.log(`   Successful updates: ${successCount}`);
      console.log(`   Failed updates: ${failureCount}\n`);

      if (failureCount > 0) {
        console.log('⚠️  Some updates failed. Please check the errors above.\n');
        process.exit(1);
      } else {
        console.log('✅ All updates applied successfully!\n');
      }
    } else {
      console.log('ℹ️  DRY-RUN MODE: No changes were made to the database.');
      console.log('   To apply these changes, run with --live flag:\n');
      console.log('   npm run migrate:admission-numbers:live\n');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
populateAdmissionNumbers()
  .then(() => {
    console.log('=== Migration Complete ===\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });

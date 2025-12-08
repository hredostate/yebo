# Database Migrations

This directory contains SQL migration scripts for the School Guardian 360 database.

## Purpose

These migrations are designed to update existing databases to include new features or fix issues without losing data. They should be run in order on your Supabase project.

## Available Migrations

### 1. add_transfer_tracking_columns.sql
Adds transfer tracking columns to the payroll_items table for Paystack integration.

**When to run**: If you're using the payroll feature with Paystack transfers.

### 2. add_student_record_id_to_student_profiles.sql
Adds the `student_record_id` column to the `student_profiles` table and links existing student profiles to their corresponding student records.

**When to run**: If you're getting the error "column student_record_id does not exist" when students try to access their accounts.

**What it does**:
- Adds the `student_record_id` column if it doesn't exist
- Links existing student_profiles to students records based on matching user_id
- Adds documentation comment to the column

### 3. fix_handle_new_user_trigger.sql
Updates the `handle_new_user()` trigger function to properly populate the `student_record_id` field when new student accounts are created.

**When to run**: After running `add_student_record_id_to_student_profiles.sql` to ensure future student accounts are properly linked.

**What it does**:
- Modifies the trigger to create students record first
- Then creates student_profiles with the correct student_record_id
- Ensures proper linking for new student accounts

### 4. 20250108_add_school_id_to_subjects.sql
Adds the `school_id` column to the `subjects` table with proper foreign key constraint.

**When to run**: If you're getting the error "Could not find the 'school_id' column of 'subjects' in the schema cache" when creating or managing subjects.

**What it does**:
- Dynamically finds the first available school_id (doesn't hard-code assumptions)
- Validates that at least one school exists before proceeding
- Adds the `school_id` column if it doesn't exist
- Sets existing subjects to use the first available school_id
- Makes column NOT NULL to enforce data integrity
- Adds foreign key constraint to schools table with idempotency check
- Notifies PostgREST to reload the schema cache

## How to Apply Migrations

### Using Supabase Dashboard

1. Log in to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of each migration file (in order)
4. Paste into the SQL Editor
5. Click "Run" to execute the migration
6. Verify the migration succeeded by checking for success messages

### Using Supabase CLI

```bash
# Apply a specific migration
supabase db push

# Or apply migrations one by one
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/add_student_record_id_to_student_profiles.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/fix_handle_new_user_trigger.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20250108_add_school_id_to_subjects.sql
```

## Migration Order

**Important**: Run migrations in this recommended order based on dependencies:

1. `add_transfer_tracking_columns.sql` (optional, only if using payroll)
2. `add_student_record_id_to_student_profiles.sql` (required for student account fix)
3. `fix_handle_new_user_trigger.sql` (required for student account fix)
4. `20250108_add_school_id_to_subjects.sql` (required if getting subjects schema cache error)
5. `20250101_add_auth_user_deletion_trigger.sql` (optional, for auth user cleanup)
6. `20250107_add_webhook_events_table.sql` (optional, for webhook event logging)

Note: Migrations are ordered by dependency rather than date to ensure proper application sequence.

## Troubleshooting

### Error: column already exists
If you see "column already exists", it means the migration has already been applied or the column exists in your schema. This is safe to ignore.

### Error: relation does not exist
Make sure you've run the main `database_schema.sql` file first to create all tables.

### Verifying the Fix

After running the migrations, you can verify the fix by:

### Using the Diagnostic Script (Recommended)

Run the `diagnostic_student_record_id.sql` script in your Supabase SQL Editor. This comprehensive script will:
- Check if the column exists
- Count linked and unlinked student profiles
- Verify the trigger function is up to date
- Show sample data with linkage status
- Provide a summary with actionable recommendations

```sql
-- Just run the entire diagnostic_student_record_id.sql file
```

### Manual Verification Queries

1. Checking that the column exists:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'student_profiles' 
AND column_name = 'student_record_id';
```

2. Checking that existing records are linked:
```sql
SELECT 
    sp.id, 
    sp.full_name, 
    sp.student_record_id,
    s.name as student_name
FROM student_profiles sp
LEFT JOIN students s ON s.id = sp.student_record_id
LIMIT 10;
```

3. Testing student login and verifying no SQL errors appear.

## Need Help?

If you encounter issues applying these migrations, please check:
- You have the correct database permissions (SUPERUSER or table owner)
- You're connected to the correct database
- The main schema has been applied first

For additional support, refer to the main README.md or contact the development team.

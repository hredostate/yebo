# Subjects Table Schema Fix

## Issue
When attempting to create or manage subjects in the application, users encountered the following error:

```
Could not find the 'school_id' column of 'subjects' in the schema cache
```

This error occurred because the `subjects` table was missing the `school_id` column that is required for multi-tenancy support.

## Root Cause
The `subjects` table is defined with a `school_id` column in the main `database_schema.sql` file, but:
1. Some existing databases may have been created before this column was added to the schema
2. There was no migration file to add this column to existing deployments
3. The application code (in `src/App.tsx`) attempts to insert subjects with `school_id`, causing the error

## Solution
Created migration file `20250108_add_school_id_to_subjects.sql` that:
- Checks if the `school_id` column exists before attempting to add it
- Adds the column if it doesn't exist
- Sets existing subjects to use `school_id = 1` (the default school)
- Adds the foreign key constraint to the `schools` table
- Notifies PostgREST to reload the schema cache

## How to Apply the Fix

### Option 1: Using Supabase Dashboard (Recommended)
1. Log in to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `supabase/migrations/20250108_add_school_id_to_subjects.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute the migration
6. You should see a success message: "Added school_id column to subjects table and set default values"

### Option 2: Using Supabase CLI
```bash
# Navigate to your project directory
cd /path/to/Updated-360

# Apply the migration
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20250108_add_school_id_to_subjects.sql
```

### Option 3: Manual Schema Cache Reload
If you prefer to manually reload the schema cache after any schema changes, you can use:
```sql
NOTIFY pgrst, 'reload schema';
```
to force PostgREST to reload the schema cache.

## Verification
After applying the migration, verify the fix by:

1. **Check that the column exists:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'subjects' 
AND column_name = 'school_id';
```

2. **Check existing subjects have school_id set:**
```sql
SELECT id, name, school_id 
FROM subjects 
LIMIT 10;
```

3. **Test creating a new subject:**
   - Log in to the application as an admin
   - Navigate to the Subjects management section
   - Try creating a new subject
   - The operation should succeed without errors

## Related Files
- Migration: `supabase/migrations/20250108_add_school_id_to_subjects.sql`
- Schema Definition: `database_schema.sql` (line 161-165)
- Application Code: `src/App.tsx` (line ~4017, handleSaveSubject function)

## Multi-Tenancy Note
The `school_id` column is critical for multi-tenancy support in School Guardian 360. It ensures that:
- Each subject is associated with a specific school
- Subjects from different schools remain isolated
- Cascading deletes work correctly when a school is removed

## Troubleshooting

### Error: "column already exists"
If you see this error, it means the migration has already been applied or your database already has the column. This is safe to ignore.

### Error: "relation does not exist"
Make sure you've run the main `database_schema.sql` file first to create all tables.

### Still getting schema cache errors?
Try manually reloading the PostgREST schema cache:
```sql
NOTIFY pgrst, 'reload schema';
```

Or restart your Supabase project from the dashboard (Settings → General → Restart project).

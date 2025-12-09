# Score Review Feature - Implementation Summary

## Overview
This feature enables Team Leaders and Admins to view, review, and edit all scores entered by teachers across the school. It provides full transparency and accountability through audit logging of all changes.

## Key Features

### 1. **Score Visibility**
- Team Leaders and Admins can now view ALL teacher-entered scores
- Scores are displayed with clear attribution showing which teacher entered them
- Filter and search capabilities for easy navigation

### 2. **Edit Capability**
- Authorized users (Team Lead, Principal, Admin) can edit any score entry
- Inline editing interface for quick corrections
- All edits are tracked and logged

### 3. **Audit Trail**
- Every score entry and modification is logged
- Tracks:
  - Original teacher who entered the score
  - Last person to modify the score
  - Before and after values for all changes
  - Timestamps for creation and modifications
- Logs are stored in the `audit_log` table

### 4. **Filtering & Search**
- Filter by:
  - Term
  - Class
  - Subject
  - Teacher (who entered the score)
- Search by student name, subject, or teacher name

## Permissions

### New Permissions Added
1. `score_entries.view_all` - View all teacher-entered scores
2. `score_entries.edit_all` - Edit any score entry

### Roles with Access
- **Admin**: Full access (wildcard `*` permission includes all)
- **Principal**: Can view and edit all scores
- **Team Lead**: Can view and edit all scores
- **Teacher**: Can only edit their own scores (existing `score_entries.edit_self` permission)

## Database Changes

### New Columns Added to `score_entries` Table
```sql
- entered_by_user_id (UUID) - References the teacher who originally entered the score
- last_modified_by_user_id (UUID) - References the last person to modify the score
- created_at (TIMESTAMP) - When the score was first entered
- updated_at (TIMESTAMP) - When the score was last modified
```

### Database Triggers
1. **Auto-update Timestamp Trigger**: Automatically updates `updated_at` on every modification
2. **Audit Logging Trigger**: Automatically logs all INSERT and UPDATE operations to `audit_log` table

## How to Use

### For Team Leaders/Admins

1. **Access the Score Review Page**
   - Navigate to Academics → Score Review in the sidebar
   - Only visible if you have `score_entries.view_all` permission

2. **Filter and Find Scores**
   - Use the filter dropdowns to narrow down by term, class, subject, or teacher
   - Use the search bar to find specific students or subjects

3. **Review Scores**
   - View all component scores (CA, Exam, etc.)
   - See total scores and grades
   - Check who entered each score
   - See if scores were modified and by whom

4. **Edit Scores (if needed)**
   - Click the edit icon (pencil) next to any score entry
   - Modify component scores inline
   - Click the checkmark to save or X to cancel
   - All changes are automatically logged

### For Teachers

Teachers continue to use the existing "My Gradebook" and "Teacher Score Entry" views to enter and manage scores for their assigned classes. When they save scores:
- Their user ID is automatically recorded as `entered_by_user_id`
- If they later edit their own scores, they are also recorded as `last_modified_by_user_id`

## Migration Instructions

### To Apply This Feature to Your Database

1. **Run the Migration Script**
   ```bash
   # Connect to your Supabase project and run:
   supabase/migrations/20251209_add_score_review_permissions.sql
   ```

   Or via Supabase Dashboard:
   - Go to SQL Editor
   - Copy the contents of `supabase/migrations/20251209_add_score_review_permissions.sql`
   - Execute the SQL

2. **Verify Migration Success**
   - Check that `score_entries` table has the new columns
   - Verify triggers are created
   - Check that roles have updated permissions

## UI Components

### ScoreReviewView Component
Location: `src/components/ScoreReviewView.tsx`

Features:
- Responsive table layout
- Inline editing
- Permission-based access control
- Dark mode support
- Real-time filtering and search

### Navigation
- Added "Score Review" menu item in Sidebar under Academics section
- Only visible to users with appropriate permissions

## Security Considerations

### Row Level Security (RLS)
- RLS policies allow all authenticated users to read `score_entries`
- Write operations are controlled at the application level via permissions
- Audit logs are created server-side via database triggers, preventing tampering

### Permission Checks
- Frontend checks permissions before showing edit buttons
- Backend validates permissions on all update operations
- Double validation ensures security

## Audit Log Structure

When a score is edited, the audit log entry contains:
```json
{
  "score_entry_id": 123,
  "student_id": 456,
  "subject_name": "Mathematics",
  "term_id": 1,
  "academic_class_id": 5,
  "component_scores_old": {"CA": 30, "Exam": 50},
  "component_scores_new": {"CA": 35, "Exam": 55},
  "total_score_old": 80,
  "total_score_new": 90,
  "grade_old": "B",
  "grade_new": "A",
  "entered_by_user_id": "teacher-uuid",
  "modified_by_user_id": "team-lead-uuid"
}
```

## Testing Checklist

- [ ] Team Lead can access Score Review page
- [ ] Principal can access Score Review page
- [ ] Admin can access Score Review page
- [ ] Teacher cannot see Score Review in sidebar
- [ ] Filters work correctly (term, class, subject, teacher)
- [ ] Search functionality works
- [ ] Inline editing saves correctly
- [ ] Audit logs are created on edits
- [ ] Teacher attribution is displayed correctly
- [ ] Modification history shows when score was edited by different user
- [ ] Teachers can still use their regular gradebook
- [ ] Scores entered by teachers show their name in Score Review

## Future Enhancements

Potential improvements for future iterations:
1. Bulk edit capability
2. Export filtered scores to Excel/PDF
3. Score comparison view (before/after)
4. Notification system when scores are edited
5. Comments/notes on edits explaining why changes were made
6. Approval workflow for score changes
7. Version history view showing all changes to a single score over time

## Support

If you encounter any issues:
1. Check that the migration has been applied correctly
2. Verify user roles have the correct permissions
3. Check browser console for any JavaScript errors
4. Verify database triggers are active
5. Review audit logs to debug permission issues

## Technical Details

### Key Files Modified/Created
- `src/components/ScoreReviewView.tsx` - Main UI component
- `src/components/AppRouter.tsx` - Added route
- `src/components/Sidebar.tsx` - Added navigation item
- `src/constants/index.ts` - Added permissions and view constant
- `src/types.ts` - Updated ScoreEntry interface
- `src/App.tsx` - Added handleUpdateScore function
- `database_schema.sql` - Updated schema and role permissions
- `supabase/migrations/20251209_add_score_review_permissions.sql` - Migration script
- `src/components/common/icons.tsx` - Added FilterIcon

### Dependencies
- No new external dependencies required
- Uses existing Supabase client for database operations
- Leverages existing UI components and styling

## Conclusion

This feature provides complete transparency and control over student score management, enabling administrative staff to monitor and correct scores while maintaining full accountability through comprehensive audit logging.

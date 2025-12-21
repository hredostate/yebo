# Student Subject Selection Lock System & Elective Limits

## Overview

This feature enhances the student subject selection system with automatic locking and optional capacity management for elective subjects.

## Key Features

### 1. Auto-Lock on Save
When students save their subject choices, the selections are automatically locked to prevent further modifications. This ensures stability in academic planning and enrollment counts.

**Student Experience:**
- Select subjects normally
- Click "Save Choices"
- Choices are automatically locked
- See lock banner: "🔒 Your subject selections are locked"
- Save button is hidden when locked
- All checkboxes are disabled when locked
- Message: "Contact your class teacher or admin to request changes"

### 2. Admin Lock/Unlock Controls

**Individual Student Control:**
- Lock Status column shows 🔒 (Locked) or 🔓 (Unlocked)
- "Lock" button appears for unlocked students with choices
- "Unlock" button appears for locked students
- Admin ID is tracked when manually locking/unlocking

**Bulk Actions:**
- Select multiple students via checkboxes
- "🔒 Lock All" - locks all selected students
- "🔓 Unlock All" - unlocks all selected students
- Confirmation dialog before bulk operations
- Toast notifications for success/failure
- Visual indication of locked rows (subtle background tint)

### 3. Optional Elective Subject Capacity Limits

**Purpose:**
- Limit enrollment in specific elective subjects
- Balance class sizes
- Manage resource constraints
- NULL max_students = unlimited enrollment

**Admin Interface (ElectiveSubjectLimitsManager):**
- Filter by Class and Arm
- View all elective subjects for selected class/arm
- See current enrollment count
- Set max_students limit (or leave blank for unlimited)
- Quick actions: "Set All to 20", "Set All to 30", "Clear All Limits"
- Real-time status indicators:
  - Green: Available slots
  - Amber: Near capacity (≥80% full)
  - Red: Full (at capacity)
  - Gray: Unlimited

**Student Experience:**
- Elective subjects with limits show "X/Y enrolled"
- Full subjects display "Full" badge
- Full subjects are disabled (cannot be selected)
- Students who already selected a subject before it became full keep their selection
- Error toast if attempting to select a full subject

### 4. CSV Export Enhancement

Export includes:
- Lock Status (Locked/Unlocked)
- For electives with limits: Capacity column showing "12/15" or "Unlimited"
- All existing fields (student info, subjects, dates)

## Database Schema

### New Columns in `student_subject_choices`
- `locked_at` (TIMESTAMPTZ): When choices were locked
- `locked_by` (UUID): Admin who locked/unlocked (NULL = auto-locked by student)

### New Table: `elective_subject_limits`
```sql
id SERIAL PRIMARY KEY
school_id INTEGER (FK to schools)
class_id INTEGER (FK to classes)
arm_id INTEGER (FK to arms, nullable)
subject_id INTEGER (FK to subjects)
max_students INTEGER (NULL = unlimited)
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(school_id, class_id, arm_id, subject_id)
```

## Helper Functions

### `get_elective_enrollment_count(subject_id, class_id, arm_id)`
Returns the current number of active students who have selected a specific elective subject.

### `is_elective_at_capacity(subject_id, class_id, arm_id)`
Returns boolean indicating whether an elective subject has reached its enrollment limit.

## Service Layer API

### `lockStudentChoices(studentId, adminId?)`
Locks all subject choices for a student. AdminId is optional (null = auto-lock).

### `unlockStudentChoices(studentId, adminId)`
Unlocks subject choices for a student. Requires admin ID for audit trail.

### `bulkLockChoices(studentIds[], adminId?)`
Locks choices for multiple students at once.

### `bulkUnlockChoices(studentIds[], adminId)`
Unlocks choices for multiple students at once.

### `getStudentChoicesLockStatus(studentId)`
Returns boolean indicating if student's choices are locked.

### `getElectiveCapacityInfo(classId, armId, schoolId)`
Returns array of elective capacity information including current enrollment and limits.

### `canSelectElective(studentId, subjectId, classId, armId)`
Checks if a student can select a specific elective (capacity check).

## Usage Workflow

### For Students:
1. Navigate to "My Subjects" tab
2. Select desired subjects (compulsory subjects are pre-selected and locked)
3. See capacity info for electives: "Physics (12/15)"
4. Cannot select electives marked "Full"
5. Click "Save Choices" - auto-locks selections
6. To make changes, contact teacher/admin

### For Admins:
1. **View Status**: Navigate to Student Subject Choices admin view
2. **Individual Lock/Unlock**: Click button in Actions column
3. **Bulk Operations**:
   - Select students using checkboxes
   - Click "Lock All" or "Unlock All"
   - Confirm in dialog
4. **Manage Capacity** (Optional):
   - Navigate to Elective Subject Limits Manager
   - Select Class and optionally Arm
   - Set max_students for each elective (or leave blank for unlimited)
   - Click "Save Changes"

## Migration

Run the migration file: `supabase/migrations/20251221_add_elective_subject_limits.sql`

This will:
- Add new columns to `student_subject_choices`
- Create `elective_subject_limits` table
- Add indexes for performance
- Create helper functions
- Set up RLS policies

## Components

### Modified:
- `src/components/StudentPortal.tsx` - Lock UI, capacity display
- `src/components/admin/StudentSubjectChoicesView.tsx` - Lock controls, bulk actions
- `src/types.ts` - New interfaces
- `src/databaseSchema.ts` - Schema updates
- `src/components/common/icons.tsx` - Added LockOpenIcon

### New:
- `src/services/studentSubjectChoiceService.ts` - Service layer
- `src/components/admin/ElectiveSubjectLimitsManager.tsx` - Capacity manager UI
- `supabase/migrations/20251221_add_elective_subject_limits.sql` - Database migration

## Security

- RLS policies enable authenticated access to all related tables
- Audit trail via `locked_by` field tracks who locked/unlocked
- Students cannot unlock their own choices (enforced in UI and service layer)
- Only admins can access ElectiveSubjectLimitsManager

## Performance Considerations

- Indexes added for:
  - `student_subject_choices(student_id, locked)`
  - `student_subject_choices(locked_at)`
  - `elective_subject_limits(school_id, class_id, arm_id, subject_id)`
  - `elective_subject_limits(subject_id)`

- Database functions (`get_elective_enrollment_count`, `is_elective_at_capacity`) marked as STABLE for query optimization

## Future Enhancements

- Email/SMS notifications when choices are locked/unlocked
- Waitlist functionality for full electives
- Automated capacity balancing suggestions
- Historical tracking of lock/unlock events
- Student request system for changes (with workflow approval)

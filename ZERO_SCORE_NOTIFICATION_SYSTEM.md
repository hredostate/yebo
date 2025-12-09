# Zero Score Notification System

## Overview
The Zero Score Notification System automatically tracks and notifies administrators when teachers enter zero scores in the gradebook. This helps school administrators and team leaders monitor scoring patterns, follow up with teachers, and ensure data accuracy.

## Features

### 1. Automatic Detection
- Detects when a score of **0** is explicitly entered (distinguishes from null/undefined)
- Tracks zero scores in individual assessment components (CA, Exam, etc.)
- Records the total score along with component information

### 2. Notification System
- **Automatic Notifications**: Sends real-time notifications to:
  - Admins
  - Team Leads
  - Principals
- Notifications include the number of students affected and the teacher who entered the scores

### 3. Zero Score Monitor Dashboard
Accessible from: **Sidebar → Academics → Zero Score Monitor**

#### Statistics Overview
- Total zero score entries
- Unreviewed entries count
- Reviewed entries count

#### Advanced Filters
- **Review Status**: All, Unreviewed, Reviewed
- **Teacher**: Filter by specific teacher
- **Subject**: Filter by subject name
- **Term**: Filter by academic term
- **Date Range**: Filter by entry date (from/to)

#### Review Workflow
1. Admin/Team Leader views zero score entry details
2. Reviews the context (student, subject, class, teacher comment)
3. Adds review notes if needed
4. Marks entry as reviewed
5. Can remove review status if needed

## Database Schema

### Table: `zero_score_entries`

```sql
CREATE TABLE public.zero_score_entries (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id),
    term_id INTEGER REFERENCES terms(id),
    academic_class_id INTEGER REFERENCES academic_classes(id),
    subject_name TEXT NOT NULL,
    student_id INTEGER REFERENCES students(id),
    teacher_user_id UUID REFERENCES user_profiles(id),
    component_name TEXT,              -- e.g., "CA", "Exam", or NULL for total
    total_score NUMERIC NOT NULL,     -- Explicitly recorded zero
    teacher_comment TEXT,
    entry_date TIMESTAMP DEFAULT NOW(),
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES user_profiles(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Row Level Security (RLS)
- **SELECT**: Admins, Team Leads, and Principals can view entries in their school
- **UPDATE**: Admins, Team Leads, and Principals can mark entries as reviewed
- **INSERT**: Teachers can create entries when saving scores

## Technical Implementation

### Detection Logic (`src/App.tsx`)

```typescript
// Helper function to check for explicit zero
const isExplicitZero = (value: any): boolean => {
    return value === 0 && value !== undefined && value !== null;
};

// Detect zero scores in components
const componentScores = score.component_scores || {};
const hasZeroComponent = Object.entries(componentScores)
    .some(([name, value]) => isExplicitZero(value));
const hasZeroTotal = isExplicitZero(score.total_score);
```

### Component Location
- **Dashboard**: `src/components/ZeroScoreMonitorView.tsx`
- **Route**: Added to `src/components/AppRouter.tsx`
- **Sidebar Entry**: Added to `src/components/Sidebar.tsx` under Academics section

### Type Definition (`src/types.ts`)

```typescript
export interface ZeroScoreEntry {
    id: number;
    school_id: number;
    term_id: number;
    academic_class_id: number;
    subject_name: string;
    student_id: number;
    teacher_user_id: string | null;
    component_name: string | null;
    total_score: number;
    teacher_comment: string | null;
    entry_date: string;
    reviewed: boolean;
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    created_at: string;
    // Populated fields from joins
    student?: Student;
    teacher?: UserProfile;
    academic_class?: AcademicClass;
    term?: Term;
}
```

## Privacy & Security

### Data Protection
- Full student details only visible to authorized roles (Admin, Team Lead, Principal)
- RLS policies enforce school-level data isolation
- Notifications don't expose sensitive student information
- Review notes are private and only visible to authorized users

### Security Scan Results
✅ CodeQL security scan passed with **0 vulnerabilities**

## Performance Optimizations
- Set-based deduplication for O(n) complexity in filter lists
- Indexed columns for efficient querying:
  - `(school_id, term_id)`
  - `teacher_user_id`
  - `student_id`
  - `reviewed`
  - `entry_date DESC`

## Usage Scenarios

### For Administrators
1. **Daily Monitoring**: Check dashboard for new zero score entries
2. **Pattern Detection**: Use filters to identify if specific teachers frequently enter zeros
3. **Follow-up**: Review context and follow up with teachers if needed
4. **Documentation**: Add review notes for record-keeping

### For Team Leaders
1. **Department Oversight**: Monitor zero scores in their subject areas
2. **Teacher Support**: Identify if teachers need help with assessment or data entry
3. **Quality Assurance**: Ensure scoring accuracy and completeness

### For Principals
1. **School-wide Visibility**: Overview of all zero score entries
2. **Policy Enforcement**: Ensure scoring policies are followed
3. **Academic Integrity**: Monitor for potential issues in assessment

## Migration

The system requires running the migration:
```bash
supabase migration up 20251209_add_zero_score_notifications
```

This creates:
- `zero_score_entries` table
- Necessary indexes for performance
- RLS policies for security

## Future Enhancements (Potential)
- Email notifications for zero scores
- Configurable thresholds (e.g., notify only if >5 zeros in one session)
- Trend analysis and reporting
- Automatic flagging of suspicious patterns
- Integration with teacher evaluation system

## Related Documentation
- [Score Entry System](./USER_GUIDE_RESULTS_MANAGEMENT.md)
- [Notification System](./NOTIFICATION_SYSTEM.md)
- [Permission System](./PERMISSION_SYSTEM_CHANGES.md)

## Support
For issues or questions about the Zero Score Notification System:
1. Check the dashboard for proper permissions
2. Verify RLS policies are active in Supabase
3. Ensure the migration has been applied
4. Review notification settings in user profiles

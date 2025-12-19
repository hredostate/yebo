# Lesson Plan Workflow Enhancement - Implementation Summary

## Overview
This implementation enhances the lesson plan workflow to improve efficiency, accountability, and accuracy by addressing five key problems:

1. **Team leaders can now view lesson plans across various teaching assignments** - New consolidated Team Lesson Hub
2. **Coverage is now tracked separately from submission** - Dedicated coverage reporting panel
3. **Same lesson plan can be used for multiple classes** - Junction table and multi-class selector
4. **Review evidence is now mandatory** - Timer-based review modal with checklist
5. **Learning materials are now easily accessible** - Upload, sharing, and publishing system

## Database Changes

### Migration File
**Location**: `/supabase/migrations/20251219_enhance_lesson_plan_workflow.sql`

#### New Tables

1. **`lesson_plan_assignments`** - Junction table linking lesson plans to multiple teaching assignments
   - `id` (SERIAL PRIMARY KEY)
   - `lesson_plan_id` (INTEGER REFERENCES lesson_plans)
   - `teaching_entity_id` (INTEGER REFERENCES academic_teaching_assignments)
   - `created_at` (TIMESTAMP)
   - Unique constraint on (lesson_plan_id, teaching_entity_id)

2. **`lesson_plan_review_evidence`** - Tracks evidence of actual review
   - `id` (SERIAL PRIMARY KEY)
   - `lesson_plan_id` (INTEGER REFERENCES lesson_plans)
   - `reviewer_id` (UUID REFERENCES user_profiles)
   - `time_spent_seconds` (INTEGER)
   - `checklist_responses` (JSONB)
   - `quality_rating` (INTEGER 1-5)
   - `feedback` (TEXT)
   - `decision` (VARCHAR: approved/revision_required/rejected)
   - `revision_notes` (TEXT)
   - `opened_at` (TIMESTAMP)
   - `decided_at` (TIMESTAMP)
   - `created_at` (TIMESTAMP)

3. **`student_material_access`** - Tracks student access to learning materials
   - `id` (SERIAL PRIMARY KEY)
   - `student_id` (INTEGER REFERENCES students)
   - `material_id` (INTEGER REFERENCES learning_materials)
   - `accessed_at` (TIMESTAMP)

#### Updated Tables

1. **`lesson_plans`**
   - Added `subject` (VARCHAR) - for grouping plans by subject
   - Made `teaching_entity_id` nullable (backward compatible)
   - Existing fields: grade_level, sessions (JSONB)

2. **`lesson_plan_coverage`**
   - Added `teaching_entity_id` (INTEGER) - proper tracking per assignment
   - Added `coverage_date` (TIMESTAMP)
   - Added unique constraint on (lesson_plan_id, teaching_entity_id)

3. **`learning_materials`**
   - Added `is_shared` (BOOLEAN) - share with other teachers
   - Added `is_published` (BOOLEAN) - publish to students
   - Added `uploaded_by` (UUID) - track uploader
   - Added `tags` (TEXT[]) - for categorization

#### RLS Policies
- All new tables have Row Level Security enabled
- Teachers can manage their own assignments and materials
- Team Leads and Admins have broader access
- Students can only view published materials

## TypeScript Type Updates

### New Interfaces

**`LessonPlanAssignment`**
```typescript
interface LessonPlanAssignment {
    id: number;
    lesson_plan_id: number;
    teaching_entity_id: number;
    created_at: string;
    teaching_entity?: AcademicTeachingAssignment;
}
```

**`LessonPlanReviewEvidence`**
```typescript
interface LessonPlanReviewEvidence {
    id: number;
    lesson_plan_id: number;
    reviewer_id: string;
    time_spent_seconds: number;
    checklist_responses: {
        objectives_clear: boolean;
        activities_aligned: boolean;
        assessment_appropriate: boolean;
        materials_listed: boolean;
        time_realistic: boolean;
    };
    quality_rating: 1 | 2 | 3 | 4 | 5;
    feedback: string;
    decision: 'approved' | 'revision_required' | 'rejected';
    revision_notes?: string;
    opened_at: string;
    decided_at: string;
    created_at: string;
    reviewer?: UserProfile;
}
```

### Updated Interfaces

**`LessonPlan`**
- Added `subject?: string`
- Made `teaching_entity_id` optional
- Added `assignments?: LessonPlanAssignment[]`
- Added `review_evidence?: LessonPlanReviewEvidence[]`

**`LessonPlanCoverage`**
- Added `teaching_entity_id: number`
- Changed `coverage_status` to include 'not_started'
- Changed `covered_date` to `coverage_date`

**`LearningMaterial`**
- Added `is_shared: boolean`
- Added `is_published: boolean`
- Added `uploaded_by?: string`
- Added `tags?: string[]`

## New Components

### 1. LessonPlanReviewModal.tsx
**Purpose**: Force team leads to actually review plans before approving

**Features**:
- Real-time timer tracking review duration (minimum 60 seconds)
- Required checklist with 5 mandatory items
- Quality rating (1-5 stars) with descriptions
- Mandatory feedback (minimum 50 characters)
- Decision options: Approve, Revision Required, Reject
- Shows all classes/arms the plan applies to
- Records all evidence to database

**Props**:
- `plan: LessonPlan`
- `assignments: LessonPlanAssignment[]`
- `onClose: () => void`
- `onSubmitReview: (review) => Promise<void>`
- `reviewerId: string`

### 2. TeamLessonPlanHub.tsx
**Purpose**: Consolidated view of all lesson plans across team members

**Features**:
- Filter by: Teacher, Subject, Week, Status
- Stats dashboard showing:
  - Plans submitted this week
  - Average review time
  - Coverage rate
  - Average quality rating
- Grouped sections:
  - Pending Review (with individual "Review →" buttons)
  - Reviewed This Week (with ratings and time spent)
  - Missing Plans (teachers without submissions)
- NO bulk approve functionality (must review individually)

**Props**:
- `lessonPlans: LessonPlan[]`
- `teachingAssignments: AcademicTeachingAssignment[]`
- `teamMembers: UserProfile[]`
- `currentUser: UserProfile`
- `onSubmitReview: (planId, review) => Promise<void>`
- `reviewEvidence: LessonPlanReviewEvidence[]`
- `coverageData: LessonPlanCoverage[]`

### 3. LessonPlanAssignmentSelector.tsx
**Purpose**: Allow teachers to assign one lesson plan to multiple classes

**Features**:
- Multi-select with checkboxes
- Auto-populate suggested classes (same subject, same level)
- Visual preview of selected classes
- Group by subject for easy navigation
- Select All / Clear All / Select Suggested actions
- Shows class details (level, term, session)

**Props**:
- `userAssignments: AcademicTeachingAssignment[]`
- `currentAssignments: LessonPlanAssignment[]`
- `onAssignmentsChange: (assignmentIds: number[]) => void`
- `lessonPlanSubject?: string`
- `lessonPlanGradeLevel?: string`

### 4. CoverageReportingPanel.tsx
**Purpose**: Allow teachers to report coverage after teaching

**Features**:
- List of approved lesson plans
- Per-class coverage status: Not Started, Partially Covered, Fully Covered, Not Covered
- Date taught picker
- Notes field for adjustments
- Evidence upload capability (photos, PDFs)
- Expandable plan view showing all assigned classes
- Edit/update coverage for each class separately

**Props**:
- `lessonPlans: LessonPlan[]`
- `coverageData: LessonPlanCoverage[]`
- `onUpdateCoverage: (coverage) => Promise<void>`
- `onUploadEvidence?: (planId, file) => Promise<void>`

### 5. LearningMaterialsManager.tsx
**Purpose**: Upload and manage learning materials

**Features**:
- File upload (PDF, documents, videos)
- External link addition (YouTube, Google Docs, etc.)
- Material type selection: PDF, Video, Link, Document, Presentation
- Material tagging for easy search
- Share with other teachers toggle
- Publish to students toggle
- Attach to specific lesson plans
- Filter by type, lesson plan
- Search by title
- Preview/download materials
- Delete materials

**Props**:
- `materials: LearningMaterial[]`
- `lessonPlans: LessonPlan[]`
- `onUploadMaterial: (material, file?) => Promise<void>`
- `onUpdateMaterial: (id, updates) => Promise<void>`
- `onDeleteMaterial: (id) => Promise<void>`
- `currentUserId: string`

## Updated Components

### StudentLessonPortal.tsx
**Enhancements**:
- Improved material display with type icons (PDF, Video, Link)
- Material access tracking
- Better UI with grid layout for materials
- Material type badges
- Automatic tracking when materials are viewed/downloaded

### Sidebar.tsx
**Addition**:
- Added "Team Lesson Hub" navigation item under Academics section
- Permission: `manage-curriculum` (Team Leads and above)
- Located between "Lesson Plans" and "Homework Manager"

### AppRouter.tsx
**Addition**:
- New route case for `VIEWS.TEAM_LESSON_HUB`
- Wired up TeamLessonPlanHub component
- Review submission handler with database integration
- Automatic status update based on review decision

## Constants Updates

### New VIEWS
Added to `/src/constants.ts`:
```typescript
TEAM_LESSON_HUB: 'Team Lesson Hub'
```

## Key Features & Workflows

### Workflow 1: Creating a Lesson Plan with Multiple Classes

1. Teacher creates/edits lesson plan
2. LessonPlanAssignmentSelector shows all their teaching assignments
3. System auto-suggests classes with same subject/level
4. Teacher selects multiple classes
5. Records created in `lesson_plan_assignments` table
6. One plan now serves multiple classes

### Workflow 2: Team Lead Review Process

1. Team Lead opens Team Lesson Hub
2. Views pending review section
3. Clicks "Review →" on a plan
4. LessonPlanReviewModal opens with timer
5. Timer starts (minimum 60 seconds required)
6. Complete all checklist items
7. Rate quality (1-5 stars)
8. Write feedback (minimum 50 characters)
9. Make decision (Approve/Revision/Reject)
10. All evidence saved to database
11. Lesson plan status updated

### Workflow 3: Coverage Reporting

1. Teacher opens Coverage Reporting Panel
2. Views approved lesson plans
3. Expands a plan to see all assigned classes
4. For each class, reports:
   - Coverage status
   - Date taught
   - Notes on adjustments
   - Optional evidence upload
5. Coverage tracked separately per class
6. Data saved to `lesson_plan_coverage`

### Workflow 4: Learning Materials

**Teacher Side**:
1. Open Learning Materials Manager
2. Upload file or add link
3. Add title, description, tags
4. Attach to lesson plan
5. Toggle "Share with teachers"
6. Toggle "Publish to students"
7. Material available in system

**Student Side**:
1. Student opens Student Lesson Portal
2. Views published lesson plans
3. Clicks on a plan
4. Sees attached materials with icons
5. Downloads/views material
6. Access tracked automatically

## Permissions & Access Control

### Team Lead Capabilities
- View all lesson plans in their team
- Review plans with evidence tracking
- View coverage reports
- View review analytics
- **Cannot bulk approve** (must review individually)

### Teacher Capabilities
- Create/edit own lesson plans
- Assign plans to multiple classes they teach
- Report coverage per class
- Upload and manage learning materials
- Share materials with other teachers
- Publish materials to students

### Student Capabilities
- View published lesson plans for enrolled classes
- Download published learning materials
- Materials organized by subject
- Access tracking for analytics

## Analytics & Reporting Capabilities

The system now tracks:

1. **Review Metrics**
   - Average time spent reviewing plans
   - Plans approved vs. revision required vs. rejected
   - Quality rating trends over time
   - Review completion rates

2. **Coverage Metrics**
   - Coverage completion rates by teacher
   - Coverage completion rates by subject
   - Coverage completion rates by class
   - Time between plan approval and coverage

3. **Material Usage**
   - Material access rates by students
   - Most accessed materials
   - Materials by type distribution
   - Sharing patterns among teachers

## Migration & Deployment Steps

1. **Database Migration**
   ```sql
   -- Run in Supabase SQL Editor
   -- Execute: /supabase/migrations/20251219_enhance_lesson_plan_workflow.sql
   ```

2. **Data Migration**
   - Existing lesson plans automatically migrated to junction table
   - Existing coverage data preserved
   - No data loss expected

3. **Testing Checklist**
   - [ ] Create lesson plan with multiple classes
   - [ ] Submit lesson plan for review
   - [ ] Complete review with evidence (as Team Lead)
   - [ ] Report coverage for each class
   - [ ] Upload learning material
   - [ ] Publish material to students
   - [ ] Verify student can access material
   - [ ] Check analytics display correctly

4. **User Training Required**
   - Team Leads: New review process with timer
   - Teachers: Multi-class assignment feature
   - Teachers: Coverage reporting workflow
   - Teachers: Materials management

## Breaking Changes & Backward Compatibility

### Breaking Changes
None - all changes are additive and backward compatible.

### Backward Compatibility
- Existing lesson plans continue to work
- Old `teaching_entity_id` field is optional
- Existing coverage data preserved
- Migration handles data transfer automatically

## Future Enhancements (Not in Scope)

1. Automated reminders for missing plans
2. Collaborative lesson plan editing
3. Version control for lesson plans
4. Templates library
5. AI-powered plan suggestions
6. Parent access to lesson plans
7. Integration with homework assignments
8. Calendar view of lesson plans
9. Print-friendly lesson plan formats
10. Lesson plan analytics dashboard

## Support & Troubleshooting

### Common Issues

**Issue**: Review button disabled
- **Cause**: Timer hasn't reached minimum time (60 seconds)
- **Solution**: Wait for timer to complete

**Issue**: Can't submit review
- **Cause**: Missing required fields (checklist, rating, feedback)
- **Solution**: Complete all required items

**Issue**: Materials not showing for students
- **Cause**: Material not marked as "Published"
- **Solution**: Edit material and toggle "Publish to students"

**Issue**: Can't assign plan to multiple classes
- **Cause**: No teaching assignments available
- **Solution**: Ensure teacher has academic teaching assignments

### Database Queries for Troubleshooting

```sql
-- Check lesson plan assignments
SELECT lp.title, lpa.*, ata.subject_name, ac.name as class_name
FROM lesson_plan_assignments lpa
JOIN lesson_plans lp ON lpa.lesson_plan_id = lp.id
JOIN academic_teaching_assignments ata ON lpa.teaching_entity_id = ata.id
JOIN academic_classes ac ON ata.academic_class_id = ac.id;

-- Check review evidence
SELECT lp.title, lpre.*, up.name as reviewer_name
FROM lesson_plan_review_evidence lpre
JOIN lesson_plans lp ON lpre.lesson_plan_id = lp.id
JOIN user_profiles up ON lpre.reviewer_id = up.id
ORDER BY lpre.created_at DESC;

-- Check coverage data
SELECT lp.title, lpc.*, ata.subject_name
FROM lesson_plan_coverage lpc
JOIN lesson_plans lp ON lpc.lesson_plan_id = lp.id
LEFT JOIN academic_teaching_assignments ata ON lpc.teaching_entity_id = ata.id;

-- Check material access
SELECT lm.title, sma.*, s.name as student_name
FROM student_material_access sma
JOIN learning_materials lm ON sma.material_id = lm.id
JOIN students s ON sma.student_id = s.id
ORDER BY sma.accessed_at DESC;
```

## Conclusion

This implementation significantly enhances the lesson plan workflow by:
- Improving accountability through evidence-based reviews
- Increasing efficiency through multi-class assignments
- Better tracking through separated coverage reporting
- Enhanced collaboration through material sharing
- Better insights through comprehensive analytics

All changes maintain backward compatibility while providing a solid foundation for future enhancements.

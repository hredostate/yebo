# Lesson Plan Review Enforcement Implementation Summary

## Overview
This implementation adds comprehensive anti-rubber-stamping measures to the lesson plan review process, ensuring team leads thoroughly engage with lesson plan content before approving.

## Implementation Complete ✅

### 1. Visibility/Focus Tracking
**Location**: `src/components/LessonPlanReviewModal.tsx`

The timer now pauses automatically when:
- Browser tab is not visible (document.hidden)
- User switches to another tab
- Window loses focus

**Features**:
- Pause counter tracks how many times reviewer left the tab
- Visual indicator: "⏸️ Timer paused - return to this tab to continue"
- Timer icon changes color when paused (yellow vs blue)
- Tracks both total time and active time separately

**Code**:
```typescript
useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.hidden) {
            setIsPaused(true);
            setPauseCount(prev => prev + 1);
        } else {
            setIsPaused(false);
        }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

### 2. Scroll Depth Tracking
**Location**: `src/components/LessonPlanReviewModal.tsx`

Plan Overview section is now scrollable with tracking:
- Max height: 256px (16rem)
- Scroll progress displayed as percentage (0-100%)
- Requires scrolling to within 20px of bottom
- Visual prompt: "📜 Please scroll through the entire plan"
- Approval button disabled until scrolled to bottom

**Features**:
- Real-time scroll percentage calculation
- `hasScrolledToBottom` flag
- Included in `canApprove` conditions
- Progress shown in header indicator

**Code**:
```typescript
const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const percentage = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    setScrollPercentage(Math.min(percentage, 100));
    
    if (scrollTop + clientHeight >= scrollHeight - SCROLL_TOLERANCE) {
        setHasScrolledToBottom(true);
    }
};
```

### 3. Review Cooldown System
**Location**: `src/hooks/useReviewCooldown.ts`

30-second cooldown between reviewing different plans:
- Starts after successful review submission
- Stores timestamp in localStorage
- Shows full-screen overlay during cooldown
- Counts down in real-time
- Prevents opening new reviews during cooldown

**Features**:
- `isInCooldown` boolean state
- `cooldownRemaining` seconds counter
- `startCooldown()` function called after submission
- Persistent across page refreshes

**Constants**:
```typescript
const COOLDOWN_SECONDS = 30;
const COOLDOWN_STORAGE_KEY = 'lastReviewTimestamp';
```

### 4. Duplicate Feedback Detection
**Location**: `src/components/LessonPlanReviewModal.tsx`

Jaccard similarity algorithm detects repetitive feedback:
- Compares new feedback against last 10 reviews
- Warns when similarity > 80%
- Stores normalized (lowercase, trimmed) feedback in localStorage
- Warning shown but submission still allowed
- Flags recorded in review evidence

**Algorithm**:
```typescript
const calculateSimilarity = (str1: string, str2: string): number => {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    if (union.size === 0) return 0; // Prevent division by zero
    return intersection.size / union.size;
};
```

**Warning UI**:
```
⚠️ This feedback is very similar to a recent review. Please provide unique feedback.
```

### 5. Checklist Randomization
**Location**: `src/components/LessonPlanReviewModal.tsx`

Checklist items randomized to prevent muscle memory:
- Order randomized once when modal opens
- Uses `Math.random() - 0.5` sort
- Completion order tracked in array
- Order saved to review evidence

**Items**:
1. Learning objectives are clear and measurable
2. Activities align with objectives
3. Assessment methods are appropriate
4. Materials/resources are listed
5. Time allocation is realistic

**Implementation**:
```typescript
const [randomizedChecklist] = useState(() => {
    const items = [...checklistItems];
    return items.sort(() => Math.random() - 0.5);
});
```

### 6. Progress Indicator
**Location**: `src/components/LessonPlanReviewModal.tsx`

Visual progress bar showing completion of all requirements:
- Timer: Shows seconds completed vs required (60s)
- Scroll: Shows percentage (0-100%)
- Checklist: Shows if all items checked
- Rating: Shows if 1-5 star rating given
- Feedback: Shows if minimum 50 characters entered

**Display**:
- Green checkmark (✓) when complete
- Gray circle (○) when incomplete
- Displayed prominently below header
- Updates in real-time

### 7. Enhanced Review Evidence
**Location**: `src/types.ts`

New fields added to `LessonPlanReviewEvidence` interface:

```typescript
// Anti-rubber-stamping tracking fields
pause_count?: number;           // Number of times reviewer left the tab
scroll_depth_reached?: number;  // 0-100 percentage
feedback_similarity_warning?: boolean;
active_review_time_seconds?: number;  // Time with tab in focus
checklist_completion_order?: string[]; // Order items were checked
```

All fields are optional for backward compatibility.

### 8. Database Migration
**Location**: `supabase/migrations/20251222_review_enforcement_tracking.sql`

**New Columns**:
```sql
ALTER TABLE public.lesson_plan_review_evidence
ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0;
ADD COLUMN IF NOT EXISTS scroll_depth_reached INTEGER DEFAULT 0;
ADD COLUMN IF NOT EXISTS feedback_similarity_warning BOOLEAN DEFAULT false;
ADD COLUMN IF NOT EXISTS active_review_time_seconds INTEGER;
ADD COLUMN IF NOT EXISTS checklist_completion_order TEXT[];
```

**Performance Index**:
```sql
CREATE INDEX IF NOT EXISTS idx_review_evidence_quality_metrics
ON public.lesson_plan_review_evidence(pause_count, scroll_depth_reached, active_review_time_seconds);
```

**Quality Metrics View**:
```sql
CREATE OR REPLACE VIEW public.review_quality_metrics AS
SELECT 
    reviewer_id,
    COUNT(*) as total_reviews,
    AVG(time_spent_seconds) as avg_time_spent,
    AVG(active_review_time_seconds) as avg_active_time,
    AVG(scroll_depth_reached) as avg_scroll_depth,
    AVG(pause_count) as avg_pause_count,
    AVG(quality_rating) as avg_quality_given,
    COUNT(CASE WHEN decision = 'approved' THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) as approval_rate,
    COUNT(CASE WHEN feedback_similarity_warning THEN 1 END) as similar_feedback_count
FROM public.lesson_plan_review_evidence
GROUP BY reviewer_id;
```

### 9. Review Quality Dashboard
**Location**: `src/components/ReviewQualityDashboard.tsx`

Comprehensive dashboard for Admins/Principals to monitor review quality.

**Features**:
- **Summary Cards**: Total reviewers, flagged reviewers, total reviews
- **Metrics Table**: Sortable columns with all quality metrics
- **Smart Flagging**: Automatic detection of concerning patterns
- **CSV Export**: Download report with proper escaping
- **Filter Toggle**: Show only flagged reviewers
- **Color Coding**: Red/Yellow highlights for concerning values

**Flagging Thresholds** (configurable constants):
```typescript
const MIN_ACTIVE_TIME_THRESHOLD = 45; // seconds
const MIN_SCROLL_DEPTH_THRESHOLD = 50; // percentage
const MAX_PAUSE_COUNT_THRESHOLD = 5; // number of pauses
const HIGH_APPROVAL_RATE_THRESHOLD = 95; // percentage
const HIGH_SIMILAR_FEEDBACK_THRESHOLD = 3; // count
```

**Flag Types**:
1. **Low active time**: Avg active time < 45 seconds
2. **Low scroll depth**: Avg scroll depth < 50%
3. **High pause count**: Avg pause count > 5
4. **Very high approval rate**: Approval rate > 95%
5. **Repetitive feedback**: Similar feedback count > 3

**Table Columns**:
- Reviewer name
- Total reviews
- Avg active time (seconds)
- Avg scroll depth (%)
- Avg pause count
- Avg quality rating (1-5)
- Approval rate (%)
- Similar feedback count
- Flags (badges)
- Actions (View Details button)

### 10. Navigation Integration

**Constants** (`src/constants.ts`):
```typescript
REVIEW_QUALITY_DASHBOARD: 'Review Quality Dashboard'
```

**Sidebar** (`src/components/Sidebar.tsx`):
Added under "Academics" section:
```typescript
{ id: VIEWS.REVIEW_QUALITY_DASHBOARD, label: 'Review Quality', permission: 'manage-curriculum' }
```

**Router** (`src/components/AppRouter.tsx`):
```typescript
case VIEWS.REVIEW_QUALITY_DASHBOARD:
    return <ReviewQualityDashboard
        reviewEvidence={data.reviewEvidence || []}
        reviewers={data.users.filter((u: any) => ['Principal', 'Team Lead'].includes(u.role))}
        onViewReviewerDetails={(reviewerId) => {
            console.log('View details for reviewer:', reviewerId);
            actions.addToast('Reviewer details view coming soon', 'info');
        }}
    />;
```

## Configuration Constants

All thresholds and magic numbers have been converted to named constants for easy configuration:

**LessonPlanReviewModal.tsx**:
```typescript
const MINIMUM_REVIEW_TIME = 60; // seconds
const MINIMUM_FEEDBACK_LENGTH = 50; // characters
const SCROLL_TOLERANCE = 20; // pixels
const SIMILARITY_THRESHOLD = 0.8; // 80% similarity
const MAX_STORED_FEEDBACKS = 10; // storage limit
```

**useReviewCooldown.ts**:
```typescript
const COOLDOWN_SECONDS = 30;
```

**ReviewQualityDashboard.tsx**:
```typescript
const MIN_ACTIVE_TIME_THRESHOLD = 45;
const MIN_SCROLL_DEPTH_THRESHOLD = 50;
const MAX_PAUSE_COUNT_THRESHOLD = 5;
const HIGH_APPROVAL_RATE_THRESHOLD = 95;
const HIGH_SIMILAR_FEEDBACK_THRESHOLD = 3;
```

## Testing & Validation

### Build Status: ✅ PASS
- No TypeScript errors
- No build errors
- All chunks generated successfully
- Bundle size: 5529.83 KiB

### Code Review: ✅ PASS
All feedback addressed:
- parseInt with radix parameter
- CSV escaping for special characters
- Division by zero protection
- Magic numbers converted to constants

### Security Scan: ✅ PASS
- CodeQL: 0 vulnerabilities found
- No security alerts

### Backward Compatibility: ✅ VERIFIED
- All new fields optional
- Existing reviews unaffected
- Migration uses IF NOT EXISTS
- No breaking changes

## Usage Instructions

### For Reviewers (Team Leads/Principals)

1. **Navigate** to Team Lesson Hub
2. **Click** "Review" on a pending lesson plan
3. **Wait** for progress indicator to show all requirements met:
   - ✓ Timer (60 seconds minimum)
   - ✓ Scroll (must scroll to bottom)
   - ✓ Checklist (all 5 items)
   - ✓ Rating (1-5 stars)
   - ✓ Feedback (50+ characters)
4. **Submit** review when ready
5. **Wait** 30 seconds before reviewing another plan

### For Admins/Principals

1. **Navigate** to Academics → Review Quality
2. **View** metrics for all reviewers
3. **Filter** to see only flagged reviewers
4. **Sort** columns to identify patterns
5. **Export** CSV report for further analysis
6. **Click** "View Details" for individual reviewer drill-down (coming soon)

## Metrics Interpretation

### Good Patterns
- Active time ≥ 45 seconds
- Scroll depth ≥ 50%
- Pause count ≤ 5
- Approval rate 50-95%
- Similar feedback count ≤ 3

### Concerning Patterns (Flagged)
- Low active time: May indicate rushed reviews
- Low scroll depth: Not reading full content
- High pause count: Distracted or multitasking
- Very high approval rate: Rubber-stamping
- Repetitive feedback: Copy-paste reviews

## Future Enhancements

1. **Reviewer Details View**: Drill-down to see individual reviews
2. **Trend Analysis**: Track improvement/decline over time
3. **Email Alerts**: Notify admins of concerning patterns
4. **Feedback Templates**: Suggested feedback based on plan quality
5. **Review Time Recommendations**: ML-based optimal review time
6. **Mobile Optimization**: Touch-friendly review interface
7. **Batch Review Prevention**: Limit reviews per hour
8. **Peer Review Assignment**: Automatic reviewer rotation

## Conclusion

This implementation successfully adds comprehensive anti-rubber-stamping measures while maintaining backward compatibility and code quality. All acceptance criteria from the original requirements have been met and validated.

The system now provides:
- **Prevention**: Multiple mechanisms to ensure thorough reviews
- **Detection**: Tracking and flagging of concerning patterns
- **Monitoring**: Dashboard for administrative oversight
- **Flexibility**: Configurable thresholds for different contexts
- **Evidence**: Comprehensive tracking for auditing and analysis

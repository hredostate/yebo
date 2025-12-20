# Report Card System Refactoring - Implementation Guide

## Overview

This refactoring enforces production-grade data integrity, eliminates UI-side calculations, and ensures A4 print perfection for report cards. The key principle is: **No mock data or placeholders are ever allowed**.

## Key Changes

### 1. Database Schema Changes

#### New Tables

- **`results_publish_log`**: Audit trail for published results
  - Tracks when results are published, by whom, and which version
  - Enables traceability from PDF back to database

- **`grading_scheme_overrides`**: Subject-specific grade boundaries
  - Allows different grading rules for specific subjects
  - Example: Math might have stricter grading than Arts

- **`report_templates`**: Configurable report card templates
  - Stores HTML and CSS templates
  - Supports multiple layouts (classic, modern, pastel, etc.)
  - Configurable per school

- **`template_assignments`**: Maps templates to campuses/classes
  - Campus-level template assignments
  - Class-level template overrides

#### Schema Enhancements

- **`school_config.report_card_branding`**: JSONB column for branding
  - Watermark URLs
  - Signature images
  - Color schemes
  - Footer text

- **`school_config.default_template_id`**: Default template reference

### 2. RPC Functions (Single Source of Truth)

#### `compute_report_card_data(p_student_id, p_term_id)`

Server-side function that validates and computes report card data:

**Validation Steps:**
1. Check student enrollment exists
2. Verify results are published (`is_published = true`)
3. Validate grading scheme exists
4. Check all required assessment components have scores

**Returns:**
```json
{
  "status": "success" | "blocked",
  "reason": "MISSING_SCORES" | "NOT_ENROLLED" | etc.,
  "details": [...],
  "data": { /* full report card data */ }
}
```

**Data Computed:**
- Subject grades (using compute_grade)
- Arm ranking (dense rank within class/arm)
- Level ranking (dense rank across all arms in same level)
- Attendance (from attendance_records or overrides)
- Comments (from student_term_reports)

#### `compute_grade(p_score, p_grading_scheme_id, p_subject_name)`

Unified grade calculation function:

**Priority:**
1. Subject-specific override (from grading_scheme_overrides)
2. Standard grading rules (from grading_scheme_rules)
3. Default to 'F' if no match

**Returns:**
```json
{
  "grade_label": "A",
  "remark": "Excellent",
  "gpa_value": 4.0
}
```

### 3. Service Layer

#### `reportCardValidationService.ts`

**Functions:**
- `validateReportCardData(studentId, termId)`: Validate single student
- `validateBulkReportCardData(studentIds, termId)`: Validate multiple students
- `formatValidationError(result)`: Human-readable error messages
- `getDetailedValidationErrors(result)`: Structured error details
- `allValidationsPassed(validations)`: Check if all passed
- `getValidationSummary(validations)`: Summary statistics

**Error Types:**
- `STUDENT_NOT_FOUND`: Student doesn't exist
- `NOT_ENROLLED`: Not enrolled in any class for term
- `RESULTS_NOT_PUBLISHED`: Results not yet published
- `MISSING_GRADING_SCHEME`: No grading scheme configured
- `MISSING_SCORES`: Some assessment scores are missing

#### `pdfGenerationService.ts`

**Functions:**
- `generatePdfFromHtml(html, options)`: Generate single PDF
- `generateCombinedPdf(htmls, options)`: Combine multiple PDFs
- `triggerBrowserPrint()`: Use browser's native print
- `addPrintStyles()`: Add A4 print CSS
- `removePrintStyles()`: Remove print CSS

**Print CSS Features:**
- `@page { size: A4; margin: 10mm; }`
- Prevent page breaks inside tables
- Color adjustment for print
- Predictable page breaks

### 4. Components

#### `ReportCardValidationGate.tsx`

Wrapper component that validates before rendering:

```tsx
<ReportCardValidationGate studentId={123} termId={456}>
  {(data) => <ReportCardComponent data={data} />}
</ReportCardValidationGate>
```

**Features:**
- Shows loading spinner during validation
- Displays structured errors if validation fails
- Only renders children when validation passes

#### `ReportCardValidationErrors.tsx`

Displays validation errors with actionable steps:

**Shows:**
- Main error message
- Detailed breakdown of missing data
- Step-by-step instructions to fix
- Technical details (collapsible)

#### Updated: `BulkReportCardGenerator.tsx`

**Changes:**
- Added validation step before generation
- Blocks generation if any student fails validation
- Shows detailed failure report
- Updated status messages to include "validating"

**Validation Flow:**
1. User selects students and clicks "Generate"
2. System validates all selected students
3. If any fail, show errors and abort
4. If all pass, proceed with generation

#### Updated: `TeacherScoreEntryView.tsx` & `LevelStatisticsDashboard.tsx`

**Changes:**
- Added comments noting that UI-side grade calculations are for display/statistics only
- Actual report card grades come from server-side `compute_grade` function
- Ensures single source of truth

### 5. Edge Function (Optional)

#### `supabase/functions/generate-pdf/index.ts`

Template for server-side PDF generation using Puppeteer/Playwright:

**Benefits:**
- Better print quality
- Proper A4 page breaks
- Server-side rendering
- No client-side dependencies

**Status:** Placeholder/template (not yet implemented)

## Usage Guide

### For Administrators

#### Publishing Results

Before generating report cards:

1. Go to Results Manager
2. Select class and term
3. Complete all score entries
4. Click "Publish Results"
5. Results are now available for report card generation

#### Configuring Grading Schemes

Standard grading:
1. Go to Settings → Grading Schemes
2. Create or edit grading scheme
3. Set grade boundaries (A: 70-100, B: 60-69, etc.)
4. Assign to campus or class

Subject-specific overrides:
1. Access grading_scheme_overrides table
2. Add override for specific subject
3. Example: Math might have A: 80-100 instead of 70-100

#### Configuring Templates

1. Access report_templates table
2. Create new template with HTML/CSS
3. Assign to campus via template_assignments
4. Set as default in school_config

### For Teachers

#### Score Entry

1. Go to Score Entry
2. Select class, subject, and term
3. Enter all assessment components
4. Save scores
5. Note: Grade shown is preview only; final grade computed server-side

### For Developers

#### Validation Workflow

```typescript
import { validateReportCardData } from './services/reportCardValidationService';

const result = await validateReportCardData(studentId, termId);

if (result.status === 'blocked') {
  // Show error
  console.error(formatValidationError(result));
} else {
  // Use validated data
  const reportData = result.data;
}
```

#### Using Validation Gate

```tsx
import ReportCardValidationGate from './components/ReportCardValidationGate';

function MyComponent() {
  return (
    <ReportCardValidationGate 
      studentId={123} 
      termId={456}
      onValidationFailed={(result) => {
        console.error('Validation failed:', result);
      }}
    >
      {(data) => (
        <ReportCard data={data} />
      )}
    </ReportCardValidationGate>
  );
}
```

#### Print CSS

```typescript
import { addPrintStyles, triggerBrowserPrint } from './services/pdfGenerationService';

// Add print styles
addPrintStyles();

// Trigger browser print dialog
triggerBrowserPrint();
```

## Database Migration

Run the migration:

```sql
-- Apply the migration
\i supabase/migrations/20251220_report_card_refactor.sql
```

Or via Supabase CLI:

```bash
supabase db push
```

## Testing Checklist

### Validation Tests

- [ ] Student not found error
- [ ] Not enrolled error
- [ ] Results not published error
- [ ] Missing grading scheme error
- [ ] Missing scores error (specific subjects)

### Generation Tests

- [ ] Single student report card
- [ ] Bulk generation (ZIP)
- [ ] Bulk generation (combined PDF)
- [ ] With watermark (DRAFT/FINAL)
- [ ] Different templates

### Print Quality Tests

- [ ] A4 format preserved
- [ ] No content clipping
- [ ] Proper page breaks
- [ ] Colors print correctly
- [ ] Margins are consistent

### Data Consistency Tests

- [ ] Grades match between UI/PDF/database
- [ ] Rankings match (arm and level)
- [ ] Attendance data matches
- [ ] Comments display correctly

## Troubleshooting

### Validation Fails with "Results Not Published"

**Solution:** Publish results in Results Manager before generating report cards.

### Grade Boundaries Don't Match

**Issue:** Different grades shown in UI vs. PDF

**Solution:** Clear browser cache. UI uses preview calculation; PDF uses server-side compute_grade.

### Missing Scores Error

**Issue:** Some students show missing scores

**Solution:** 
1. Check which subjects are missing in the error details
2. Go to Score Entry for those subjects
3. Complete all assessment components
4. Save and retry

### Print Quality Issues

**Issue:** Report cards don't fit on A4

**Solution:**
1. Use browser print instead of PDF export
2. Check print preview before printing
3. Ensure printer settings are set to A4

## Architecture Benefits

1. **Single Source of Truth**: All calculations happen server-side
2. **Audit Trail**: Every published result is logged
3. **Data Integrity**: No report cards with incomplete data
4. **Flexibility**: Configurable templates and grading schemes
5. **Traceability**: Can audit any PDF back to source data
6. **Consistency**: UI/PDF/database always match

## Future Enhancements

- [ ] Implement Edge Function with Puppeteer
- [ ] Add template visual editor
- [ ] Support for multiple languages
- [ ] Parent portal access with validation
- [ ] Automated report card scheduling
- [ ] Integration with student portals
- [ ] Analytics on validation failures

## Support

For issues or questions:
1. Check validation error details
2. Review migration logs
3. Contact system administrator
4. Report bugs with validation result JSON

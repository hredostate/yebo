# Statistics and Ranking System Implementation

## Overview
This document describes the comprehensive enhancements made to the Report Card Manager's statistics and ranking functionality. The system now provides detailed rankings at multiple levels (arm, level, and campus) along with subject-wise performance analytics.

## Key Features Implemented

### 1. Multi-Level Ranking System

#### Position in Arm (Class Arm)
- **Location**: `database_schema.sql` - `get_student_term_report_details` RPC function
- **Calculation**: Dense ranking within the same class arm (e.g., SS1 Gold)
- **Display**: Shows as "3rd out of 45" on report cards
- **Partitioning**: By campus, session, term, academic_class_id, and arm

#### Position in Level (Grade Level)
- **NEW Feature**: Ranks students across all arms in the same grade level
- **Location**: `database_schema.sql` - Enhanced RPC function
- **Calculation**: Dense ranking across all arms in the same level (e.g., all SS1 students)
- **Display**: Shows as "15th out of 180" on report cards
- **Partitioning**: By campus, session, term, and level

#### Campus Percentile
- **Location**: Existing feature, maintained and enhanced
- **Calculation**: Percentile ranking across entire campus for the term
- **Display**: Shows as "85th percentile" indicating better performance than 85% of campus

#### Subject Position
- **Location**: `database_schema.sql` - Subject ranking within RPC
- **Calculation**: Dense ranking for each subject within class arm and level
- **Display**: Per-subject position in class (e.g., "2nd" for Mathematics)

### 2. Statistics Dashboard Enhancements

#### Level Statistics Dashboard (`src/components/LevelStatisticsDashboard.tsx`)

**View Modes**:
- **Per-Level View**: Shows aggregated statistics for entire grade level
- **Per-Arm View**: Shows detailed statistics for specific class arm

**Statistics Cards**:
- Average Score across level/arm
- Highest Score with student name
- Lowest Score with student name
- Pass Rate percentage

**Grade Distribution**:
- Visual chart showing A, B, C, D, F distribution
- Percentage breakdown of each grade
- Color-coded for easy interpretation

**Arm Comparison**:
- Side-by-side comparison of all arms in a level
- Average scores per arm
- Visual charts for performance comparison

**Subject-Wise Statistics** (NEW):
- Average score per subject
- Highest and lowest scores per subject
- Student count per subject
- Pass rate per subject
- Visual indicators for top/bottom performing subjects
  - 🏆 for top 3 subjects
  - ⚠️ for bottom 3 subjects

**Data Audit**:
- Integrity checks for missing enrollments
- Orphan result detection
- Duplicate result detection
- Scope-specific issue tracking

### 3. CSV Export Functionality

#### Level Statistics Export
- **Button**: "Export Level Statistics"
- **Content**: Overall level performance metrics
- **Fields**:
  - Level name
  - Total students
  - Average score
  - Highest/lowest scores with names
  - Pass count and rate

#### Subject Statistics Export
- **Button**: "Export Subject Statistics"
- **Content**: Subject-by-subject performance breakdown
- **Fields**:
  - Subject name
  - Average score
  - Highest/lowest scores
  - Student count
  - Pass rate

#### Student Rankings Export
- **Location**: Built into `StudentRankingTable` component
- **Button**: "Export CSV"
- **Content**: Complete ranking list with all metrics
- **Fields**:
  - Rank
  - Student name
  - Admission number
  - Class and arm
  - Average percentage
  - Total score
  - Grade
  - Position change (if available)

### 4. Report Card Integration

#### Student Report View Enhancements (`src/components/StudentReportView.tsx`)

**Standing Card** (Modern Layout):
- Position in Arm with cohort size
- Position in Level with level size (NEW)
- Campus percentile

**Compact Layout**:
- Grid display with all positions
- Arm and level positions side-by-side

**Professional Layout**:
- Formal table with 5-column layout
- Dedicated columns for arm and level positions
- GPA and percentile metrics

**All Layouts Include**:
- Subject-wise positions from database
- Component scores breakdown
- Attendance summary
- Teacher and principal comments

### 5. Database Schema Updates

#### Enhanced RPC Function: `get_student_term_report_details`

**New Variables**:
```sql
v_level_rank INTEGER;
v_level_size INTEGER;
```

**New Calculation**:
```sql
DENSE_RANK() OVER (
    PARTITION BY s.campus_id, t.session_label, str.term_id, ac.level
    ORDER BY COALESCE(str.average_score, 0) DESC
) AS level_rank
```

**New Return Fields**:
```sql
'positionInLevel', v_level_rank,
'levelSize', v_level_size,
```

### 6. Analytics Utilities

#### New Functions in `src/utils/resultAnalytics.ts`

**`rankLevel()`**:
- Dual ranking: arm-level and level-wide
- Returns `LevelRanking[]` with both positions
- Handles multi-arm scenarios correctly

**`rankSubjects()`**:
- Subject-specific rankings
- Arm and level positions per subject
- Returns `SubjectRanking[]` with detailed metrics

**New Interfaces**:
```typescript
export interface LevelRanking {
    studentId: number;
    rankInArm: number;
    totalInArm: number;
    rankInLevel: number;
    totalInLevel: number;
}

export interface SubjectRanking {
    studentId: number;
    subjectName: string;
    rankInArm: number;
    totalInArm: number;
    rankInLevel: number;
    totalInLevel: number;
    score: number;
}
```

### 7. Type System Updates

#### Enhanced `StudentTermReportDetails` Interface:
```typescript
summary: {
    average: number;
    positionInArm: number;
    cohortSize?: number | null;
    positionInLevel?: number | null;  // NEW
    levelSize?: number | null;        // NEW
    campusPercentile?: number | null;
    gpaAverage?: number | null;
}
```

## Usage Examples

### Viewing Statistics Dashboard

1. Navigate to Result Manager
2. Select a term
3. Click "Statistics" tab
4. Select a grade level (e.g., "SS1")
5. Choose view mode:
   - "Per Level" for overall statistics
   - "Per Arm" for specific arm details

### Exporting Data

**Level Statistics**:
1. Select level in statistics dashboard
2. Click "Export Level Statistics"
3. CSV file downloads with summary metrics

**Subject Statistics**:
1. View subject performance table
2. Click "Export Subject Statistics"
3. CSV file downloads with per-subject breakdown

**Student Rankings**:
1. Scroll to rankings table
2. Use search to filter if needed
3. Click "Export CSV" button
4. Complete ranking list downloads

### Viewing Report Cards

**Individual Report**:
1. Report cards now automatically show:
   - Position in Arm: "3rd out of 45"
   - Position in Level: "15th out of 180"
   - Campus Percentile: "85th"
   - Subject positions for each subject

**Bulk Generation**:
- All rankings are automatically included in PDF generation
- No additional configuration needed

## Technical Details

### Ranking Algorithm

The system uses **dense ranking** which means:
- Students with tied scores receive the same rank
- No gaps in rank numbers
- Next rank after a tie continues sequentially

**Example**:
```
Score   Rank
95      1
95      1
90      2  (not 3)
85      3
```

### Performance Considerations

1. **Database Optimization**:
   - Window functions used for efficient ranking
   - Partitioning reduces computational overhead
   - Single query retrieves all ranking data

2. **Caching**:
   - Rankings calculated once per RPC call
   - Frontend caches results for view mode changes
   - CSV export uses already-calculated data

3. **Filtering**:
   - Active students only (excludes Withdrawn, Graduated, etc.)
   - Proper scope filtering by campus, session, term
   - Arm and level boundaries respected

### Data Integrity

The system includes comprehensive validation:

1. **Missing Enrollments**: Alerts if active students lack term enrollment
2. **Orphan Results**: Detects results without corresponding enrollment
3. **Duplicate Detection**: Identifies duplicate score entries
4. **Scope Validation**: Ensures data matches selected filters

## Testing Recommendations

### Unit Testing
- Test `denseRank()` with various score distributions
- Test `rankLevel()` with multi-arm scenarios
- Test `rankSubjects()` with different subject sets

### Integration Testing
- Verify rankings match across RPC and utility functions
- Test CSV exports contain accurate data
- Validate report card displays all positions

### User Acceptance Testing
1. Create sample students in multiple arms
2. Enter varied scores to create different rankings
3. Verify:
   - Arm positions are correct
   - Level positions span all arms
   - Subject positions match expectations
   - CSV exports are accurate

## Troubleshooting

### Rankings Don't Appear

**Check**:
1. Student has active status
2. Student is enrolled for the term
3. Scores have been entered and locked
4. Class has level assigned
5. Academic class has arm assigned

### Export Shows No Data

**Check**:
1. Level is selected in dashboard
2. Term has score entries
3. Students exist in selected scope
4. Browser allows file downloads

### Positions Seem Incorrect

**Verify**:
1. Scope filters (campus, session, term)
2. Student status (active vs inactive)
3. Score calculation (average vs total)
4. Arm assignment matches expectation

## Future Enhancements

Potential additions for future versions:

1. **Historical Trends**:
   - Position changes over terms
   - Improvement/decline indicators
   - Term-over-term comparisons

2. **Predictive Analytics**:
   - Projected rankings based on current trends
   - At-risk student identification
   - Performance forecasting

3. **Custom Rankings**:
   - User-defined ranking criteria
   - Weighted subject rankings
   - Customizable cohort definitions

4. **Advanced Exports**:
   - PDF reports with charts
   - Excel exports with formatting
   - Automated email distribution

## Conclusion

The enhanced statistics and ranking system provides comprehensive insights into student performance at multiple levels. The dual ranking system (arm and level) gives both granular and broad perspectives, while subject-wise analytics enable targeted interventions. CSV exports facilitate data analysis and reporting to stakeholders.

All rankings are accurately calculated using SQL window functions and displayed consistently across report cards, statistics dashboards, and exports. The system maintains data integrity through comprehensive validation and provides clear visual feedback to users.

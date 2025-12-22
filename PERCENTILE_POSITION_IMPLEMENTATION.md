# Percentile-Based Position Display Implementation

## Overview
This implementation adds a toggle system to control the visibility of position information on report cards, with all positions displayed as **percentiles only** (not ordinal ranks).

## Changes Made

### 1. Type Definitions

#### `src/types.ts` - ReportCardConfig Interface
Added three granular position toggles:
```typescript
showSubjectPosition?: boolean; // Toggle to show/hide position per subject
showArmPosition?: boolean; // Toggle to show/hide position within the class arm
showLevelPosition?: boolean; // Toggle to show/hide position across all arms in the level
```

- Legacy `showPosition` field kept for backward compatibility
- All new toggles default to `true` (show positions) for backward compatibility

#### `src/types/reportCardPrint.ts` - PrintConfig Interface
Added:
```typescript
showSubjectPosition?: boolean; // Toggle to show/hide position per subject
```

#### `src/types/reportCardPrint.ts` - PrintSubject Interface
Added:
```typescript
totalStudentsInSubject?: number | null; // Total students enrolled in this subject for percentile calculation
```

### 2. Helper Functions

#### `src/utils/reportCardHelpers.ts`
Added two new functions:

**calculatePercentile(position, total)**
- Calculates percentile rank from position and total
- Formula: `((total - position + 1) / total) * 100`
- Example: Position 3 out of 45 = ((45 - 3 + 1) / 45) * 100 = 95.5%
- Returns `null` if invalid data

**formatPercentile(percentile)**
- Formats percentile as "Top X%" for high performers or "Xth percentile"
- For 90th percentile and above: "Top X%" (e.g., "Top 5%", "Top 10%")
- For below 90th percentile: "Xth percentile" (e.g., "75th percentile")
- Returns "N/A" for invalid data

### 3. UI Configuration Updates

#### `src/components/AcademicClassManager.tsx`
- **Removed**: Single "Show Position in Class" checkbox
- **Added**: Three separate toggles in Design tab:
  1. **Show Subject Position (Percentile)** - controls subject position column visibility
  2. **Show Class/Arm Position (Percentile)** - controls arm ranking visibility
  3. **Show Level Position (Percentile)** - controls level ranking visibility

- **Added**: Info box explaining that positions are displayed as percentiles
- **Updated**: Default config values to include all three new toggles set to `true`

### 4. Report Card Display Updates

#### `src/components/reports/UnifiedReportCard.tsx`
- Imported new percentile helper functions: `calculatePercentile` and `formatPercentile`
- Added `showSubjectPosition` configuration flag (default: `true`)
- **Student Ranking Section**:
  - Arm ranking displays as percentile: `formatPercentile(calculatePercentile(positionInArm, totalStudentsInArm))`
  - Level ranking displays as percentile: `formatPercentile(calculatePercentile(positionInLevel, totalStudentsInLevel))`
- **Academic Performance Table**:
  - Subject position column now conditionally rendered based on `showSubjectPosition` toggle
  - Subject positions display as percentiles: `formatPercentile(calculatePercentile(subjectPosition, totalStudentsInSubject))`

### 5. Student Report View Updates

#### `src/components/StudentReportView.tsx`
- Added local implementations of `calculatePercentile` and `formatPercentile` functions
- Extracted granular toggles from `classReportConfig`:
  ```typescript
  const showSubjectPosition = classReportConfig?.showSubjectPosition !== false;
  const showArmPosition = classReportConfig?.showArmPosition !== false;
  const showLevelPosition = classReportConfig?.showLevelPosition !== false;
  ```

**Modern Layout Updates**:
- Standing card displays arm position as percentile when `showArmPosition` is enabled
- Level position displays as percentile when `showLevelPosition` is enabled
- Example: "Top 5%" instead of "3rd out of 45"

**Compact Layout Updates**:
- Arm position displays as percentile when `showArmPosition` is enabled
- Level position displays as percentile when `showLevelPosition` is enabled

**Professional Layout Updates**:
- Summary section displays arm and level positions as percentiles
- Respects toggle settings for visibility

**Table Headers and Body**:
- Subject position column conditionally rendered based on `showSubjectPosition`
- All positions in tables formatted as percentiles
- Works for both standard and composite (3-term) reports

## Percentile Calculation Examples

| Position | Total Students | Percentile | Display |
|----------|---------------|------------|---------|
| 1 | 45 | 100% | Top 0% |
| 2 | 45 | 97.8% | Top 3% |
| 3 | 45 | 95.6% | Top 5% |
| 5 | 45 | 91.1% | Top 9% |
| 10 | 45 | 80.0% | 80th percentile |
| 30 | 45 | 35.6% | 36th percentile |
| 45 | 45 | 2.2% | 2nd percentile |

## Backward Compatibility

### Legacy Support
- The `showPosition` field is maintained in `ReportCardConfig` for backward compatibility
- All new granular toggles default to `true`, maintaining current behavior
- Existing report configurations will continue to work without modification

### Migration Path
- Existing classes with `showPosition: true` will show all positions by default
- Users can selectively disable specific position types using the new toggles
- No database migration required

## Testing

### Unit Tests
- ✅ Percentile calculation function tested with various inputs
- ✅ Percentile formatting function tested for edge cases
- ✅ Existing `reportCardDualRanking` test passes without modification

### Build Verification
- ✅ TypeScript compilation successful with no errors
- ✅ Vite build completed successfully
- ✅ No breaking changes to existing components

## User Benefits

1. **Clearer Performance Context**: Percentiles provide immediate understanding of relative performance
2. **Granular Control**: Individual toggles for subject, arm, and level positions
3. **Professional Presentation**: Modern percentile-based rankings align with educational best practices
4. **Flexibility**: Teachers can choose which position information to display
5. **Consistency**: All positions use the same percentile format across all layouts

## Implementation Notes

- All position displays consistently use percentiles across different report layouts
- The percentile calculation handles edge cases (null values, missing data)
- The UI configuration provides clear explanations for each toggle
- The implementation maintains separation of concerns between data calculation and presentation

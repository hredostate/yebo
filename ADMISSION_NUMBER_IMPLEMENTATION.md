# Admission Number Generator Implementation Summary

## Overview
This implementation adds an automatic admission number generator that assigns unique admission numbers to students based on their class/campus during student creation or CSV upload.

## Admission Number Format

### Format Structure
```
{CAMPUS}/{YY}/{NNNN}
```

- **CAMPUS**: Campus identifier (UPSS, CAM, or CAGS)
- **YY**: 2-digit year (e.g., 25 for 2025)
- **NNNN**: 4-digit sequential number, zero-padded (e.g., 0001, 0012, 0123, 1234)

### Campus Assignments

#### 1. UPSS Campus
**Classes**: JSS 1, JSS 2, JSS 3, SS1, SS2, SS3  
**Format Example**: `UPSS/25/1234`

#### 2. CAM Campus
**Classes**: Elementary 1-5, Level 1-3, Preschool, Dahlia, Tulip  
**Format Example**: `CAM/25/0001`

#### 3. CAGS Campus
**Classes**: Grade 1-5, Kindergarten 1-3, Preschool A, Preschool B  
**Format Example**: `CAGS/25/1234`

## Implementation Details

### Files Modified/Created

1. **`src/utils/admissionNumber.ts`** (New)
   - Core utility functions for admission number generation
   - Class-to-campus mapping
   - Sequential number calculation
   - Validation functions

2. **`src/App.tsx`** (Modified)
   - Updated `handleAddStudent` function
   - Automatically generates admission numbers for new students without one
   - Fetches existing numbers to ensure uniqueness

3. **`src/components/StudentListView.tsx`** (Modified)
   - Updated `handleCsvUpload` function
   - Generates admission numbers for CSV imports
   - Tracks generated numbers in batch to avoid duplicates

4. **`tests/admissionNumberGenerator.test.ts`** (New)
   - Comprehensive test suite with 34 test cases
   - Tests all class mappings, format generation, and edge cases

5. **`package.json`** (Modified)
   - Added admission number test to test suite

6. **`tsconfig.tests.json`** (Modified)
   - Added admissionNumber.ts to test compilation

## Key Features

### 1. Automatic Generation
- Generates admission numbers automatically when not provided
- Works for both individual student creation and bulk CSV uploads
- Only generates if a valid class is assigned

### 2. Sequential Numbering
- Finds the next available number based on campus and year
- Handles gaps in existing numbers (always uses max + 1)
- Ignores numbers from different campuses or years

### 3. Batch Import Support
- Tracks generated numbers during CSV upload
- Prevents duplicates within the same batch
- Maintains uniqueness across multiple imports

### 4. Case-Insensitive Matching
- Class names are matched case-insensitively
- Handles variations like "jss 1", "JSS 1", etc.

### 5. Validation
- `isValidAdmissionNumber()` function validates format
- Checks campus prefix, year format, and sequential number format

## Usage Examples

### Example 1: Adding a Single Student
```typescript
// When adding a student to JSS 1 without admission number:
// - System fetches existing admission numbers
// - Determines class belongs to UPSS campus
// - Finds next sequential number
// - Generates: UPSS/25/0004 (if 0001-0003 exist)
```

### Example 2: CSV Upload
```csv
Name,Class,Email
John Doe,JSS 1,john@example.com
Jane Smith,Elementary 1,jane@example.com
Bob Johnson,Grade 5,bob@example.com
```
Results:
- John Doe → `UPSS/25/0004`
- Jane Smith → `CAM/25/0003`
- Bob Johnson → `CAGS/25/0002`

### Example 3: With Existing Admission Number
```typescript
// If CSV already has admission number, it's preserved:
// "John Doe,JSS 1,ADM-2024-001" → Uses "ADM-2024-001"
```

## Test Coverage

The implementation includes 34 comprehensive tests covering:

✅ Campus detection for all classes  
✅ Format generation and validation  
✅ Sequential number calculation  
✅ Case-insensitive matching  
✅ Batch generation without duplicates  
✅ Handling of invalid inputs  
✅ Year-specific numbering  
✅ Campus-specific numbering  

All tests pass successfully.

## Edge Cases Handled

1. **No class assigned**: Does not generate admission number
2. **Unrecognized class**: Does not generate admission number
3. **Existing admission number**: Preserves user-provided number
4. **Multiple campuses**: Correctly isolates sequential numbers by campus
5. **Year rollover**: Numbers reset for new year (different YY value)
6. **Database fetch failure**: Continues without admission number (non-critical)

## Benefits

1. **Consistency**: All admission numbers follow the same format
2. **Uniqueness**: Automatic sequential numbering prevents duplicates
3. **Traceability**: Format includes year and campus information
4. **Efficiency**: Batch processing during CSV uploads
5. **Flexibility**: Users can still provide custom admission numbers if needed
6. **Non-Breaking**: Existing functionality is preserved; generation only occurs when needed

## Security Considerations

- No sensitive data in admission numbers
- Numbers are predictable by design (sequential)
- No authentication/authorization changes required
- Read-only database access for number generation

## Performance Considerations

- Single database query per student creation for existing numbers
- Single database query for entire CSV batch (not per row)
- Efficient in-memory tracking during batch imports
- No additional indexes required

## Future Enhancements (Optional)

1. Admin interface to configure class-to-campus mappings
2. Custom format templates per school
3. Admission number history/audit trail
4. Bulk regeneration tool for existing students
5. Import existing admission numbers during migration

## Maintenance Notes

To add a new class:
1. Add class name to `CLASS_TO_CAMPUS` mapping in `src/utils/admissionNumber.ts`
2. Add test case in `tests/admissionNumberGenerator.test.ts`
3. Run test suite to verify

## Testing Performed

✅ Unit tests (34 test cases - all passing)  
✅ Manual testing with sample data  
✅ Integration with existing test suite  
✅ Format validation tests  
✅ Batch import simulation  

## Migration Path

For existing students without admission numbers:
1. Use the same generation logic
2. Run a one-time script to assign numbers to existing students
3. Script would group by class and assign sequential numbers

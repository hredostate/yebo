# Statistics Dashboard Enhancement - Testing Guide

## Overview
This guide covers manual testing procedures for the enhanced statistics functionality in the Report Card Manager.

## Prerequisites
1. Database must have the new migration applied: `supabase/migrations/20250101000000_add_statistics_ranking.sql`
2. At least one term with score entries and student enrollments
3. Active grading scheme configured in school settings
4. Multiple academic classes with different levels and arms

## Test Scenarios

### 1. Database Migration Verification

**Objective**: Verify that all database objects are created successfully

**Steps**:
1. Run the migration: `supabase migration up`
2. Connect to the database and verify:
   ```sql
   -- Check ranking_config table exists
   SELECT * FROM public.ranking_config;
   
   -- Check RPC functions exist
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name IN ('calculate_level_rankings', 'calculate_arm_rankings', 'get_level_statistics');
   ```

**Expected Results**:
- `ranking_config` table exists with correct columns
- All three RPC functions are present
- RLS policies are enabled on ranking_config

### 2. Ranking Configuration

**Objective**: Test ranking configuration management

**Steps**:
1. Navigate to School Settings (Admin/Principal only)
2. Create a ranking config entry (or verify default values work)
3. Set tie_method to 'dense'
4. Set min_subjects_for_ranking to 3
5. Set pass_threshold to 50

**Expected Results**:
- Configuration saves successfully
- Values are used in ranking calculations

### 3. Level Statistics Dashboard - Per Level View

**Objective**: Test comprehensive statistics view for an entire level

**Steps**:
1. Navigate to Result Manager > Statistics tab
2. Select a term that has score entries
3. Select a level (e.g., "JSS 1")
4. Verify View Mode is set to "Per Level"

**Expected Results**:
- **Summary Cards Display**:
  - Total Enrolled shows correct count
  - Average Score shows mean and median
  - Pass Rate shows percentage and count
  - Score Range shows min/max and std dev

- **Insights Panel Shows**:
  - Most Challenging subject (lowest average)
  - Best Performance subject (highest average)
  - Highest Fail Rate subject

- **Grade Distribution Chart**:
  - Shows bar chart with all grade levels
  - Counts match expected distribution
  - Percentages total to 100%

- **Arm Comparison Chart** (if multiple arms):
  - Shows comparison between different arms
  - Each arm displays average score and pass rate
  - Data is accurate per arm

- **Subject Analytics Panel**:
  - Bar chart shows all subjects by average score
  - Table shows detailed stats (avg, min, max, fail rate)
  - Top 3 subjects highlighted with 🏆
  - Bottom 3 subjects highlighted with ⚠️
  - High fail rate subjects (>50%) highlighted with ⚡
  - Export CSV button works

- **Rankings Table**:
  - All students listed with correct rankings
  - Top 3 students show medals (🥇🥈🥉)
  - Search functionality filters students
  - Sorting works on all columns
  - Pagination works correctly
  - Export CSV button downloads correct data
  - Grade counts display correctly
  - Students with insufficient subjects show rank reason

- **Top/Bottom Students Panels**:
  - Top 10 students listed in order
  - Bottom 10 students listed
  - Scores are accurate

### 4. Level Statistics Dashboard - Per Arm View

**Objective**: Test statistics for a specific arm/class

**Steps**:
1. From Level Statistics Dashboard
2. Switch View Mode to "Per Arm"
3. Select an arm from the dropdown
4. Verify all statistics update

**Expected Results**:
- Summary cards show arm-specific data
- Grade distribution is arm-specific
- Arm comparison chart is hidden (not applicable)
- Rankings table shows only students from selected arm
- Search and sort work correctly
- Export includes only selected arm students

### 5. Search and Filter Functionality

**Objective**: Test search and filtering across different views

**Steps**:
1. In Rankings Table, enter a student name in search box
2. Verify results filter immediately
3. Try searching by admission number
4. Try searching by arm name (in per-level view)
5. Clear search and verify full list returns

**Expected Results**:
- Search is case-insensitive
- Results update in real-time
- No results message displays when search has no matches
- Pagination resets to page 1 on search
- Clear search restores original pagination

### 6. Sorting Functionality

**Objective**: Test column sorting in rankings table

**Steps**:
1. Click "Rank" column header
2. Verify ascending sort (1, 2, 3...)
3. Click again for descending sort
4. Try sorting by "Average Score"
5. Try sorting by "Name"
6. Try sorting by "Arm" (in per-level view)

**Expected Results**:
- Sort icon changes to indicate current sort direction
- Data sorts correctly ascending/descending
- Unranked students (with null rank) sort to end
- Text columns sort alphabetically
- Number columns sort numerically

### 7. Pagination

**Objective**: Test pagination controls

**Steps**:
1. With more than 20 students, verify pagination appears
2. Click "Next" button
3. Click "Previous" button
4. Click specific page number
5. Verify ellipsis appears for many pages

**Expected Results**:
- Shows 20 students per page
- Page numbers display correctly
- First/Last pages always visible
- Current page highlighted
- Previous/Next buttons disabled appropriately
- Item count shows correct range

### 8. Export Functionality

**Objective**: Test CSV export features

**Steps**:
1. Click "Export CSV" on rankings table
2. Open downloaded CSV file
3. Click "Export CSV" on subject analytics
4. Open downloaded CSV file
5. Click "Export Level Statistics" button
6. Open downloaded CSV file

**Expected Results**:
- Files download with timestamp in filename
- Rankings export includes all columns
- Subject analytics export includes all stats
- Level statistics export includes summary data
- Data is properly formatted in CSV
- Special characters are escaped correctly

### 9. Dark Mode Compatibility

**Objective**: Verify all components work in dark mode

**Steps**:
1. Enable dark mode in app settings
2. Navigate to Statistics Dashboard
3. Review all components for readability
4. Test all interactive elements

**Expected Results**:
- All text is readable in dark mode
- Charts use appropriate dark mode colors
- Buttons and inputs have correct dark mode styling
- No white backgrounds where dark is expected
- Icons and emojis are visible

### 10. RPC Function Performance

**Objective**: Test RPC function performance with real data

**Steps**:
1. Open browser developer tools > Network tab
2. Load Statistics Dashboard
3. Monitor RPC calls
4. Note response times

**Expected Results**:
- calculate_level_rankings returns in < 2 seconds for 100 students
- calculate_arm_rankings returns in < 1 second for 50 students
- get_level_statistics returns in < 3 seconds for full level
- No timeout errors
- Data loads progressively (loading spinner shows)

### 11. Error Handling

**Objective**: Test error handling and edge cases

**Steps**:
1. Select a term with no score entries
2. Select a level with no enrolled students
3. Disconnect from internet briefly
4. Test with student having 0 subjects
5. Test with student having all subjects failed

**Expected Results**:
- Appropriate "No data" messages display
- Loading states show correctly
- Error messages are user-friendly
- App doesn't crash on edge cases
- Unranked students show clear reason

### 12. Data Diagnostics Panel (Admin Only)

**Objective**: Verify data diagnostics panel works separately

**Steps**:
1. Create a new view/page for DataDiagnosticsPanel (if not already created)
2. Navigate to the panel
3. Select a level with known data issues
4. Review displayed issues

**Expected Results**:
- Panel shows organized issues by type
- Orphan results are categorized
- Missing assignments are listed
- Duplicate records are identified
- Warning about false positives is visible
- Issue counts are accurate

## Performance Benchmarks

### Expected Performance Metrics
- **Initial Load**: < 2 seconds for dashboard
- **RPC Calls**: 
  - Level rankings (100 students): < 2s
  - Arm rankings (50 students): < 1s
  - Level statistics: < 3s
- **Chart Rendering**: < 500ms
- **Search/Filter**: < 100ms (instant)
- **Export CSV**: < 1s for 500 rows

### Browser Compatibility
Test in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## Known Limitations

1. **RPC Functions require migration**: Database must have migration applied before using enhanced dashboard
2. **Grading Scheme dependency**: Requires active grading scheme for grade distribution
3. **Minimum data requirements**: Needs at least 3 subjects per student for ranking (configurable)
4. **Campus filtering**: Currently filters by first student's campus in class (cross-campus classes may show unexpected results)

## Troubleshooting

### Issue: Statistics don't load
**Solution**: 
1. Check browser console for errors
2. Verify migration is applied
3. Ensure term has score entries
4. Check RLS policies allow user access

### Issue: Rankings show all students as unranked
**Solution**:
1. Check ranking_config.min_subjects_for_ranking value
2. Verify students have enough subjects
3. Check that score_entries exist for the term

### Issue: Charts don't display
**Solution**:
1. Verify Recharts library is installed
2. Check for console errors
3. Ensure data is in correct format

### Issue: Export doesn't download
**Solution**:
1. Check browser popup blocker
2. Verify exportToCsv utility function exists
3. Check browser console for errors

## Security Checklist

- [x] RLS policies enabled on ranking_config table
- [x] RPC functions use SECURITY DEFINER
- [x] No SQL injection vulnerabilities
- [x] No XSS vulnerabilities in charts/tables
- [x] User permissions checked before access
- [x] No sensitive data exposed in exports
- [x] CodeQL scan passed with 0 alerts

## Manual Test Completion Checklist

- [ ] All 12 test scenarios completed
- [ ] All expected results verified
- [ ] Performance benchmarks met
- [ ] Browser compatibility confirmed
- [ ] Known limitations documented
- [ ] Troubleshooting guide tested
- [ ] Security checklist verified
- [ ] Screenshots taken for documentation
- [ ] Issues logged (if any found)
- [ ] User acceptance testing completed

## Next Steps

After successful testing:
1. Update user documentation
2. Train administrators on new features
3. Monitor production usage for first week
4. Gather user feedback
5. Plan any necessary improvements

## Support

For issues or questions:
- Check this guide first
- Review console logs for errors
- Verify database migration status
- Contact development team with specific error messages

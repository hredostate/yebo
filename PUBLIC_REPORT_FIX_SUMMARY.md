# Public Report Token Parsing Fix - Summary

## Problem Statement
Public report links were failing with HTTP 400 errors due to polluted tokens in Supabase queries:
- URL: `https://schoolguardian360.com/report/5080-1-1766419518668-qyshsl/adun-tina#Dashboard`
- Supabase query: `public_token=eq.5080-1-1766419518668-qyshsl%2Fadun-tina:1`
- Decoded: `5080-1-1766419518668-qyshsl/adun-tina:1`
- Result: HTTP 400, no data loaded

## Root Causes Identified

### 1. Token Parsing Issues
- Token extraction was polluted with:
  - Student slug (`/adun-tina`)
  - `:1` suffix (unknown artifact)
  - Hash fragments (`#Dashboard`)
  - Query parameters
- No centralized token parsing logic

### 2. Routing Order Issues
- Public report check happened AFTER booting check
- Authenticated app routing logic could hijack public report URLs
- Hash synchronization could interfere with public routes

### 3. Schema Mapping Mismatch
- Database schema uses: `total_score`, `grade_label`, `remark`, `subject_position`
- Code expected: `score`, `grade`, `teacher_comment`, `position`
- Result: Subjects wouldn't display even if data loaded

## Solutions Implemented

### 1. Centralized Token Parsing (`src/utils/reportUrlHelpers.ts`)
Created `parsePublicReportTokenFromLocation()` that:
- Extracts only the first path segment after `/report/`
- Strips `:1` suffix using regex split
- Removes query params and hash fragments
- Handles both formats:
  - `/report/<token>` (backward compatible)
  - `/report/<token>/<slug>` (canonical)
- Defensive validation to ensure no slashes in token

### 2. Routing Priority Fix (`src/App.tsx`)
Moved public route check to the TOP of render logic:
```typescript
// CRITICAL: Check for public routes FIRST, before any auth/booting logic
const pathname = window.location.pathname;
if (pathname.startsWith('/report/')) {
    // Render PublicReportView immediately
}
// ... then check booting, auth, etc.
```

### 3. Schema Field Mapping (`src/components/PublicReportView.tsx`)
Updated interface and rendering code:
- `subject.score` → `subject.total_score`
- `subject.grade` → `subject.grade_label`
- `subject.teacher_comment` → `subject.remark`
- `subject.position` → `subject.subject_position`

## Testing

### Automated Tests
Created `tests/publicReportTokenParsing.test.ts` with 14 test cases:
- ✅ Basic token format
- ✅ Token with student slug
- ✅ Token with `:1` suffix
- ✅ Token with slug and `:1`
- ✅ Token with hash fragment
- ✅ Token with slug and hash
- ✅ Token with query parameters
- ✅ Multiple pollution sources combined
- ✅ UUID format tokens
- ✅ Edge cases (empty, invalid paths)

All tests pass ✅

### Manual Verification Test Cases

Test these URLs manually to verify the fix:

1. **Basic format** (backward compatible):
   ```
   /report/5080-1-1766419518668-qyshsl
   ```

2. **Canonical format**:
   ```
   /report/5080-1-1766419518668-qyshsl/adun-tina
   ```

3. **With hash fragment** (original failing case):
   ```
   /report/5080-1-1766419518668-qyshsl/adun-tina#Dashboard
   ```

4. **With query parameters**:
   ```
   /report/5080-1-1766419518668-qyshsl/adun-tina?foo=bar
   ```

5. **Logged in as student/staff** (ensure no redirect):
   - Login as a student
   - Visit a public report link
   - Should show the report, NOT redirect to dashboard

## Expected Results

✅ Opening `/report/<token>/<slug>#Dashboard` loads the report without 400  
✅ Supabase request uses `public_token=eq.<token>` only (no pollution)  
✅ Subjects list displays (13-20 subjects typical)  
✅ Being logged in as student/staff doesn't redirect away from public report  
✅ Backward compatibility maintained for `/report/<token>` format  
✅ Hash fragments and query params don't pollute token  

## Files Changed

1. `src/utils/reportUrlHelpers.ts` - Added `parsePublicReportTokenFromLocation()`
2. `src/components/PublicReportView.tsx` - Use centralized parser, fix schema mapping
3. `src/App.tsx` - Move public route check before auth logic
4. `tests/publicReportTokenParsing.test.ts` - Comprehensive test suite

## Backward Compatibility

✅ All existing token formats continue to work:
- Simple tokens: `/report/<token>`
- UUID tokens: `/report/<uuid>`
- Legacy links without slugs remain functional

## Security Considerations

- Token parsing is defensive and validates input
- No new security vulnerabilities introduced
- Public report access still requires valid, non-expired token
- Authentication bypass is intentional for public routes only

## Next Steps for Verification

1. Deploy to staging/production
2. Test with real report tokens
3. Verify subjects display correctly (13-20 typical)
4. Test as both authenticated and unauthenticated users
5. Monitor Supabase logs for 400 errors (should be eliminated)
6. Check that hash navigation (#Dashboard) works without polluting token

## Performance Impact

- Minimal: Token parsing is O(1) string operations
- No database queries affected
- Routing check moved earlier (actually improves performance for public routes)

# Report Card Link Fixes - Testing Guide

## Overview
This document outlines the testing procedures for the report card link improvements implemented in this PR.

## Test Scenarios

### 1. Token Sanitization Tests

#### Test Case 1.1: Token with Port Number Suffix
**Input:** `https://www.schoolguardian360.com/report/4249-1-1766410025074-vqgah:1`
**Expected:** Report loads successfully, `:1` suffix is stripped
**Steps:**
1. Navigate to the URL with `:1` suffix
2. Verify no 400 error occurs
3. Verify report data loads correctly

#### Test Case 1.2: Token with Query Parameters
**Input:** `https://www.schoolguardian360.com/report/john-doe-123-token?source=sms`
**Expected:** Report loads, query params ignored
**Steps:**
1. Navigate to URL with query params
2. Verify report loads correctly
3. Check console for no errors

#### Test Case 1.3: Token with Hash Fragment
**Input:** `https://www.schoolguardian360.com/report/john-doe-123-token#footer`
**Expected:** Report loads, hash ignored
**Steps:**
1. Navigate to URL with hash
2. Verify report loads correctly

### 2. Token Generation with Student Name

#### Test Case 2.1: Generate New Report Link
**Steps:**
1. Log in as teacher/admin
2. Navigate to a student's report
3. Click "Send to Parent" button
4. Check the generated URL in the notification
**Expected:** URL format: `https://domain/report/student-name-123-timestamp-hash`

#### Test Case 2.2: Special Characters in Name
**Student:** O'Brien, John Jr.
**Expected Token Pattern:** `obrien-john-jr-123-timestamp-hash`
**Steps:**
1. Generate link for student with special characters
2. Verify special chars are removed/normalized

#### Test Case 2.3: Long Names
**Student:** Christopher Alexander Montgomery-Williams
**Expected:** Name slug truncated to 30 chars max
**Steps:**
1. Generate link for student with very long name
2. Verify token length is reasonable

### 3. Design Enhancements

#### Test Case 3.1: Color-Coded Grade Badges
**Steps:**
1. Open a report with various grades (A, B, C, D, F)
2. Verify grade colors:
   - A: Green background
   - B: Blue background
   - C: Yellow background
   - D: Orange background
   - F: Red background

#### Test Case 3.2: School Logo Display
**Steps:**
1. Configure school logo in settings
2. Open public report link
3. Verify logo appears in header
4. Test with no logo (should show fallback)

#### Test Case 3.3: Performance Visualization
**Steps:**
1. Open report with multiple subjects
2. Verify performance chart displays
3. Check color bars match grade colors
4. Verify responsive layout on mobile

#### Test Case 3.4: Watermark
**Steps:**
1. Open report
2. Verify "OFFICIAL REPORT" watermark visible (subtle)
3. Print/print preview to verify watermark prints

#### Test Case 3.5: Verification Reference
**Steps:**
1. Open report
2. Scroll to footer
3. Verify "Ref: [token-prefix]..." is displayed

### 4. Print Functionality

#### Test Case 4.1: Single Page Report
**Steps:**
1. Open short report (5-7 subjects)
2. Click Print/Save PDF
3. Verify entire report fits on one A4 page
4. Check margins are appropriate

#### Test Case 4.2: Multi-Page Report
**Steps:**
1. Open long report (15+ subjects)
2. Click Print/Save PDF
3. Verify:
   - Header doesn't repeat on every page
   - Table rows don't split across pages
   - Signature section stays together
   - Page breaks are logical

#### Test Case 4.3: Table Row Integrity
**Steps:**
1. Open report with many subjects
2. Print preview
3. Verify no subject rows are split between pages
4. Verify table headers appear appropriately

#### Test Case 4.4: Color Preservation
**Steps:**
1. Open report
2. Print preview
3. Verify grade colors are preserved
4. Verify header gradient prints correctly

### 5. Mobile Responsiveness

#### Test Case 5.1: Mobile View (320px)
**Device:** iPhone SE
**Steps:**
1. Open report on mobile device/emulator
2. Verify all content is readable
3. Check horizontal scroll is minimal
4. Test print button is accessible

#### Test Case 5.2: Tablet View (768px)
**Device:** iPad
**Steps:**
1. Open report on tablet
2. Verify layout is optimized
3. Test print functionality

#### Test Case 5.3: Portrait/Landscape
**Steps:**
1. Open report on mobile
2. Rotate device
3. Verify layout adapts properly

### 6. WhatsApp/Social Media Preview

#### Test Case 6.1: Deploy Edge Function
**Steps:**
```bash
cd /path/to/repo
supabase functions deploy report-preview
```
**Expected:** Function deploys successfully

#### Test Case 6.2: Test Edge Function Response
**Steps:**
```bash
curl https://<project-ref>.supabase.co/functions/v1/report-preview/<test-token>
```
**Expected:** HTML response with OG tags

#### Test Case 6.3: WhatsApp Preview
**Steps:**
1. Generate report link
2. Get edge function URL: `https://<project-ref>.supabase.co/functions/v1/report-preview/<token>`
3. Send to WhatsApp Web
4. Verify preview shows:
   - Student name and term in title
   - School name in description
   - School logo as image

#### Test Case 6.4: Facebook/Twitter Preview
**Use:** Facebook Sharing Debugger or Twitter Card Validator
**Steps:**
1. Enter edge function URL
2. Scrape/validate
3. Verify OG tags are detected

#### Test Case 6.5: Redirect Functionality
**Steps:**
1. Click edge function URL in browser
2. Verify automatic redirect to report page
3. Verify redirect happens within 1 second

### 7. Browser Compatibility

#### Test Case 7.1: Chrome
- Open report
- Print preview
- Verify all features work

#### Test Case 7.2: Firefox
- Open report
- Print preview
- Verify all features work

#### Test Case 7.3: Safari
- Open report
- Print preview
- Verify all features work

#### Test Case 7.4: Mobile Browsers
- Chrome Mobile
- Safari iOS
- Samsung Internet

### 8. Performance Tests

#### Test Case 8.1: Load Time
**Steps:**
1. Open report link (cold start)
2. Measure time to interactive
**Expected:** < 3 seconds

#### Test Case 8.2: Large Reports
**Steps:**
1. Generate report with 20+ subjects
2. Measure load time
3. Test print performance
**Expected:** Remains responsive

#### Test Case 8.3: School Logo Loading
**Steps:**
1. Open report with external school logo
2. Verify logo loads efficiently
3. Check no CORS errors

### 9. Security Tests

#### Test Case 9.1: Expired Token
**Steps:**
1. Create report with short expiry
2. Wait for expiry
3. Try to access
**Expected:** "Link Expired" message

#### Test Case 9.2: Invalid Token
**Steps:**
1. Navigate to `/report/invalid-token-xyz`
**Expected:** "Report Not Found" error

#### Test Case 9.3: Malformed Token
**Steps:**
1. Try various malformed tokens
2. Verify graceful error handling
**Expected:** No server errors, proper error messages

### 10. Accessibility Tests

#### Test Case 10.1: Screen Reader
**Steps:**
1. Open report with screen reader
2. Verify all content is accessible
3. Check proper heading hierarchy

#### Test Case 10.2: Keyboard Navigation
**Steps:**
1. Navigate report using only keyboard
2. Verify print button is focusable
3. Check tab order is logical

#### Test Case 10.3: Color Contrast
**Steps:**
1. Use color contrast checker
2. Verify grade badges meet WCAG AA
3. Check all text is readable

## Regression Tests

### Test Case R.1: Existing Reports Still Work
**Steps:**
1. Use old report link format (UUID without name)
2. Verify backward compatibility

### Test Case R.2: Report Generation Still Works
**Steps:**
1. Generate new report card
2. Publish report
3. Verify all data saves correctly

### Test Case R.3: No Breaking Changes
**Steps:**
1. Test other report-related features
2. Verify teacher report view still works
3. Check result manager still functions

## Test Results Template

```
Test Date: _________________
Tester: _________________
Environment: _________________

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1.1       |        |       |
| 1.2       |        |       |
| ...       |        |       |

Issues Found:
1. 
2. 
3. 

Overall Assessment:
- [ ] All critical tests pass
- [ ] All design requirements met
- [ ] No regressions detected
- [ ] Ready for production
```

## Automated Testing (Future)

Consider implementing:
1. Playwright tests for token sanitization
2. Visual regression tests for print layouts
3. API tests for edge function
4. Load tests for concurrent access

## Rollout Plan

1. **Testing Phase** (1-2 days)
   - Complete manual testing
   - Fix any issues found
   - Deploy edge function to staging

2. **Soft Launch** (2-3 days)
   - Deploy to production
   - Generate new links with name slugs
   - Monitor error rates
   - Collect user feedback

3. **Full Rollout**
   - Enable for all schools
   - Update documentation
   - Train support team

## Support Checklist

- [ ] Update user documentation
- [ ] Create troubleshooting guide
- [ ] Update SMS templates with edge function URLs
- [ ] Monitor edge function invocations
- [ ] Set up alerts for high error rates

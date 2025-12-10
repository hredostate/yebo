# Navigation Debugging Guide

## Overview
This guide explains how to use the debugging logs added to diagnose sidebar navigation issues with "Score Review" and "Predictive Analytics" views.

## Changes Made

### 1. Console Logging Added
Comprehensive logging has been added throughout the navigation flow to track:
- When a user clicks a sidebar menu item
- What view is being navigated to
- Hash changes in the URL
- What view AppRouter receives and renders

### 2. Improved Error Handling
The default case in AppRouter now shows a detailed error message instead of silently falling back to Dashboard, including:
- The name of the view that couldn't be found
- The full path that was attempted
- A button to return to Dashboard

## How to Test

### Prerequisites
1. Log in as a user with appropriate permissions:
   - For **Score Review**: User needs `score_entries.view_all` permission
   - For **Predictive Analytics**: User needs `view-predictive-analytics` permission

### Test Steps

1. **Open Browser Developer Tools**
   - Press F12 or right-click → Inspect
   - Go to the Console tab
   - Clear the console for a fresh start

2. **Navigate to Score Review**
   - In the sidebar, expand "Academics"
   - Click on "Score Review"
   - **Watch the console** for log messages

3. **Navigate to Predictive Analytics**
   - In the sidebar, expand "Administration"
   - Click on "Predictive Analytics"
   - **Watch the console** for log messages

## Expected Console Output

### Successful Navigation
When navigation works correctly, you should see:

```
[Sidebar] Navigating to: Score Review from: Dashboard
[Sidebar] Current state - currentView: Score Review baseView: Score Review
[App] Syncing currentView to hash: Score Review
[App] Hash changed - setting currentView to: Score Review from hash: Score Review
[AppRouter] Rendering with currentView: Score Review baseView: Score Review userType: staff
```

### Failed Navigation
If navigation fails, you might see:

#### Scenario 1: View Not Found in AppRouter
```
[Sidebar] Navigating to: Score Review from: Dashboard
[App] Syncing currentView to hash: Score Review
[App] Hash changed - setting currentView to: Score Review
[AppRouter] Rendering with currentView: Score Review baseView: Score Review userType: staff
[AppRouter] Unknown view requested: Score Review Full currentView: Score Review
```
→ This means the switch case is missing or not matching

#### Scenario 2: View Redirected to Dashboard
```
[Sidebar] Navigating to: Score Review from: Dashboard
[App] Syncing currentView to hash: Score Review
[App] Hash changed - setting currentView to: Dashboard from hash: Dashboard
[AppRouter] Rendering with currentView: Dashboard baseView: Dashboard userType: staff
```
→ This means something is changing the view back to Dashboard

#### Scenario 3: Permission Issue
If the menu item doesn't appear at all in the sidebar, check:
- User permissions in the database
- The `hasPermission` function in Sidebar.tsx
- The `filteredNavStructure` logic

## What to Look For

### 1. View Name Consistency
- Check if the view name stays consistent throughout the flow
- Example: "Score Review" should not become "score-review" or "ScoreReview"

### 2. Hash Manipulation
- Check the URL bar - does the hash change correctly?
- Example: `#Score%20Review` (URL encoded) or `#Score Review`

### 3. Unexpected Redirects
- Look for any log showing the view changing unexpectedly
- Check if `Dashboard` appears when it shouldn't

### 4. Error Messages
- Check for any JavaScript errors in the console
- Red error messages might indicate component rendering failures

## Common Issues and Solutions

### Issue 1: Menu Item Not Visible
**Symptom**: Can't find "Score Review" or "Predictive Analytics" in sidebar
**Check**: 
- User has the required permission
- Item not filtered out by search
- Group is expanded

**Fix**: Grant proper permissions in user management

### Issue 2: "View Not Found" Error
**Symptom**: Red error box appears with "View Not Found"
**Check**: Console for `[AppRouter] Unknown view requested:`
**Potential Causes**:
- Switch case missing (unlikely - we verified they exist)
- View name mismatch (check VIEWS constant)
- Case sensitivity issue

### Issue 3: Immediate Redirect to Dashboard
**Symptom**: Click menu item, briefly see loading, then Dashboard appears
**Check**: Console logs for what's changing the view
**Potential Causes**:
- Permission check redirecting
- useEffect resetting view
- Error boundary catching component error

### Issue 4: URL Hash Doesn't Change
**Symptom**: Click menu item but URL stays the same
**Check**: Look for `[App] Syncing currentView to hash:` log
**Potential Causes**:
- setCurrentView not being called
- Hash sync logic preventing update

## Reporting Results

When reporting back, please include:

1. **Full Console Log Output**
   - Copy all log messages from clicking the menu item
   - Include any error messages (in red)

2. **URL Bar State**
   - What the URL shows before clicking
   - What it shows after clicking

3. **User Permissions**
   - List the user's permissions
   - Confirm they have the required permission

4. **Visual Behavior**
   - What you see on screen
   - Any error messages or unexpected content

5. **Browser and Environment**
   - Browser name and version
   - Any browser extensions that might interfere
   - Network tab if API calls are failing

## Clean Up

Once the issue is identified and fixed, the console.log statements should be removed from:
- `src/components/Sidebar.tsx` (lines 149, 289)
- `src/components/AppRouter.tsx` (line 81, 803-807)
- `src/App.tsx` (lines 1251, 1266)

The improved error message UI in AppRouter should be kept as it provides better diagnostics than the original simple text.

## Contact

If the logs show something unexpected, please provide:
- Screenshots of the console
- Screenshots of the sidebar and main view
- The complete log sequence from clicking to the result

This will help diagnose and fix the root cause quickly.

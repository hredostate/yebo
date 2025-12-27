# Subject Groups Implementation Summary

## Overview
This document summarizes the implementation of mutually exclusive subject groups in the ClassSubjectsManager and StudentPortal components.

## Feature Description
The Subject Groups feature allows administrators to create groups of subjects where students must select a limited number from each group. This is useful for scenarios like:
- **Religious Studies**: Students pick 1 from CRS or IRS
- **Trade Subjects**: Students pick 1 from Catering, Fashion Design, Auto Mech, Office Practice
- **Science Electives**: Students pick 1-2 from Physics, Chemistry, Biology

## Implementation Details

### 1. Database Schema
**New Tables:**
- `subject_groups`: Stores group definitions with min/max selection constraints
  - Fields: id, school_id, class_id, group_name, min_selections, max_selections, created_at, updated_at
  - Unique constraint on (school_id, class_id, group_name)
  
- `subject_group_members`: Links subjects to groups
  - Fields: id, group_id, subject_id
  - Unique constraint on (group_id, subject_id)

**Security:**
- RLS policies enabled on both tables
- Authenticated users can read and write to both tables

### 2. TypeScript Types
Added interfaces in `src/types.ts`:
```typescript
export interface SubjectGroup {
    id: number;
    school_id: number;
    class_id: number;
    group_name: string;
    min_selections: number;
    max_selections: number;
    created_at?: string;
    updated_at?: string;
}

export interface SubjectGroupMember {
    id: number;
    group_id: number;
    subject_id: number;
}
```

### 3. Service Layer
Created `src/services/subjectGroupService.ts` with functions:
- `getSubjectGroupsForClass()`: Fetch groups and members for a class
- `createSubjectGroup()`: Create a new group
- `updateSubjectGroup()`: Update group settings
- `deleteSubjectGroup()`: Delete a group (cascades to members)
- `addSubjectToGroup()`: Add a subject to a group
- `removeSubjectFromGroup()`: Remove a subject from a group
- `validateStudentSelections()`: Validate student selections against group rules

### 4. Admin Interface (ClassSubjectsManager)
**Features Added:**
- Create new subject groups with min/max selection settings
- Display all groups for selected class
- Add/remove subjects from groups via dropdown
- Delete groups
- Visual badges showing which group each subject belongs to

**UI Components:**
- Purple-themed group cards with group name and selection requirements
- Subject list shows group membership with 📦 badge
- Dropdown to add optional subjects to groups (excludes compulsory subjects)
- Delete button for each group

### 5. Student Interface (StudentPortal)
**Features Added:**
- Subjects organized by groups with clear headers
- Selection counter showing "X/Y selected" for each group
- Real-time validation preventing invalid selections
- Error messages when group constraints are violated
- Visual distinction for grouped vs ungrouped subjects

**Validation:**
- Prevents selecting more than max from a group
- Shows errors if less than min selected when saving
- Real-time feedback as students make selections
- Purple-themed UI for grouped subjects to distinguish from regular subjects

### 6. Data Flow Integration
**App.tsx Changes:**
- Added `subjectGroups` and `subjectGroupMembers` to state
- Fetch both tables in background data loading
- Pass data through AppRouter to all components
- Incremented array indices for all subsequent data fetches

**SuperAdminConsole Changes:**
- Added `subjectGroups` and `subjectGroupMembers` to props
- Pass data and handlers to ClassSubjectsManager
- Added `onRefreshData` callback for real-time updates

## Usage Guide

### For Administrators
1. Navigate to Super Admin Console → Structure → Class Subjects
2. Select a class level (e.g., SS 1)
3. Click "Create Group" in the Subject Groups section
4. Enter group name (e.g., "Religious Studies")
5. Set min/max selections (e.g., 1 and 1 for "pick exactly 1")
6. Click "Create"
7. Use the dropdown to add subjects to the group
8. Subjects will now show a purple badge with the group name

### For Students
1. Navigate to My Subjects in StudentPortal
2. Subject groups appear with purple headers showing selection requirements
3. The header shows "Selected X/Y from [Group Name]"
4. When max is reached, attempting to select another subject from the group shows an error
5. Saving with incomplete selections shows validation errors
6. All validation is real-time and prevents invalid states

## Technical Notes

### Compatibility
- Works alongside existing arm quota functionality
- Does not interfere with compulsory subjects
- Integrates with existing subject selection workflow

### Performance
- Groups and members fetched once per class selection
- Real-time validation uses memoized data structures
- No extra database queries during selection

### Edge Cases Handled
- Deleting a group removes all members
- Subjects can only belong to one group
- Compulsory subjects excluded from groups
- Empty groups display appropriate messages
- Ungrouped subjects still render normally

## Files Modified
1. `src/databaseSchema.ts` - Added table definitions
2. `src/types.ts` - Added TypeScript interfaces
3. `src/services/subjectGroupService.ts` - New service file
4. `src/App.tsx` - State management and data fetching
5. `src/components/SuperAdminConsole.tsx` - Props passing
6. `src/components/ClassSubjectsManager.tsx` - Admin UI
7. `src/components/StudentPortal.tsx` - Student UI with validation

## Testing Recommendations

### Manual Testing
1. **Group Creation**
   - Create a group with min=1, max=1
   - Create a group with min=1, max=2
   - Verify unique constraint (try duplicate names)

2. **Subject Management**
   - Add subjects to a group
   - Remove subjects from a group
   - Verify subjects can only be in one group

3. **Student Selection**
   - Select less than min, verify error on save
   - Select more than max, verify prevented during selection
   - Select exact amount, verify saves successfully
   - Test with multiple groups

4. **Edge Cases**
   - Delete group, verify subjects become ungrouped
   - Try selecting from empty group
   - Test with no groups (should work as before)
   - Test with compulsory subjects (should not be groupable)

### Build Validation
✅ Project builds successfully with no TypeScript errors

## Future Enhancements
Potential improvements:
- Bulk add subjects to groups
- Clone groups across classes
- Group templates for common configurations
- Analytics on group selection patterns
- Group-level capacity limits

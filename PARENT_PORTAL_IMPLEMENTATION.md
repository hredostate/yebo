# Parent/Guardian Portal Implementation Guide

## Overview

This document describes the complete parent/guardian account system that has been implemented in the School Guardian 360 application. The system allows parents to have their own login accounts linked to one or more children, with access to reports, fees, attendance, and school communication.

## Architecture

### Database Tables

#### 1. `parent_profiles`
Stores parent account information.

```sql
- id: UUID (references auth.users)
- school_id: INTEGER
- name: TEXT
- email: TEXT (optional)
- phone_number: TEXT (primary contact)
- phone_number_2: TEXT (secondary contact)
- address: TEXT
- occupation: TEXT
- avatar_url: TEXT
- created_at: TIMESTAMP
```

**RLS Policies:**
- Parents can view/update own profile
- Staff can view parent profiles in their school
- Admins can manage parent profiles

#### 2. `parent_student_links`
Links parents to students with granular permissions.

```sql
- id: SERIAL PRIMARY KEY
- parent_id: UUID (references parent_profiles)
- student_id: INTEGER (references students)
- relationship: TEXT ('Father', 'Mother', 'Guardian', 'Other')
- is_primary_contact: BOOLEAN
- can_view_reports: BOOLEAN
- can_view_finances: BOOLEAN
- can_view_attendance: BOOLEAN
- can_communicate: BOOLEAN
- created_at: TIMESTAMP
```

**RLS Policies:**
- Parents can view own links
- Staff can manage links for students in their school

### Backend Edge Functions

Located in `/supabase/functions/manage-users/index.ts`

#### Actions:

1. **`create_parent_account`**
   - Creates individual parent account
   - Links to one or more students
   - Sends credentials via SMS
   - Parameters: `name`, `phone_number`, `phone_number_2`, `student_ids`, `relationship`, `school_id`

2. **`bulk_create_parent_accounts`**
   - Auto-creates parent accounts from existing student father/mother data
   - Reuses existing accounts for duplicate phone numbers
   - Parameters: `school_id`

3. **`link_parent_to_student`**
   - Links existing parent to additional student
   - Parameters: `parent_id`, `student_id`, `relationship`

4. **`unlink_parent_from_student`**
   - Removes parent-student link
   - Parameters: `parent_id`, `student_id`

### Frontend Components

#### Authentication Flow

1. **LandingPage** (`src/components/LandingPage.tsx`)
   - Updated with "Parent/Guardian Portal" button
   - Routes to parent login page

2. **ParentLoginPage** (`src/components/ParentLoginPage.tsx`)
   - Username/password authentication
   - Converts username to email format (@upsshub.com)
   - Device limit handling
   - Forgot password support

3. **App.tsx** Updates
   - Added parent user type support
   - Parent profile loading in `fetchData`
   - Loads linked children with permissions
   - Routes to parent dashboard on successful auth

#### Parent Dashboard

**ParentDashboard** (`src/components/ParentDashboard.tsx`)
- Child switcher for multiple children
- Tabbed interface:
  - **Overview**: Quick stats and recent activity
  - **Report Cards**: View published reports
  - **Attendance**: View attendance records
  - **Fees**: View invoices and balances
  - **Profile**: Parent profile information

**ChildSwitcher** (`src/components/parent/ChildSwitcher.tsx`)
- Dropdown for parents with multiple children
- Static display for single child
- Shows class, arm, and relationship

#### Admin Management

**ParentAccountsView** (`src/components/admin/ParentAccountsView.tsx`)
- List all parent accounts with linked children
- Create individual parent accounts
- Bulk create from existing student data
- Reset passwords
- Link/unlink students

### Type Definitions

Located in `src/types.ts`:

```typescript
interface ParentProfile {
    id: string;
    school_id: number;
    name: string;
    email?: string;
    phone_number: string;
    phone_number_2?: string;
    address?: string;
    occupation?: string;
    avatar_url?: string;
    created_at: string;
}

interface ParentStudentLink {
    id: number;
    parent_id: string;
    student_id: number;
    relationship: 'Father' | 'Mother' | 'Guardian' | 'Other';
    is_primary_contact: boolean;
    can_view_reports: boolean;
    can_view_finances: boolean;
    can_view_attendance: boolean;
    can_communicate: boolean;
    created_at: string;
    student?: Student;
    parent?: ParentProfile;
}

interface LinkedChild extends Student {
    relationship: string;
    permissions: {
        canViewReports: boolean;
        canViewFinances: boolean;
        canViewAttendance: boolean;
        canCommunicate: boolean;
    };
}
```

## Usage Guide

### For School Administrators

#### Creating Parent Accounts

**Method 1: Bulk Create**
1. Navigate to Admin > Parent Accounts
2. Click "Bulk Create from Students"
3. Confirm the action
4. System creates accounts for all students with parent contact info
5. Credentials sent automatically via SMS

**Method 2: Individual Create**
1. Navigate to Admin > Parent Accounts
2. Click "Create Parent Account"
3. Fill in parent details
4. Select students to link
5. Set relationship type
6. Submit - credentials sent via SMS

#### Managing Existing Accounts
- View all parent accounts and their linked children
- Reset passwords for parents
- Link parents to additional students
- Unlink parents from students
- Export account list

### For Parents

#### Logging In
1. Go to landing page
2. Click "Parent/Guardian Portal"
3. Enter username (provided via SMS)
4. Enter password (provided via SMS)
5. Click "Sign In"

#### Dashboard Navigation
- **Overview Tab**: See summary of all children
- **Report Cards Tab**: View published term reports
- **Attendance Tab**: Track child's attendance
- **Fees Tab**: View fee balances and payments
- **Profile Tab**: Update personal information

#### Multiple Children
- Use dropdown at top to switch between children
- Each child's data shown separately
- Permissions respected per child

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Parents can only access their own profile
- Parents can only see data for their linked children
- Staff can manage parent accounts in their school
- Admins have full management capabilities

### Authentication

- Username-based login (converts to email internally)
- Secure password generation
- Device limit enforcement
- Session management

### Permissions

Each parent-student link has granular permissions:
- `can_view_reports`: Access to report cards
- `can_view_finances`: Access to fee information
- `can_view_attendance`: Access to attendance records
- `can_communicate`: Ability to message school

## SMS Templates

Parent credential messages use the following templates:

**`parent_credentials`**
```
Hello {parent_name}. Your login for {school_name} Parent Portal: 
Username: {username}, Password: {password}. 
View your child's reports at {app_url}
```

**`parent_password_reset`**
```
Hello {parent_name}. Your new password for {school_name} Parent Portal: {password}
```

## Deployment

### Database Migration
1. Run migrations in order:
   ```sql
   20251224_add_parent_tables.sql
   20251224_update_handle_new_user_for_parents.sql
   ```

### Backend
1. Deploy updated `manage-users` edge function
2. Ensure SMS service (kudisms) is configured

### Frontend
1. Build application: `npm run build`
2. Deploy dist folder to hosting

## Testing Checklist

- [ ] Parent account creation (individual)
- [ ] Parent account creation (bulk)
- [ ] Parent login flow
- [ ] Child switcher (multiple children)
- [ ] Report cards display
- [ ] Attendance records display
- [ ] Fees display
- [ ] Profile updates
- [ ] RLS policies (unauthorized access blocked)
- [ ] SMS delivery of credentials
- [ ] Password reset
- [ ] Link/unlink students
- [ ] Device limit handling

## Future Enhancements

### High Priority
- [ ] In-app messaging between parents and staff
- [ ] Payment integration for fee payments
- [ ] Push notifications for important updates
- [ ] Mobile app support

### Medium Priority
- [ ] Parent profile photo upload
- [ ] Multiple language support
- [ ] Download reports as PDF
- [ ] Email notifications in addition to SMS

### Low Priority
- [ ] Parent community forum
- [ ] Event calendar integration
- [ ] Parent satisfaction surveys
- [ ] Achievement tracking

## Troubleshooting

### Parent Can't Login
1. Verify account exists in `parent_profiles`
2. Check auth.users table for user record
3. Confirm username format (parent_xxxxx)
4. Try password reset

### Parent Can't See Children
1. Check `parent_student_links` table
2. Verify RLS policies are enabled
3. Confirm student records exist
4. Check permissions flags

### SMS Not Received
1. Verify phone number format (+234...)
2. Check SMS service balance
3. Review kudisms logs
4. Confirm template exists

### Build Errors
1. Run `npm install` to update dependencies
2. Check TypeScript errors
3. Verify all imports are correct
4. Clear build cache and rebuild

## Support

For issues or questions:
1. Check this documentation
2. Review error logs in browser console
3. Check Supabase logs for backend errors
4. Contact development team

## Version History

- **v1.0.0** (2024-12-24): Initial parent portal implementation
  - Database schema and migrations
  - Edge function actions
  - Frontend components
  - Basic parent dashboard
  - Admin management interface

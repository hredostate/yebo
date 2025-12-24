# Student Profile Field Management - User Guide

## Overview

This feature allows administrators to control which profile fields students can edit and to add custom fields to student profiles dynamically.

## For Administrators

### Accessing the Settings

1. Log in as an Admin or Principal
2. Navigate to **Settings** from the sidebar
3. Click on the **Student Profile** tab

### Managing Built-in Fields

The system includes these default profile fields:
- Profile Photo
- Phone Number
- Email
- Street Address
- City
- State/Province
- Postal Code
- Country
- Emergency Contact Name
- Emergency Contact Phone
- Emergency Contact Relationship
- Parent Phone Numbers (typically read-only)

#### Toggling Field Editability

For each built-in field, you can toggle whether students can edit it:

1. Locate the field in the "Built-in Fields" section
2. Use the toggle switch labeled "Students can edit"
3. Changes are saved immediately

**Example:**
- By default, students CAN edit their address fields
- By default, students CANNOT edit their email or parent phone numbers
- Toggle OFF to prevent students from editing a field
- Toggle ON to allow students to edit a field

### Adding Custom Fields

You can add new fields to collect additional student information:

1. Click the **Add Custom Field** button
2. Fill in the form:
   - **Field Label** (required): Display name for the field (e.g., "Blood Type", "Allergies")
   - **Field Type**: Choose from:
     - **Text**: Single-line text input
     - **Email**: Email address with validation
     - **Phone**: Phone number input
     - **Date**: Date picker
     - **Text Area**: Multi-line text input
     - **Dropdown Select**: Multiple choice dropdown
   - **Placeholder Text**: Hint text shown in empty fields
   - **Dropdown Options** (for Select type only): Add multiple choice options
   - **Students can edit**: Check to allow student editing
   - **This field is required**: Check to make the field mandatory
3. Click **Add Field** to save

**Custom Field Examples:**
- Blood Type (select: A+, A-, B+, B-, O+, O-, AB+, AB-)
- Medical Allergies (textarea)
- T-Shirt Size (select: XS, S, M, L, XL, XXL)
- Sports Participation (text)

### Deleting Custom Fields

⚠️ **Warning**: Deleting a custom field will also delete all student data for that field.

1. Find the custom field in the "Custom Fields" section
2. Click the trash icon
3. Confirm the deletion

Built-in fields cannot be deleted.

## For Students

### Editing Your Profile

1. Log in to your student account
2. Navigate to **Student Dashboard**
3. Click **Edit Profile** or go to **My Profile**

### Understanding Field Indicators

- **Unlocked fields**: You can edit these fields
- **Locked fields** (🔒): These fields are read-only and can only be changed by administrators

### Editing Your Photo

If your school allows it, you can:
1. Click the camera icon on your profile photo
2. Select an image file (max 5MB)
3. The photo will be updated immediately
4. Click "Remove photo" to delete your current photo

### Saving Changes

After editing fields:
1. Review your changes
2. Click the **Save Changes** button at the bottom
3. You'll see a confirmation message
4. Changes are immediately saved to your profile

## Technical Details

### Database Schema

#### student_profile_field_configs Table
Stores configuration for all profile fields (built-in and custom):
- `field_name`: Internal field name
- `field_label`: Display name
- `field_type`: Data type (text, email, phone, etc.)
- `is_custom`: Whether this is a custom field
- `is_editable_by_student`: Controls student access
- `is_required`: Whether the field is mandatory
- `display_order`: Order in which fields appear
- `field_options`: For select fields, stores dropdown options
- `placeholder_text`: Hint text for the field

#### student_custom_field_values Table
Stores values for custom fields:
- `student_id`: Links to the student
- `field_config_id`: Links to the field configuration
- `field_value`: The actual value

### Security (RLS Policies)

**For Field Configurations:**
- All authenticated users can READ field configs for their school
- Only Admins and Principals can CREATE/UPDATE/DELETE configs

**For Custom Field Values:**
- Students can READ their own custom field values
- Students can UPDATE only fields marked as `is_editable_by_student`
- Staff can READ all values in their school
- Admins can manage all values

**For Built-in Fields:**
- Student updates to the `students` table are restricted by the existing RLS policy
- Students can only update their own record
- Only fields marked as editable in the configuration are actually updated by the application logic

### API Usage

#### Seeding Default Configurations

```sql
SELECT seed_default_profile_field_configs(1); -- Replace 1 with your school_id
```

This function automatically creates default field configurations for a school if none exist.

#### Querying Field Configurations

```sql
-- Get all field configurations for a school
SELECT * FROM student_profile_field_configs
WHERE school_id = YOUR_SCHOOL_ID
ORDER BY display_order;

-- Get only editable fields
SELECT * FROM student_profile_field_configs
WHERE school_id = YOUR_SCHOOL_ID
AND is_editable_by_student = true
ORDER BY display_order;
```

#### Updating Field Editability

```sql
UPDATE student_profile_field_configs
SET is_editable_by_student = true
WHERE school_id = YOUR_SCHOOL_ID
AND field_name = 'phone';
```

## Best Practices

### For Administrators

1. **Review Default Settings**: Check which fields are editable by default and adjust based on your school's policies
2. **Minimize Custom Fields**: Only add custom fields that are truly necessary to avoid overwhelming students
3. **Clear Labels**: Use descriptive field labels that students will understand
4. **Appropriate Types**: Choose the correct field type for the data you're collecting
5. **Privacy Considerations**: Be mindful of sensitive information - some fields should remain admin-only

### For Students

1. **Keep Information Current**: Regularly update your contact information
2. **Be Accurate**: Provide accurate information, especially for emergency contacts
3. **Ask for Help**: If you can't edit a field that needs updating, contact your school administrator

## Troubleshooting

### Admin Issues

**Problem**: Changes to field editability don't seem to take effect
- **Solution**: The changes are immediate. Have students refresh their page. If the issue persists, check browser console for errors.

**Problem**: Can't add custom field - "Field name already exists"
- **Solution**: The field label you chose generates a name that conflicts with an existing field. Try a different label.

**Problem**: Students report they can't save changes
- **Solution**: Check that the field is marked as editable in the configuration. Also verify the student's account is properly linked to their student record.

### Student Issues

**Problem**: Can't see the Edit Profile option
- **Solution**: Ensure you're logged in as a student, not staff. Navigate to "Student Dashboard" first.

**Problem**: Fields appear but can't be edited (greyed out)
- **Solution**: Fields with a lock icon are read-only. Contact your school administrator if you need to change these.

**Problem**: Photo upload fails
- **Solution**: Ensure the image is under 5MB and in a standard image format (JPG, PNG). If the issue persists, check your internet connection.

## Migration Guide

If upgrading from a previous version:

1. **Run the Migration**: Execute `supabase/migrations/20251224_student_profile_field_config.sql`
2. **Seed Defaults**: For each school in your database, run:
   ```sql
   SELECT seed_default_profile_field_configs(school_id);
   ```
3. **Review Settings**: Have administrators review and adjust the default field editability settings
4. **Test with Students**: Have a test student account verify they can access and edit their profile

## Support

For issues or questions:
1. Check this guide first
2. Review the error messages in the browser console (F12)
3. Contact your technical support team with:
   - User role (Admin/Student)
   - Steps to reproduce the issue
   - Any error messages
   - Screenshots if applicable

---

**Version**: 1.0  
**Last Updated**: December 24, 2024  
**Feature Status**: Production Ready

# Student CSV Upload Guide

## Overview
The student roster CSV upload feature has been enhanced with flexible header matching and a downloadable template to make importing students easier and more reliable.

## Quick Start

### 1. Download the Template
1. Navigate to the Student Roster page
2. Click the "Upload" button in the top-right corner
3. In the upload modal, click "Download Template CSV"
4. Open the downloaded `student_upload_template.csv` file

### 2. Fill in Your Data
The template includes the following columns:
- **Name** (required) - Student's full name
- **Admission Number** - Unique student identifier
- **Email** - Student's email/username for portal access
- **Class** - Must match existing class names exactly
- **Arm** - Must match existing arm/section names exactly
- **Date of Birth** - Format: YYYY-MM-DD (e.g., 2010-05-15)
- **Address** - Home address
- **Status** - Active, Inactive, Alumni, etc.
- **Parent Phone 1** - Primary contact number
- **Parent Phone 2** - Secondary contact number
- **Father Name** - Father's full name
- **Mother Name** - Mother's full name

### 3. Upload Your CSV
1. Save your filled CSV file
2. Click the file upload area or drag and drop your CSV
3. Click "Upload Students"
4. Review the success/error messages

## Flexible Header Support

The system now accepts various column name formats! You can use any of these variations:

### Name Variations
- Name, name
- Student Name, student_name, StudentName
- Full Name, full_name
- STUDENT NAME, NAME

### Admission Number Variations
- Admission Number, admission_number
- Admission No, admission_no
- ID, Student ID, student_id
- ADMISSION NUMBER

### Email Variations
- Email, email
- Email/Username, Username, username
- E-mail, e-mail
- Student Email, EMAIL

### Class Variations
- Class, class, CLASS
- Class Name, class_name
- Grade, grade
- Form

### Arm Variations
- Arm, arm, ARM
- Arm Name, arm_name
- Section, section
- Stream, stream

### Other Fields
Similar flexible matching applies to:
- Date of Birth (DOB, dob, Birth Date, Birthday, etc.)
- Address (Home Address, Residential Address, etc.)
- Parent Phone 1 (Parent Phone, Guardian Phone, Phone 1, Contact, etc.)
- Parent Phone 2 (Phone 2, Alt Phone, Alternative Phone, etc.)
- Father Name (Father, Dad Name, Father's Name, etc.)
- Mother Name (Mother, Mom Name, Mother's Name, etc.)
- Guardian Contact (Guardian Phone, Emergency Contact, etc.)

## Tips for Successful Uploads

1. **Only Name is Required**: You can upload a CSV with just student names and add other information later
2. **Partial Data**: You don't need all columns - include only what you have
3. **Case Insensitive**: Column names are matched regardless of case (e.g., "NAME" = "name")
4. **Class/Arm Names**: Must match exactly what's in your system (case-insensitive)
5. **Default Status**: If Status is not provided, it defaults to "Active"
6. **Phone Numbers**: Can include any format (e.g., 08012345678, 0801-234-5678)
7. **Validation Errors**: The system will show which rows have errors and still import valid rows

## Common Issues and Solutions

### "Class not found"
- **Issue**: The class name in your CSV doesn't match any existing class
- **Solution**: Check your class names in Settings → Classes and use exact names

### "Arm not found"
- **Issue**: The arm/section name doesn't match existing arms
- **Solution**: Check your arm names in Settings → Arms or leave the Arm column empty

### "Name is required"
- **Issue**: A row is missing a student name
- **Solution**: Ensure every student has a name in the Name column

### Empty file error
- **Issue**: CSV file has no data or only headers
- **Solution**: Add at least one student row to your CSV

## Example CSV Formats

All of these formats will work:

### Format 1: Standard Template
```csv
Name,Admission Number,Email,Class,Arm
John Doe,ADM001,john@email.com,JSS 1,A
Jane Smith,ADM002,jane@email.com,JSS 2,B
```

### Format 2: Lowercase with Underscores
```csv
student_name,student_id,email,class,arm
John Doe,ADM001,john@email.com,JSS 1,A
Jane Smith,ADM002,jane@email.com,JSS 2,B
```

### Format 3: Mixed Case and Variations
```csv
Student Name,ID,Username,Grade,Section
John Doe,ADM001,john@email.com,JSS 1,A
Jane Smith,ADM002,jane@email.com,JSS 2,B
```

### Format 4: Minimal (Name Only)
```csv
Name
John Doe
Jane Smith
Bob Johnson
```

All of these will be imported successfully!

## Batch Import Best Practices

1. **Test First**: Try uploading 2-3 students first to verify everything works
2. **Backup**: Keep a copy of your CSV file before uploading
3. **Review Classes/Arms**: Make sure all classes and arms exist in the system first
4. **Check Results**: Read the success/error messages carefully
5. **Incremental Updates**: If you have hundreds of students, consider uploading in batches

## Technical Details

- Supported file format: CSV (.csv)
- Maximum file size: Depends on browser memory (typically several MB)
- Encoding: UTF-8
- Delimiter: Comma (,)
- Character escaping: Standard CSV escaping with quotes

## Need Help?

If you encounter issues:
1. Download a fresh template
2. Check your class and arm names match the system
3. Ensure the Name column is present and filled
4. Review error messages carefully
5. Try with a smaller sample first

---

Last updated: 2025-12-19
Feature version: 1.0

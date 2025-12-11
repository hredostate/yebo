# Statistics Dashboard User Guide

## Overview
The Statistics Dashboard provides comprehensive academic performance analytics at both the grade level and individual class arm levels. It includes student rankings, grade distributions, and comparative analysis tools.

## Accessing the Dashboard
1. Navigate to **Result Manager**
2. Select a **Term** from the dropdown
3. Click on the **Statistics** tab (alongside "By Class" and "By Subject")

## Features

### 1. Grade Level Selection
- Use the dropdown to select which grade level to analyze (e.g., SS1, SS2, SS3, JSS1, JSS2, JSS3)
- The dashboard will display statistics for all students in that grade level

### 2. View Modes

#### Per Level View
- Shows aggregated statistics for ALL students across ALL arms in the selected grade level
- Provides a holistic view of the entire grade's performance
- Includes an **Arm Comparison Chart** showing how different arms compare

#### Per Arm View
- Shows statistics for a specific class arm (e.g., SS1 Gold)
- Select the arm from the dropdown after choosing "Per Arm" mode
- Useful for analyzing individual class performance

### 3. Statistics Cards
Four key metrics are displayed at the top:

- **📊 Average Score**: The mean score across all students
- **🏆 Highest Score**: Top performing student and their score
- **📉 Lowest Score**: Lowest performing student and their score
- **✅ Pass Rate**: Percentage of students who passed (with count)

### 4. Grade Distribution Chart
- Bar chart showing the distribution of grades (A, B, C, D, F)
- Color-coded for easy identification
- Shows both count and percentage for each grade
- Helps identify the overall performance spread

### 5. Arm Comparison Chart (Per Level View Only)
- Compares performance metrics across all arms in the level
- Shows:
  - Average Score per arm
  - Highest Score per arm
  - Pass Rate per arm
- Helps identify which arms are performing better or need support

### 6. Student Ranking Table

#### Features:
- **Sortable Columns**: Click any column header to sort
  - Rank
  - Student Name
  - Admission Number
  - Class/Arm
  - Average Score
  - Total Score
  - Grade

- **Search Functionality**: 
  - Search by student name, admission number, or class
  - Results update in real-time

- **Pagination**:
  - Shows 20 students per page
  - Navigate using Previous/Next buttons
  - Jump to specific pages

- **Visual Highlights**:
  - **Top 3 Students**: 
    - Rank 1: Gold background
    - Rank 2: Silver background
    - Rank 3: Bronze background
  - **Bottom Performers**: Red/warning background for lowest-ranking students

- **Export to CSV**:
  - Click "Export CSV" button
  - Downloads a CSV file with all rankings
  - Includes all visible columns
  - Filename includes timestamp for easy tracking

#### Table Columns:
1. **Rank**: Position from 1 (best) to N (last)
2. **Student Name**: Full name of the student
3. **Admission No**: Student's admission number
4. **Class**: Grade level (e.g., SS1)
5. **Arm**: Class arm (e.g., Gold) - only shown in Per Level view
6. **Average %**: Student's average score percentage
7. **Total Score**: Sum of all scores
8. **Grade**: Letter grade based on grading scheme
9. **Change**: Position change from previous term (↑ up, ↓ down, ─ no change)

## Use Cases

### 1. Class Performance Review
- Select a grade level in "Per Level" view
- Review overall statistics
- Identify top and bottom performers
- Export rankings for record-keeping

### 2. Arm Comparison
- Use "Per Level" view with Arm Comparison Chart
- Identify which arms need additional support
- Compare teaching effectiveness across arms

### 3. Individual Arm Analysis
- Switch to "Per Arm" view
- Select specific arm
- Get detailed statistics for that arm only
- Useful for parent-teacher meetings

### 4. Award Recognition
- Use the ranking table to identify top performers
- Export CSV for award ceremonies
- Top 3 are automatically highlighted

### 5. Intervention Planning
- Identify students with low scores
- Filter bottom performers (highlighted in red)
- Plan remedial activities

## Data Sources
- **Student Term Reports**: Contains average scores and positions
- **Grading Scheme**: Used to calculate letter grades
- **Academic Classes**: Provides level and arm information
- **Student Records**: Names and admission numbers

## Calculations

### Pass Rate
- Based on the active grading scheme
- Typically, grades A-D are passing, F is failing
- Calculated as: (Number of Passing Students / Total Students) × 100

### Grade Distribution
- Each student's average score is mapped to a grade using the grading scheme
- Counts are aggregated for each grade category
- Percentages calculated for visual representation

### Rankings
- Students sorted by average score (descending)
- Rank 1 = highest average score
- Ties are handled by maintaining sort stability

## Tips
1. **Regular Monitoring**: Check statistics after each assessment period
2. **Cross-Reference**: Use alongside "By Class" view for complete picture
3. **Export Regularly**: Keep CSV records for trend analysis
4. **Compare Terms**: Use rankings to track student progress over time
5. **Print-Friendly**: Rankings can be printed for offline review

## Technical Notes
- All calculations are performed in real-time
- Data is filtered based on selected term
- Charts are responsive and work on all devices
- Dark mode supported throughout

## Troubleshooting

**No data showing?**
- Ensure a term is selected
- Verify that results have been computed for the term
- Check that students are enrolled in classes

**Rankings seem incorrect?**
- Verify grading scheme is properly configured
- Check that student term reports are generated
- Ensure scores have been locked and published

**Export not working?**
- Check browser allows file downloads
- Try a different browser if issues persist
- Ensure popup blockers aren't interfering

## Support
For additional help or to report issues, contact your system administrator.

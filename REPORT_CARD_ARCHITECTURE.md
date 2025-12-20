# Report Card System Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         BulkReportCardGenerator                            │  │
│  │  "Generate report cards for selected students"            │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│                      │ 1. User clicks "Generate"                │
│                      ▼                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │      reportCardValidationService.ts                        │  │
│  │   validateBulkReportCardData(studentIds, termId)          │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
└──────────────────────┼───────────────────────────────────────────┘
                       │
                       │ 2. Call RPC for each student
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE / RPC LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   compute_report_card_data(student_id, term_id)           │  │
│  │                                                            │  │
│  │   Validation Steps:                                       │  │
│  │   ✓ Check student exists & enrolled                       │  │
│  │   ✓ Verify results are published                          │  │
│  │   ✓ Validate grading scheme exists                        │  │
│  │   ✓ Check all required scores present                     │  │
│  │                                                            │  │
│  │   If ANY fail → Return error details                      │  │
│  │   If ALL pass → Compute & return data                     │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│                      │ 3. Compute grades                         │
│                      ▼                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   compute_grade(score, scheme_id, subject_name)           │  │
│  │                                                            │  │
│  │   Priority:                                               │  │
│  │   1. Subject-specific override (grading_scheme_overrides) │  │
│  │   2. Standard grading rules (grading_scheme_rules)        │  │
│  │   3. Default to 'F'                                       │  │
│  │                                                            │  │
│  │   Returns: { grade_label, remark, gpa_value }            │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│                      │ 4. Return validated data                  │
└──────────────────────┼───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION RESULT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  SUCCESS                          │  BLOCKED                     │
│  ────────────────────             │  ────────────────────        │
│  status: "success"                │  status: "blocked"           │
│  data: {                          │  reason: "MISSING_SCORES"    │
│    student: {...}                 │  details: [                  │
│    school: {...}                  │    {                         │
│    term: {...}                    │      student_id: 123,        │
│    subjects: [...]                │      subject: "Math",        │
│    summary: {                     │      missing: ["Exam"]       │
│      totalScore: 450,             │    }                         │
│      averageScore: 75,            │  ]                           │
│      positionInArm: 3,            │                              │
│      positionInLevel: 15          │                              │
│    },                             │                              │
│    comments: {...},               │                              │
│    attendance: {...}              │                              │
│  }                                │                              │
│                                   │                              │
└───────────────────────────────────┴──────────────────────────────┘
                       │
                       │ 5. Handle result
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UI RESPONSE HANDLING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  IF ALL STUDENTS PASS:            │  IF ANY STUDENT FAILS:       │
│  ───────────────────              │  ───────────────────         │
│  ✓ Generate PDFs                  │  ✗ Show validation errors    │
│  ✓ Download as ZIP                │  ✗ Block generation          │
│  ✓ Show success message           │  ✗ Show fix instructions     │
│                                   │                              │
│  ┌─────────────────────────────┐ │  ┌────────────────────────┐ │
│  │   UnifiedReportCard         │ │  │ ReportCardValidation   │ │
│  │   (with validated data)     │ │  │ Errors                 │ │
│  └─────────────────────────────┘ │  │                        │ │
│                                   │  │ ❌ Cannot Generate     │ │
│                                   │  │                        │ │
│                                   │  │ Missing scores for:    │ │
│                                   │  │ - Mathematics          │ │
│                                   │  │ - English              │ │
│                                   │  │                        │ │
│                                   │  │ What to do next:       │ │
│                                   │  │ 1. Go to Score Entry   │ │
│                                   │  │ 2. Complete scores     │ │
│                                   │  │ 3. Try again           │ │
│                                   │  └────────────────────────┘ │
└───────────────────────────────────┴──────────────────────────────┘
```

## Database Schema Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     CORE TABLES (Existing)                      │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  students                  student_term_reports                 │
│  ├─ id                     ├─ student_id                        │
│  ├─ name                   ├─ term_id                           │
│  ├─ admission_number       ├─ average_score                     │
│  └─ campus_id              ├─ is_published ◄── CRITICAL!        │
│                            ├─ teacher_comment                    │
│  terms                     ├─ principal_comment                 │
│  ├─ id                     └─ academic_class_id                 │
│  ├─ session_label                                               │
│  └─ term_label             score_entries                        │
│                            ├─ student_id                         │
│  grading_schemes           ├─ term_id                           │
│  ├─ id                     ├─ subject_name                      │
│  ├─ name                   ├─ total_score                       │
│  └─ is_default             ├─ component_scores                  │
│                            └─ grade_label                        │
│  grading_scheme_rules                                           │
│  ├─ grading_scheme_id      academic_class_students             │
│  ├─ min_score              ├─ student_id                        │
│  ├─ max_score              ├─ academic_class_id                │
│  ├─ grade_label            └─ enrolled_term_id                  │
│  └─ remark                                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                   NEW TABLES (This Refactor)                    │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  results_publish_log          grading_scheme_overrides          │
│  ├─ id                         ├─ id                            │
│  ├─ term_id                    ├─ grading_scheme_id             │
│  ├─ academic_class_id          ├─ subject_name ◄── KEY!         │
│  ├─ published_by               ├─ min_score                     │
│  ├─ published_at               ├─ max_score                     │
│  ├─ version                    ├─ grade_label                   │
│  └─ checksum                   └─ remark                        │
│                                                                  │
│  Purpose: Audit trail          Purpose: Subject-specific grading│
│  Every publish is logged       Math: A=80+, English: A=70+     │
│  Enables PDF traceability                                       │
│                                                                  │
│  report_templates              template_assignments             │
│  ├─ id                         ├─ id                            │
│  ├─ school_id                  ├─ campus_id                     │
│  ├─ name                       ├─ class_group_id                │
│  ├─ html_template              └─ template_id                   │
│  ├─ css_styles                                                  │
│  ├─ supported_sections         Purpose: Map templates to        │
│  ├─ max_subjects_per_page      campuses/classes                │
│  ├─ version                                                     │
│  └─ is_active                                                   │
│                                                                  │
│  Purpose: Configurable layouts                                  │
│  Classic, Modern, Pastel, etc.                                  │
│                                                                  │
│  school_config (enhanced)                                       │
│  ├─ report_card_branding (JSONB)                                │
│  │  ├─ watermark_url                                            │
│  │  ├─ signature_principal                                      │
│  │  ├─ signature_class_teacher                                  │
│  │  ├─ primary_color                                            │
│  │  ├─ secondary_color                                          │
│  │  ├─ show_school_logo                                         │
│  │  └─ footer_text                                              │
│  └─ default_template_id                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Validation Error Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION CHECKS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Student Exists?                                              │
│     ├─ NO → STUDENT_NOT_FOUND                                   │
│     └─ YES ↓                                                     │
│                                                                   │
│  2. Enrolled in Class for Term?                                 │
│     ├─ NO → NOT_ENROLLED                                        │
│     └─ YES ↓                                                     │
│                                                                   │
│  3. Results Published? (is_published = true)                    │
│     ├─ NO → RESULTS_NOT_PUBLISHED                               │
│     └─ YES ↓                                                     │
│                                                                   │
│  4. Grading Scheme Exists?                                      │
│     ├─ NO → MISSING_GRADING_SCHEME                              │
│     └─ YES ↓                                                     │
│                                                                   │
│  5. All Subject Scores Present?                                 │
│     ├─ NO → MISSING_SCORES (with subject list)                  │
│     └─ YES ↓                                                     │
│                                                                   │
│  ✓ ALL CHECKS PASSED                                            │
│    → Compute report card data                                   │
│    → Return validated data                                      │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Grade Calculation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              compute_grade(score, scheme_id, subject)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Input: score = 85, scheme_id = 1, subject = "Mathematics"      │
│                                                                   │
│  Step 1: Check subject-specific override                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SELECT * FROM grading_scheme_overrides                   │   │
│  │ WHERE grading_scheme_id = 1                              │   │
│  │   AND subject_name = 'Mathematics'                       │   │
│  │   AND 85 BETWEEN min_score AND max_score                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ├─ FOUND → Return { grade: "A", remark: "Excellent" }  │
│         │                                                        │
│         └─ NOT FOUND ↓                                          │
│                                                                   │
│  Step 2: Check standard grading rules                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SELECT * FROM grading_scheme_rules                       │   │
│  │ WHERE grading_scheme_id = 1                              │   │
│  │   AND 85 BETWEEN min_score AND max_score                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ├─ FOUND → Return { grade: "A", remark: "Excellent" }  │
│         │                                                        │
│         └─ NOT FOUND ↓                                          │
│                                                                   │
│  Step 3: Default fallback                                       │
│         └─ Return { grade: "F", remark: "Fail" }                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Ranking Calculation

```
┌─────────────────────────────────────────────────────────────────┐
│                    DUAL RANKING SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Term: 2023/2024 First Term                                     │
│  Level: SS1 (Senior Secondary 1)                                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ ARM RANKING (Within Single Class/Arm)                  │     │
│  │                                                         │     │
│  │ SS1 Gold (45 students)                                 │     │
│  │ ┌─────┬─────────────┬───────┬──────────┐              │     │
│  │ │ Pos │ Student     │ Avg   │ Rank     │              │     │
│  │ ├─────┼─────────────┼───────┼──────────┤              │     │
│  │ │  1  │ John Doe    │ 92.5  │ 1        │ ◄─┐          │     │
│  │ │  2  │ Jane Smith  │ 92.5  │ 1        │   │ Dense    │     │
│  │ │  3  │ Mike Brown  │ 88.0  │ 2        │   │ Rank     │     │
│  │ │  4  │ Sara Lee    │ 85.0  │ 3        │ ◄─┘          │     │
│  │ │ ... │ ...         │ ...   │ ...      │              │     │
│  │ └─────┴─────────────┴───────┴──────────┘              │     │
│  │                                                         │     │
│  │ Result: "3rd out of 45 in SS1 Gold"                    │     │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ LEVEL RANKING (Across All Arms in Same Level)          │     │
│  │                                                         │     │
│  │ All SS1 (Gold + Silver + Diamond = 180 students)       │     │
│  │ ┌─────┬─────────────┬───────┬──────────┬──────┐       │     │
│  │ │ Pos │ Student     │ Avg   │ Rank     │ Arm  │       │     │
│  │ ├─────┼─────────────┼───────┼──────────┼──────┤       │     │
│  │ │  1  │ Alice (S)   │ 95.0  │ 1        │Silver│       │     │
│  │ │  2  │ Bob (D)     │ 93.0  │ 2        │Diam. │       │     │
│  │ │  3  │ John (G)    │ 92.5  │ 3        │ Gold │ ◄─┐   │     │
│  │ │  4  │ Jane (G)    │ 92.5  │ 3        │ Gold │   │   │     │
│  │ │  5  │ Carol (S)   │ 91.0  │ 4        │Silver│   │   │     │
│  │ │ ... │ ...         │ ...   │ ...      │ ...  │   │   │     │
│  │ │ 15  │ Sara (G)    │ 85.0  │ 15       │ Gold │ ◄─┘   │     │
│  │ │ ... │ ...         │ ...   │ ...      │ ...  │       │     │
│  │ └─────┴─────────────┴───────┴──────────┴──────┘       │     │
│  │                                                         │     │
│  │ Result: "15th out of 180 in SS1"                       │     │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Both rankings use DENSE_RANK():                                │
│  - Ties get same rank                                           │
│  - Next rank doesn't skip numbers                               │
│  - Example: 1, 1, 2, 3 (not 1, 1, 3, 4)                         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Print CSS A4 Layout

```
┌──────────────────────────────────────────────────────────────┐
│                    A4 Page (210mm × 297mm)                    │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Margin: 10mm (all sides)                               │  │
│  │ ┌────────────────────────────────────────────────────┐ │  │
│  │ │ HEADER (School Logo, Name, Address)                │ │  │
│  │ │ ├─ page-break-inside: avoid                        │ │  │
│  │ │ └─ Cannot split across pages                       │ │  │
│  │ ├────────────────────────────────────────────────────┤ │  │
│  │ │ STUDENT INFO (Name, Admission No, Class)           │ │  │
│  │ │ ├─ page-break-inside: avoid                        │ │  │
│  │ │ └─ Cannot split across pages                       │ │  │
│  │ ├────────────────────────────────────────────────────┤ │  │
│  │ │ SUBJECTS TABLE                                     │ │  │
│  │ │ ┌────────────────────────────────────────────────┐ │ │  │
│  │ │ │ Subject | CA1 | CA2 | Exam | Total | Grade   │ │ │  │
│  │ │ ├────────────────────────────────────────────────┤ │ │  │
│  │ │ │ Math    │ 10  │ 15  │ 60   │ 85    │ A       │ │ │  │
│  │ │ │ English │ 12  │ 18  │ 55   │ 85    │ A       │ │ │  │
│  │ │ │ ...     │ ... │ ... │ ...  │ ...   │ ...     │ │ │  │
│  │ │ └────────────────────────────────────────────────┘ │ │  │
│  │ │ Each row: break-inside: avoid                      │ │  │
│  │ ├────────────────────────────────────────────────────┤ │  │
│  │ │ SUMMARY                                            │ │  │
│  │ │ ├─ Total: 450/500                                  │ │  │
│  │ │ ├─ Average: 75%                                    │ │  │
│  │ │ ├─ Position in Arm: 3rd/45                         │ │  │
│  │ │ └─ Position in Level: 15th/180                     │ │  │
│  │ ├────────────────────────────────────────────────────┤ │  │
│  │ │ COMMENTS                                           │ │  │
│  │ │ ├─ Teacher: "Excellent performance..."             │ │  │
│  │ │ └─ Principal: "Keep up the good work..."           │ │  │
│  │ ├────────────────────────────────────────────────────┤ │  │
│  │ │ ATTENDANCE                                         │ │  │
│  │ │ ├─ Present: 85 days                                │ │  │
│  │ │ ├─ Absent: 5 days                                  │ │  │
│  │ │ └─ Attendance Rate: 94%                            │ │  │
│  │ ├────────────────────────────────────────────────────┤ │  │
│  │ │ SIGNATURES                                         │ │  │
│  │ │ ├─ Class Teacher: _______________                  │ │  │
│  │ │ └─ Principal: _______________                      │ │  │
│  │ └────────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │ CSS Rules:                                             │  │
│  │ @page { size: A4; margin: 10mm; }                     │  │
│  │ .page-break { page-break-before: always; }            │  │
│  │ table, tr, td { break-inside: avoid; }                │  │
│  │ body { -webkit-print-color-adjust: exact; }           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

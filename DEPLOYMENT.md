
# Deployment Guide: School Guardian 360

This guide provides instructions for deploying the School Guardian 360 application, which consists of two main parts: the Supabase backend and the React frontend.

---

## Part 1: Supabase Backend Setup

Supabase provides the database, authentication, and backend services.

### Step 1: Create a Supabase Project

1.  Go to [supabase.com](https://supabase.com/) and create an account or log in.
2.  Create a new project. Choose a strong database password and store it securely.
3.  Wait for the project to be provisioned.

### Step 2: Get API Credentials

1.  Once your project is ready, navigate to **Project Settings** (the gear icon in the left sidebar).
2.  Click on **API**.
3.  You will find your **Project URL** and your `anon` **public** key.
4.  You will need these for your frontend application's environment variables. You will add these to your `.env` file in Part 2.

### Step 3: Set Up the Database Schema

This application is designed to guide you through the database setup process.

1.  After configuring your frontend with the Supabase credentials (see Part 2), run the application locally (`npm run dev`).
2.  If the database is not yet configured, the application will display a **"Critical Application Error"** page specifically for this purpose.
3.  On this error page, click the **"Show Required SQL Schema"** button.
4.  Click the **"Copy to Clipboard"** button to copy the entire database script.
5.  In your Supabase project dashboard, navigate to the **SQL Editor**.
6.  Paste the copied SQL content into the query window and click **RUN**.

This script will create all necessary tables, roles, functions, and security policies. It also pre-populates essential data, like user roles.

### Step 4: Enable and Configure Row-Level Security (RLS)

RLS is the core of your data security. It ensures users can only access the data they are permitted to see.

1.  In the Supabase dashboard, navigate to **Authentication** (the user icon).
2.  Click on **Policies**.
3.  You will see a list of your tables. You must **enable RLS** for each of the following tables by clicking the toggle next to its name:
    *   `academic_classes`
    *   `academic_class_students`
    *   `announcements`
    *   `arms`
    *   `assessments`
    *   `assessment_scores`
    *   `attendance_records`
    *   `attendance_schedules`
    *   `audit_log`
    *   `calendar_events`
    *   `campuses`
    *   `class_group_members`
    *   `class_groups`
    *   `class_sections`
    *   `class_subjects`
    *   `classes`
    *   `communications_audit`
    *   `curriculum`
    *   `curriculum_weeks`
    *   `grading_scheme_rules`
    *   `grading_schemes`
    *   `inventory_items`
    *   `leave_requests`
    *   `leave_types`
    *   `lesson_plan_coverage_votes`
    *   `lesson_plans`
    *   `living_policy_snippets`
    *   `notifications`
    *   `paystack_recipients`
    *   `payroll_adjustments`
    *   `payroll_items`
    *   `payroll_runs`
    *   `positive_behavior`
    *   `quiz_mc_option_counts`
    *   `quiz_questions`
    *   `quiz_responses`
    *   `quizzes`
    *   `report_comments`
    *   `reports`
    *   `reward_redemptions`
    *   `rewards_store_items`
    *   `roles`
    *   `schools`
    *   `school_config`
    *   `score_entries`
    *   `sip_logs`
    *   `staff_awards`
    *   `student_awards`
    *   `student_entity_enrollments`
    *   `student_intervention_plans`
    *   `student_profiles`
    *   `student_subject_choices`
    *   `student_term_reports`
    *   `student_term_report_subjects`
    *   `student_term_report_traits`
    *   `students`
    *   `subjects`
    *   `tasks`
    *   `team_assignments`
    *   `team_feedback`
    *   `teams`
    *   `teacher_checkins`
    *   `teacher_rating_policies`
    *   `teacher_rating_weekly`
    *   `teacher_ratings`
    *   `teacher_shifts`
    *   `teaching_assignments`
    *   `teaching_entities`
    *   `terms`
    *   `user_profiles`
    *   `user_role_assignments`
4.  The policies themselves were already created when you ran the SQL script. By enabling RLS, you are activating these policies.

### Step 5: Create Public Storage Buckets & Policies (CRITICAL)

This step is required for image uploads to work correctly.

1.  In the Supabase dashboard, navigate to **Storage** (the file cabinet icon).
2.  Click the **"New bucket"** button.
3.  Enter `report_images` as the bucket name.
4.  Toggle the switch for **"Public bucket"** to make it ON.
5.  Click **"Create bucket"**.
6.  Repeat the process to create three more buckets:
    *   Enter `avatars` as the bucket name.
    *   Toggle the switch for **"Public bucket"** to make it ON.
    *   Click **"Create bucket"**.
    *   Enter `documents` as the bucket name. (Used for PDF payslips, etc.)
    *   Toggle the switch for **"Public bucket"** to make it ON.
    *   Click **"Create bucket"**.
    *   Enter `lesson_plans` as the bucket name. (Used for PDF lesson plans.)
    *   Toggle the switch for **"Public bucket"** to make it ON.
    *   Click **"Create bucket"**.
7.  **IMPORTANT**: You must add security policies to all buckets. Go to `Storage` -> `Policies`. Create new policies for each bucket that match the `STORAGE POLICIES` section at the bottom of the SQL schema script you ran in Step 3.

### Step 6: Configure Edge Function Secrets (NEW)

The new backend functions require API keys for external services.

1. In your Supabase project dashboard, navigate to **Edge Functions** under the **Project Settings**.
2. Click **"Add new secret"** for each of the following required services:

    *   **Paystack (for Payroll)**
        *   `PAYSTACK_SECRET_KEY`: Your secret key from Paystack.

    *   **PDF Generation (for Payslips)**
        *   `PDF_API_KEY`: Your API key from PDFGeneratorAPI.
        *   `PDF_API_SECRET`: Your API secret from PDFGeneratorAPI.
        *   `PDF_API_WORKSPACE`: Your workspace ID from PDFGeneratorAPI.

    *   **SMS Notifications (for Attendance Alerts)**
        *   `BULKSMS_API_TOKEN`: Your API token from BulkSMSNigeria.
        *   `BULKSMS_SENDER_ID`: Your approved Sender ID (e.g., 'UPSS'). Optional, defaults to 'UPSS'.
        *   `BULKSMS_BASE_URL`: The API base URL. Optional, defaults to the standard BulkSMSNigeria API URL.

### Step 7: Schedule Automated Jobs (Cron)

The application relies on periodic jobs to aggregate data and send reminders.

1.  In your Supabase project dashboard, navigate to **SQL Editor**.
2.  Click on **Cron Jobs**.
3.  Create four new jobs:
    *   **Job 1: Compute Weekly Ratings**
        *   **Name:** `Compute Weekly Teacher Ratings`
        *   **Schedule:** `0 0 * * *` (This runs daily at midnight UTC)
        *   **Function:** `SELECT public.compute_teacher_rating_week_current();`
    *   **Job 2: Refresh Public Leaderboard**
        *   **Name:** `Refresh Public Leaderboard`
        *   **Schedule:** `5 0 * * *` (This runs daily at 00:05 UTC, right after the first job)
        *   **Function:** `SELECT public.refresh_public_leaderboard_mv();`
    *   **Job 3: Check Task Reminders**
        *   **Name:** `Check Task Reminders`
        *   **Schedule:** `*/5 * * * *` (This runs every 5 minutes)
        *   **Function:** `SELECT public.check_task_reminders();`
    *   **Job 4: Send Daily Attendance SMS**
        *   **Name:** `Send Daily Attendance SMS`
        *   **Schedule:** `0 17 * * 1-5` (This runs at 5 PM UTC on weekdays)
        *   **Function:** `SELECT public.send_daily_subject_attendance_summaries();`

Your Supabase backend is now configured and ready. Refresh the application in your browser.

---

## Part 2: Frontend Deployment

These instructions assume you are deploying a production build of the React application to any static hosting provider.

### Step 1: Deploy Edge Functions

Before building the frontend, you must deploy the new backend functions.

1. Install the Supabase CLI if you haven't already: `npm install supabase --save-dev`.
2. Link your local project to your Supabase project: `npx supabase link --project-ref YOUR_PROJECT_ID`.
3. Deploy the functions: `npx supabase functions deploy`. This will deploy all functions in the `supabase/functions` directory.

### Step 2: Build the Application for Production

1.  Create a file named `.env` in the root of your project (you can copy `.env.example`).
2.  Fill this `.env` file with your **production** Supabase URL, Supabase anon key, and your Google Gemini API key. This is a critical step to ensure your deployed app connects to your production backend. All variables must be prefixed with `VITE_`.
3.  From your project's root directory, run the build command:
    ```bash
    npm run build
    ```
4.  This command will create a new folder named `dist` in your project root. This folder contains the static HTML, CSS, and JavaScript files that make up your application.

### Step 3: Upload Files to Hosting Provider

1.  Log in to your hosting provider (e.g., Vercel, Netlify, AWS S3, Hostinger).
2.  Follow their instructions for deploying a static site.
3.  You will typically drag-and-drop the **contents** of the `dist` folder or connect your Git repository and point the build command to `npm run build` and the publish directory to `dist`.
4.  **IMPORTANT**: Upload ALL files from the dist folder, not just changed files. This ensures proper cache invalidation.

### Step 4: Clear CDN Cache (If Applicable)

If you're using a CDN (Cloudflare, AWS CloudFront, etc.), you must clear the cache after deployment:

- **Cloudflare**: Go to Caching → Purge Everything
- **AWS CloudFront**: Create an Invalidation for `/*`
- **Other CDNs**: Check their documentation for cache clearing

### Step 5: Verify Deployment & Handle Browser Caching

After deployment, it's critical to ensure users see the updated version:

1.  **Test in incognito/private mode**: Open the site in a private browser window to verify changes
2.  **Check file timestamps**: Verify that index.html and sw.js have current timestamps
3.  **Inform users**: If this is a major update, inform users to hard refresh (Ctrl+F5 or Cmd+Shift+R)

**Important**: The application now uses automatic cache-busting with content-hashed filenames and service worker auto-updates. However, some users may need to clear their cache to see updates immediately.

📖 **For detailed cache management instructions, see [`CACHE_BUSTING_GUIDE.md`](./CACHE_BUSTING_GUIDE.md)**

### Step 6: Final Checks

1.  Visit your domain name in a web browser. The School Guardian 360 login page should appear.
2.  Test the sign-up and login functionality to ensure it is correctly communicating with your Supabase backend.

Your application is now live!

# School Guardian 360

This is an AI-powered dashboard for school administrators to manage reports, tasks, students, and institutional data, providing actionable insights and proactive intelligence to foster a safe and efficient learning environment.

## 🎯 Complete Unified Build

**This repository now contains the complete, unified School Guardian 360 application with ALL features merged into one build-ready codebase.**

Previous zip files (school-guardian-360-with-dva.zip, school-guardian-paystack-integration.zip, school-guardian-white-screen-fix.zip, etc.) have been consolidated. You no longer need to choose between different versions!

### 📖 Complete Build Documentation

**For detailed setup, features, and build instructions, see [`BUILD_GUIDE.md`](./BUILD_GUIDE.md)**

## ✨ All Features Included

✅ **Dedicated Virtual Accounts (DVA)** - Paystack virtual accounts for students  
✅ **Payroll Integration** - Automated staff payments via Paystack  
✅ **Student Management** - Comprehensive student profiles and tracking  
✅ **Academic Management** - Classes, assignments, assessments  
✅ **Financial Management** - Fees, invoices, payments  
✅ **HR & Payroll** - Staff management and automated payroll  
✅ **Attendance Tracking** - Real-time attendance monitoring  
✅ **AI-Powered Insights** - Intelligent recommendations  
✅ **Multi-Campus Support** - Manage multiple school campuses  
✅ **Role-Based Access** - Admin, Teacher, Student, Parent roles  

## Local Development Setup

To run this project locally, you will need Node.js and npm installed.

### 1. Installation

Clone the repository and install the necessary dependencies:

```bash
npm install
```

### 2. Environment Variables

The application requires API keys for Supabase and the Google Gemini API. A template file is provided at the project root named `.env.example`.

To configure your local environment, you must **copy or rename** this file to `.env` in the same root directory:

```bash
# Using copy is safer
cp .env.example .env
```

Next, open the newly created `.env` file and fill in the values for your Supabase project and your Google Gemini API key.

**Note:** For the Vite build tool to expose variables to the client-side code, they **must** be prefixed with `VITE_`. Your `.env` file should look like this:

```dotenv
VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

### 3. Database Setup

The backend for this application is provided by Supabase. If you are starting with a new, empty Supabase project, the application is designed to help you.

1.  Run the application using `npm run dev`.
2.  If your database tables are not set up, the application will display a "Critical Application Error" page.
3.  This page will provide the complete SQL schema required for the application to function.
4.  Follow the on-screen instructions to copy the schema and run it in your Supabase project's SQL Editor.
5.  After the script finishes, refresh the application page.

This process ensures your database is correctly configured with all necessary tables and security policies. You can find more detailed deployment steps in `DEPLOYMENT.md`.

### 4. Running the Development Server

Once your dependencies are installed and your environment variables are set, you can start the local development server:

```bash
npm run dev
```

This will start the application on a local port (usually `http://localhost:5173`). The server will automatically reload when you make changes to the source code.

### 5. Building for Production

To create an optimized build of the application for deployment, run:

```bash
npm run build
```

This will generate a `dist` folder in the project root containing the static HTML, CSS, and JavaScript files that can be deployed to any static hosting provider.

## 🔧 Troubleshooting

### Error: "column student_record_id does not exist"

If you encounter this error when students try to log in or access their accounts, it means your database is missing the `student_record_id` column in the `student_profiles` table. This happens when the database was created with an older version of the schema.

**Solution:**

Run the migration scripts in the `supabase/migrations/` folder in this order:

1. `add_student_record_id_to_student_profiles.sql` - Adds the missing column
2. `fix_handle_new_user_trigger.sql` - Updates the trigger for future student accounts

See the detailed instructions in [`supabase/migrations/README.md`](./supabase/migrations/README.md) for step-by-step guidance on applying these migrations.

### Updates Not Showing After Deployment

If you've deployed an update but users are still seeing the old version, this is typically a browser caching issue. The application now includes automatic cache-busting mechanisms:

- All JavaScript and CSS files have content-hashed filenames
- Service worker automatically detects and installs updates
- HTML files are never cached

**Quick Fix for Users:**
- Windows/Linux: Press `Ctrl + F5` to hard refresh
- Mac: Press `Cmd + Shift + R` to hard refresh

📖 **For complete deployment and caching guidance, see [`CACHE_BUSTING_GUIDE.md`](./CACHE_BUSTING_GUIDE.md)**

### Other Common Issues

- **White Screen on Load**: Check browser console for errors and verify your `.env` file has correct Supabase credentials
- **Database Schema Errors**: Make sure you've run the complete schema from the "Critical Application Error" page or from `database_schema.sql`
- **Authentication Issues**: Verify your Supabase project has RLS (Row Level Security) policies enabled

For more detailed troubleshooting, see [`BUILD_GUIDE.md`](./BUILD_GUIDE.md) and [`DEPLOYMENT.md`](./DEPLOYMENT.md).

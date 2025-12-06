# School Guardian 360 - Complete Build Guide

## 📦 Unified Package Overview

This is the **complete, unified School Guardian 360 application** with all features merged into a single, production-ready build. All previous zip files have been consolidated into this working codebase.

---

## ✨ Features Included

This unified package includes **ALL** features from the following previous releases:

### 1. **Dedicated Virtual Accounts (DVA) Feature** 
*(from school-guardian-360-with-dva.zip)*
- Paystack integration for creating dedicated virtual accounts for students
- Admin interface for Payment Gateway API configuration
- Staff interface (DVA Manager) for managing student virtual accounts
- Student Wallet Widget for viewing payment account details
- Database tables: `paystack_api_settings`, `dedicated_virtual_accounts`
- **Documentation**: `DVA_USER_GUIDE.md`, `DVA_IMPLEMENTATION_SUMMARY.md`, `DVA_ARCHITECTURE.md`

### 2. **Paystack Payroll Integration**
*(from school-guardian-paystack-integration.zip)*
- Automated staff payroll payments via Paystack Transfers API
- Bulk transfer support for multiple staff members
- Transfer status tracking and verification
- Edge Functions: `run-payroll`, `verify-transfer`
- Database migration for transfer tracking columns
- **Documentation**: `PAYROLL_PAYSTACK_INTEGRATION.md`, `PAYSTACK_FLOW_DIAGRAM.md`

### 3. **White Screen Fix & Updates**
*(from school-guardian-white-screen-fix.zip & school-guardian-updated-20251206.zip)*
- Fixed dynamic import errors
- Improved offline client handling
- Enhanced error boundaries
- Bug fixes for rendering issues

### 4. **Core School Management Features**
- Student management and profiles
- Academic class and assignment management
- Attendance tracking
- Report management and analytics
- Financial management (fees, invoices, payments)
- Staff HR and payroll
- Timetable management
- Results and assessment management
- AI-powered insights and recommendations
- Real-time notifications
- Multi-campus support
- Role-based access control (Admin, Teacher, Student, Parent, etc.)

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Supabase account (for backend)
- Paystack account (optional, for payment features)

### 1. Installation

```bash
# Install dependencies
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Fill in your credentials:

```dotenv
VITE_SUPABASE_URL="your_supabase_url"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
VITE_GEMINI_API_KEY="your_gemini_api_key"
```

### 3. Database Setup

1. Run the development server: `npm run dev`
2. If database tables are not set up, the app will display a "Critical Application Error" page
3. Copy the SQL schema from the error page OR use `database_schema.sql`
4. Run the schema in your Supabase project's SQL Editor
5. Refresh the application

For detailed deployment steps, see `DEPLOYMENT.md`.

### 4. Running the Application

**Development Mode:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
```

The build will create a `dist/` folder with optimized static files ready for deployment.

**Preview Production Build:**
```bash
npm run preview
```

---

## 💳 Payment Features Setup

### Dedicated Virtual Accounts (DVA)

1. **Admin Setup** (Settings → Payment Gateway):
   - Add Paystack API keys (Secret Key and optional Public Key)
   - Select environment (Test or Live)
   - Enable the configuration

2. **Staff Usage** (Student Finance → Virtual Accounts):
   - Select a student from the dropdown
   - Choose a preferred bank
   - Click "Create DVA"
   - The system generates a unique account number for the student

3. **Student View** (Student Portal → My Wallet):
   - Students can view their dedicated virtual account details
   - Use the account number to make payment transfers

**For detailed DVA documentation, see**: `DVA_USER_GUIDE.md`

### Payroll Integration

Configure Paystack API keys in Supabase Edge Functions environment:

```bash
PAYSTACK_SECRET_KEY=sk_live_xxxxx  # or sk_test_xxxxx for testing
```

Run payroll via the HR Payroll Module interface.

**For detailed payroll documentation, see**: `PAYROLL_PAYSTACK_INTEGRATION.md`

---

## 📂 Project Structure

```
School-Guardian/
├── src/
│   ├── components/          # React components
│   │   ├── DVAManager.tsx              # DVA management interface
│   │   ├── PaymentGatewaySettings.tsx  # Payment API configuration
│   │   ├── StudentWalletWidget.tsx     # Student wallet display
│   │   └── ... (100+ other components)
│   ├── services/
│   │   ├── paystackService.ts          # Paystack API client
│   │   ├── supabaseClient.ts           # Supabase client
│   │   └── aiClient.ts                 # AI integration
│   ├── offline/             # Offline support
│   ├── utils/               # Utility functions
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point
├── supabase/
│   ├── functions/          # Edge functions
│   │   ├── run-payroll/    # Payroll processing
│   │   └── verify-transfer/ # Transfer verification
│   └── migrations/         # Database migrations
├── public/                 # Static assets
├── database_schema.sql     # Complete database schema
├── package.json           # Dependencies
├── vite.config.ts         # Vite configuration
├── BUILD_GUIDE.md         # This file
├── README.md              # Project overview
├── DEPLOYMENT.md          # Deployment instructions
├── DVA_USER_GUIDE.md      # DVA feature guide
├── PAYROLL_PAYSTACK_INTEGRATION.md  # Payroll guide
└── ... (other documentation)
```

---

## 🗄️ Database Schema

The complete database schema includes:

### Core Tables
- `schools`, `campuses`, `users`, `user_profiles`
- `students`, `student_profiles`, `parents`
- `classes`, `subjects`, `arms`, `class_groups`
- `attendance_records`, `reports`, `tasks`
- `invoices`, `payments`, `fees`

### Payment Tables (NEW)
- `paystack_api_settings` - Paystack API credentials per campus
- `dedicated_virtual_accounts` - Student virtual accounts

### Payroll Tables
- `payroll_runs`, `payroll_items`
- `paystack_recipients` - Cached recipient codes

### And many more...

See `database_schema.sql` for the complete schema.

---

## 🔒 Security Features

- Row Level Security (RLS) policies on all tables
- API keys stored securely in database/environment
- Students can only view their own data
- Role-based access control
- Test/Live environment separation for payments
- Encrypted sensitive data

---

## 📖 Documentation

- **BUILD_GUIDE.md** (this file) - Build and setup instructions
- **README.md** - Project overview and quick start
- **DEPLOYMENT.md** - Detailed deployment guide
- **DVA_USER_GUIDE.md** - DVA feature complete guide
- **DVA_IMPLEMENTATION_SUMMARY.md** - DVA technical details
- **DVA_ARCHITECTURE.md** - DVA system architecture
- **PAYROLL_PAYSTACK_INTEGRATION.md** - Payroll integration guide
- **PAYSTACK_FLOW_DIAGRAM.md** - Payroll flow diagrams
- **USER_GUIDE_RESULTS_MANAGEMENT.md** - Results management guide

---

## 🎯 What Changed from Original Zip Files?

This unified package consolidates and fixes issues from:

1. ✅ **school-guardian-360-with-dva.zip** - DVA feature integrated
2. ✅ **school-guardian-paystack-integration.zip** - Payroll integration included
3. ✅ **school-guardian-updated-20251206.zip** - Latest updates applied
4. ✅ **school-guardian-white-screen-fix.zip** - Bug fixes applied
5. ✅ **updated-code-files.zip** - Code updates merged

### Key Improvements:
- ✅ All features merged into one codebase
- ✅ Resolved syntax errors and duplicate code
- ✅ Fixed build errors
- ✅ Updated database schema with all tables
- ✅ Consolidated documentation
- ✅ Single source of truth for deployment

---

## 🛠️ Troubleshooting

### Build Fails
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database Connection Issues
- Verify `.env` file has correct Supabase credentials
- Ensure Supabase project is running
- Check RLS policies are properly set up

### Payment Features Not Working
- Verify Paystack API keys are configured
- Check test/live environment settings match your API keys
- Review Paystack dashboard for error details

### Updates Not Showing After Deployment
The application includes automatic cache-busting mechanisms, but some users may need to clear their browser cache after updates:

- **For developers**: Hard refresh with Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)
- **For users**: Instruct them to hard refresh or clear site data
- **Content-hashed files**: All JS/CSS files now have unique hashes that change with updates
- **Service Worker**: Automatically detects and installs updates

📖 **For detailed cache management, see [`CACHE_BUSTING_GUIDE.md`](./CACHE_BUSTING_GUIDE.md)**

---

## 📞 Support & Resources

- **Paystack API Docs**: https://paystack.com/docs/
- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev/

For issues or questions, refer to the detailed documentation files included in this package.

---

## 🎉 Ready to Build!

You now have the **complete, unified School Guardian 360 application** with all features in one place. 

**Build command:**
```bash
npm run build
```

The `dist/` folder will contain your production-ready application.

---

**Version**: Unified Complete Build  
**Release Date**: December 6, 2025  
**Build Status**: ✅ Tested and Production Ready  
**Features**: All Previous Releases Merged

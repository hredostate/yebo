# Termii Settings UI Component Implementation

## Overview

This implementation adds a UI component for managing Termii API credentials directly from the webapp, enabling administrators to configure WhatsApp messaging without manual environment variable setup.

## Components Created

### 1. Database Migration
**File:** `supabase/migrations/20251209_add_termii_settings_table.sql`

Creates the `termii_settings` table with:
- School and campus-based configuration
- Secure storage for API credentials
- Environment (test/live) toggle
- Active/inactive status flag
- Row Level Security (RLS) policies for Admin-only access
- Automatic timestamp updates via triggers
- Performance indexes

```sql
CREATE TABLE termii_settings (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id),
  campus_id INTEGER REFERENCES campuses(id),
  api_key TEXT NOT NULL,
  device_id TEXT, -- for WhatsApp
  base_url TEXT DEFAULT 'https://api.ng.termii.com',
  environment TEXT DEFAULT 'test', -- 'test' or 'live'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, campus_id)
);
```

### 2. TypeScript Interface
**File:** `src/types.ts`

Added `TermiiSettings` interface:
```typescript
export interface TermiiSettings {
  id: number;
  school_id: number;
  campus_id: number | null;
  api_key: string;
  device_id: string | null;
  base_url: string;
  environment: 'test' | 'live';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  campus?: { name: string };
}
```

### 3. UI Component
**File:** `src/components/TermiiSettings.tsx`

A fully-featured settings management component with:

#### Features
- **Form Fields:**
  - API Key (with show/hide toggle)
  - WhatsApp Device ID
  - Base URL (defaults to Termii API)
  - Environment selector (Test/Live)
  - Active/Inactive toggle
  - Campus selector (per-campus configuration)

- **Configuration Management:**
  - List all existing configurations
  - Edit existing settings
  - Delete configurations
  - Client-side validation for duplicates

- **User Experience:**
  - Loading states with spinners
  - Success/error alerts
  - Dark mode support
  - Responsive design
  - Inline help documentation

#### Help Section
Provides step-by-step instructions for obtaining Termii credentials:
1. Log in to Termii Dashboard
2. Navigate to API section for API Key
3. Go to Manage Devices for WhatsApp Device ID
4. Create and approve WhatsApp templates
5. Configure environment appropriately

### 4. Settings View Integration
**File:** `src/components/SettingsView.tsx`

Added new "Messaging Gateway" tab:
- Imported TermiiSettings component
- Added tab to navigation
- Integrated into render logic

## Design Patterns

### Consistency with Existing Code
- Follows `PaymentGatewaySettings.tsx` pattern
- Uses same card-based layout structure
- Consistent dark mode implementation
- Same loading/error handling approach
- Per-campus configuration support

### Security Features
- RLS policies restrict access to Admin users only
- School-based data isolation
- API keys stored securely in database
- Show/hide toggle for sensitive data
- Edit mode doesn't expose existing API key

### Validation
- Client-side duplicate campus detection
- Required field validation
- Conditional API key requirement (new vs. edit)
- Clear error messages

## Usage

### For Administrators

1. **Navigate to Settings:**
   - Go to Settings page
   - Click on "Messaging Gateway" tab

2. **Add New Configuration:**
   - Select campus (or "All Campuses")
   - Enter Termii API Key
   - Optionally enter WhatsApp Device ID
   - Set environment (Test/Live)
   - Enable/disable as needed
   - Click "Save"

3. **Edit Configuration:**
   - Click "Edit" on existing configuration
   - Modify fields as needed
   - Leave API Key blank to keep existing key
   - Click "Update"

4. **Delete Configuration:**
   - Click "Delete" on configuration
   - Confirm deletion

### For Developers

#### Accessing Settings in Code
```typescript
const { data: termiiSettings } = await supabase
  .from('termii_settings')
  .select('*')
  .eq('school_id', schoolId)
  .eq('is_active', true)
  .single();

// Use settings to configure Termii service
const termiiClient = new TermiiClient({
  apiKey: termiiSettings.api_key,
  deviceId: termiiSettings.device_id,
  baseUrl: termiiSettings.base_url,
  environment: termiiSettings.environment
});
```

## Database Schema

### RLS Policies
Only users with Admin role can:
- View termii_settings for their school
- Create new configurations
- Update existing configurations
- Delete configurations

```sql
CREATE POLICY "Admins can manage termii settings" 
ON public.termii_settings
FOR ALL
USING (
  school_id IN (
    SELECT school_id FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'Admin'
  )
);
```

### Triggers
Automatic `updated_at` timestamp management:
```sql
CREATE TRIGGER update_termii_settings_timestamp
BEFORE UPDATE ON public.termii_settings
FOR EACH ROW
EXECUTE FUNCTION update_termii_settings_updated_at();
```

## Testing

### Build Status
✅ Build successful with no TypeScript errors

### Code Review
✅ Passed with 2 minor nitpicks (design choices, not issues)

### Security Scan
✅ CodeQL scan passed with 0 alerts

## Migration Guide

### Applying the Database Migration

1. **Via Supabase Dashboard:**
   - Go to SQL Editor
   - Paste contents of `20251209_add_termii_settings_table.sql`
   - Execute

2. **Via Supabase CLI:**
   ```bash
   supabase db push
   ```

### Deploying the UI

The component will be available after deployment. No additional configuration needed - it's automatically integrated into the Settings page.

## Future Enhancements

Possible improvements for future iterations:

1. **Toast Notifications:**
   - Replace alert() with Toast component for better UX
   - Currently uses native alerts for consistency with PaymentGatewaySettings

2. **API Key Testing:**
   - Add "Test Connection" button
   - Validate API key before saving

3. **Usage Metrics:**
   - Show message sending statistics
   - Display API quota/usage

4. **Template Management:**
   - Manage WhatsApp templates from UI
   - View template approval status

5. **Audit Logging:**
   - Track configuration changes
   - Show change history

## Related Documentation

- [Termii API Documentation](https://developers.termii.com/)
- [PaymentGatewaySettings Implementation](src/components/PaymentGatewaySettings.tsx)
- [Database Schema](database_schema.sql)

## Support

For issues or questions:
1. Check Termii Dashboard for API key validity
2. Verify RLS policies are applied
3. Check browser console for errors
4. Review Supabase logs

## Changelog

### Version 1.0.0 (2024-12-09)
- Initial implementation
- Database migration with RLS policies
- UI component with full CRUD operations
- Integration with SettingsView
- Documentation

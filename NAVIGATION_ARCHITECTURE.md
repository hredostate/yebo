# Navigation Architecture Implementation Guide

## Overview

This document describes the React Router v6-based navigation architecture for Guardian 360, implementing path-based navigation with BrowserRouter for clean URLs.

## Migration Status: ✅ COMPLETE

The navigation migration to React Router v6 with BrowserRouter is **complete**. The app now uses:
- **Clean URLs** (no hash) via BrowserRouter
- **Path-based navigation** as the source of truth
- **Backward compatibility** for legacy hash URLs
- **React Router v6.30.2** consistently across the codebase

## Architecture Components

### 1. Route↔View Mapping (`src/routing/routeViewMapping.ts`)

**Single Source of Truth** for navigation mapping between:
- React Router paths (e.g., `/academics/result-manager`)
- Legacy VIEWS constants (e.g., `VIEWS.RESULT_MANAGER`)

```typescript
// Example usage:
import { viewToPath, pathToView } from './routing';

// Convert view to path
const path = viewToPath(VIEWS.RESULT_MANAGER); // → '/academics/result-manager'

// Convert path to view
const view = pathToView('/academics/result-manager'); // → 'Result Manager'

// Legacy hash URL support
const cleanPath = hashToPath('#Dashboard'); // → '/workspace/dashboard'
```

### 2. RouterWrapper (`src/components/RouterWrapper.tsx`)

Wraps the authenticated app with BrowserRouter and provides:
- Clean URL paths (no hash)
- Legacy hash URL redirect on initial load
- Bi-directional sync between path and legacy `currentView` state
- 404 handling via Routes

### 3. NotFound Page (`src/components/NotFoundPage.tsx`)

Friendly 404 page displayed when users navigate to unknown routes:
- Links back to `/workspace/dashboard`
- Go back button
- Modern, responsive design

### 4. Section Configuration (`src/routing/sectionConfig.ts`)

Defines metadata for each section:
- **Workspace**: Personal productivity tools
- **Communication**: Reports, announcements, broadcasts
- **Academics**: Lesson plans, grades, assessments
- **Student Affairs**: Student roster, interventions
- **Transport**: Transport management (3 tabs only)
- **HR**: User management, teams, attendance
- **Finance**: Payroll, fees, compliance
- **Admin**: Settings, analytics, policy

Each section includes:
- Title and default route
- Tab configuration (5 visible + More dropdown by default)
- Permission filters
- Optional pinned items

### 5. Navigation Hook (`src/hooks/useNavigation.ts`)

Unified navigation interface supporting both:
- Path-based navigation (React Router)
- View-based navigation (legacy VIEWS)

```typescript
import { useNavigation } from './hooks/useNavigation';

function MyComponent() {
  const { 
    navigateByView, 
    navigateByPath, 
    getCurrentView,
    getCurrentSection,
    isInSection 
  } = useNavigation();

  // Navigate using view (legacy - still works for compatibility)
  navigateByView(VIEWS.RESULT_MANAGER);

  // Navigate using path (new standard)
  navigateByPath('/academics/result-manager');

  // Get current view
  const view = getCurrentView(); // → 'Result Manager'

  // Get current section
  const section = getCurrentSection(); // → 'academics'
}
```

### 6. SidebarLink Component (`src/components/common/SidebarLink.tsx`)

Navigation link component that uses React Router's NavLink:
- Active state styling support
- Automatic path generation from view IDs
- Click handler integration
- Emergency legacy fallback if feature flags disabled

### 7. Feature Flags (`src/routing/featureFlags.ts`)

All feature flags are **enabled by default** (migration complete):
- `USE_NEW_NAVIGATION`: ✅ true
- `USE_SECTION_LAYOUTS`: ✅ true  
- `USE_PILL_TABS`: ✅ true

Can be overridden via localStorage for emergency rollback:
```javascript
// In browser console:
localStorage.setItem('sg360_use_new_nav', 'false');
window.location.reload();
```

## Section Defaults

Each section has a default route that it redirects to:

| Section | Default Route | Default View |
|---------|---------------|--------------|
| `/workspace` | `/workspace/dashboard` | Dashboard |
| `/communication` | `/communication/report-feed` | Report Feed |
| `/academics` | `/academics/lesson-plans` | Lesson Plans |
| `/student-affairs` | `/student-affairs/student-roster` | Student Roster |
| `/transport` | `/transport/transport-manager` | Transport Manager |
| `/hr` | `/hr/user-directory` | User Directory |
| `/finance` | `/finance/fees` | Bursary (Fees) |
| `/admin` | `/admin/global-settings` | Global Settings |

## Legacy Hash URL Support

The app provides **automatic redirect** for legacy hash-based URLs:

### Supported Hash Formats
- `#Dashboard` → `/workspace/dashboard`
- `#/Dashboard` → `/workspace/dashboard`
- `#Result Manager` → `/academics/result-manager`
- `#Student Profile/123` → `/student-affairs/student-profile/123`

### How It Works
1. On initial load, `RouterWrapper` checks for hash in URL
2. If hash exists (and not auth-related), converts to clean path via `hashToPath()`
3. Replaces URL without hash and navigates to clean path
4. All subsequent navigation uses clean URLs

### Auth Hash Handling
Auth-related hashes are ignored:
- `#access_token=...` - Supabase auth callback
- `#error=...` - Auth error handling

## Public Route Handling

Public routes (`/report/*`) bypass authenticated app routing:
- Handled in `App.tsx` before authentication check
- Render `PublicReportView` or `PublicReportPrintView` directly
- No hash redirect interference
- SEO-friendly clean URLs for sharing

## Tab Configuration

### Default Tab Display (5 + More)

Most sections display 5 tabs directly with overflow in "More" dropdown:
- Workspace: 6 tabs (5 visible + 1 in More)
- Communication: 6 tabs (5 visible + 1 in More)
- Academics: 10 tabs (5 visible + 5 in More)
- Student Affairs: 6 tabs (5 visible + 1 in More)
- HR: 8 tabs (5 visible + 3 in More)
- Finance: 7 tabs (5 visible + 2 in More)
- Admin: 8 tabs (5 visible + 3 in More)

### Transport Exception (3 tabs, no More)

Transport section has only 3 tabs, so no "More" dropdown is shown:
- Transport Manager
- My Transport Groups
- Transport Attendance

## Dependency Management

### React Router Version
- **Installed**: v6.30.2 (via npm)
- **Runtime (importmap)**: v6.30.2
- **Status**: ✅ Consistent

The importmap in `index.html` points to v6 (not v7) ensuring runtime consistency:
```json
{
  "imports": {
    "react-router-dom": "https://aistudiocdn.com/react-router-dom@^6.30.2"
  }
}
```

## Usage Examples

### Navigate by Path (Recommended)
```typescript
navigate('/academics/result-manager');
```

### Navigate by View (Legacy - Still Works)
```typescript
actions.setCurrentView(VIEWS.RESULT_MANAGER);
```

### Navigate with Parameters
```typescript
// New
navigate(`/student-affairs/student-profile/${studentId}`);

// Legacy (still works)
actions.setCurrentView(`${VIEWS.STUDENT_PROFILE}/${studentId}`);
```

### Check Current Section
```typescript
const { isInSection } = useNavigation();

if (isInSection('academics')) {
  // Show academics-specific UI
}
```

## Testing

### Manual Testing
1. Navigate to various pages via sidebar
2. Check URL bar - should show clean paths like `/workspace/dashboard`
3. Bookmark a page and reload - should work
4. Try legacy hash URL: `/#Dashboard` - should redirect to `/workspace/dashboard`
5. Navigate to unknown route - should show NotFound page

### Automated Tests
- `tests/navigationMapping.test.ts` - Route↔View mapping
- `tests/legacyHashRedirect.test.ts` - Hash URL redirect logic
- `tests/notFoundRoute.test.ts` - 404 page behavior
- `tests/navigationLinks.test.ts` - Link generation

Run tests: `npm run test:navigation`

## Emergency Rollback

If issues arise, temporarily disable new navigation:

### Option 1: Feature Flag (Per User)
```javascript
localStorage.setItem('sg360_use_new_nav', 'false');
window.location.reload();
```

### Option 2: Code Rollback
Revert `src/routing/featureFlags.ts`:
```typescript
USE_NEW_NAVIGATION: false,
USE_SECTION_LAYOUTS: false,
USE_PILL_TABS: false,
```

**Note**: This will revert to hash-based URLs but maintain backward compatibility.

## Technical Notes

- **BrowserRouter**: Uses HTML5 history API for clean URLs
- **Lazy Loading**: AppRouter components are lazy-loaded for performance
- **Permission Filtering**: Tabs automatically filtered based on user permissions
- **Responsive**: SectionLayout adapts to mobile/tablet/desktop viewports
- **Dark Mode**: Full support for light/dark themes
- **SEO**: Clean URLs improve SEO for public pages

## Migration Complete

✅ **BrowserRouter** active with clean URLs  
✅ **Path-based navigation** is source of truth  
✅ **Legacy hash URLs** auto-redirect on load  
✅ **NotFound page** for unknown routes  
✅ **React Router v6** consistent across codebase  
✅ **All feature flags** enabled by default  
✅ **Tests** cover redirect, NotFound, and link generation  

## Support

For questions or issues:
1. Check feature flags configuration
2. Verify route-view mappings in `routeViewMapping.ts`
3. Review browser console for navigation logs
4. Test with legacy navigation fallback
5. Check permission configuration


# Navigation Architecture Implementation Guide

## Overview

This document describes the new React Router v6-based navigation architecture for Guardian 360, implementing incremental migration Option A with full backward compatibility.

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
```

### 2. Section Configuration (`src/routing/sectionConfig.ts`)

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

### 3. SectionLayout Component (`src/components/layouts/SectionLayout.tsx`)

Reusable layout providing:
- **Section title** with expand toggle
- **Pinned items row** (max 5) above tabs if configured
- **Pill sub-tabs** with automatic "More" dropdown
- **Expanded launcher mode** (grid view of all tabs)
- **Content outlet** for nested routes

### 4. Navigation Hook (`src/hooks/useNavigation.ts`)

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

  // Navigate using view (legacy)
  navigateByView(VIEWS.RESULT_MANAGER);

  // Navigate using path (new)
  navigateByPath('/academics/result-manager');

  // Get current view
  const view = getCurrentView(); // → 'Result Manager'

  // Get current section
  const section = getCurrentSection(); // → 'academics'
}
```

### 5. Router Configuration (`src/routing/routes.tsx`)

Defines React Router v6 route structure with:
- Section-based layouts
- Default redirects (e.g., `/workspace` → `/workspace/dashboard`)
- Integration with existing AppRouter
- Parameterized routes support

### 6. Feature Flags (`src/routing/featureFlags.ts`)

Controls rollout of new navigation features:
- `USE_NEW_NAVIGATION`: Enable React Router v6 navigation
- `USE_SECTION_LAYOUTS`: Enable section-based layouts
- `USE_PILL_TABS`: Enable pill sub-tabs navigation

Can be overridden via localStorage for testing:
```javascript
// In browser console:
localStorage.setItem('sg360_use_new_nav', 'true');
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

Transport section has only 3 tabs, so no "More" dropdown is shown unless explicitly configured:
- Transport Manager
- My Transport Groups
- Transport Attendance

## Migration Path

### Phase 1: Infrastructure (Current)
✅ Install React Router v6
✅ Create route-view mapping
✅ Create section configuration
✅ Create SectionLayout component
✅ Create navigation hook
✅ Create router configuration
✅ Create feature flags

### Phase 2: Integration (Next)
- [ ] Integrate CompatibleRouter into App.tsx
- [ ] Update Sidebar to use new navigation
- [ ] Test backward compatibility
- [ ] Enable for limited users

### Phase 3: Gradual Rollout
- [ ] Enable feature flag for beta users
- [ ] Monitor for issues
- [ ] Gather feedback
- [ ] Make adjustments

### Phase 4: Full Migration
- [ ] Enable for all users
- [ ] Update all navigation calls
- [ ] Remove legacy navigation code
- [ ] Clean up feature flags

## Backward Compatibility

The new system maintains full backward compatibility:

1. **Dual Navigation Support**: Both `setCurrentView(view)` and `navigate(path)` work
2. **Hash-based URLs**: Continues using `HashRouter` for compatibility
3. **VIEWS Constants**: All existing VIEWS constants are mapped to paths
4. **Parameterized Routes**: Legacy routes like `Student Profile/123` still work
5. **Feature Flags**: Can be disabled instantly if issues arise

## Usage Examples

### Navigate by View (Legacy - Still Works)
```typescript
actions.setCurrentView(VIEWS.RESULT_MANAGER);
```

### Navigate by Path (New)
```typescript
navigate('/academics/result-manager');
```

### Navigate with Parameters
```typescript
// Legacy
actions.setCurrentView(`${VIEWS.STUDENT_PROFILE}/${studentId}`);

// New
navigate(`/student-affairs/student-profile/${studentId}`);
```

### Check Current Section
```typescript
const { isInSection } = useNavigation();

if (isInSection('academics')) {
  // Show academics-specific UI
}
```

## Testing

### Enable New Navigation for Testing
```javascript
// In browser console
localStorage.setItem('sg360_use_new_nav', 'true');
window.location.reload();
```

### Disable New Navigation
```javascript
localStorage.setItem('sg360_use_new_nav', 'false');
window.location.reload();
```

### Clear Override
```javascript
localStorage.removeItem('sg360_use_new_nav');
window.location.reload();
```

## Technical Notes

- **HashRouter**: Uses hash-based routing (`#/workspace/dashboard`) for compatibility
- **Lazy Loading**: AppRouter is lazy-loaded to maintain performance
- **Permission Filtering**: Tabs automatically filtered based on user permissions
- **Responsive**: SectionLayout adapts to mobile/tablet/desktop viewports
- **Dark Mode**: Full support for light/dark themes

## Future Enhancements

Potential future improvements:
1. BrowserRouter migration (remove hash from URLs)
2. Nested route parameters (breadcrumbs)
3. Route guards (authentication/authorization)
4. Route-based code splitting
5. Analytics integration
6. Deep linking from external sources
7. Route-based state management

## Support

For questions or issues:
1. Check feature flags configuration
2. Verify route-view mappings
3. Test with legacy navigation first
4. Review browser console for navigation logs
5. Check permission configuration


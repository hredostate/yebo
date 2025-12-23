# Enterprise Theme Documentation

## Overview

The enterprise theme provides a bright, professional visual refresh for the application with consistent styling across all components. The theme emphasizes:

- **Clean, bright appearance**: Slate-50 background with white surfaces
- **Indigo accent**: Used for active states, focus, and key actions
- **Crisp borders**: Subtle slate-200 borders for clear component separation
- **Professional typography**: Semibold font weights and tight tracking
- **Enterprise pill tabs**: Styled with subtle backgrounds and borders (not flat or overly friendly)

## Design Palette

### Colors

**Primary Brand**
- Indigo-600: Primary action color
- Indigo-700: Hover state for primary actions
- Indigo-50: Light tint for active backgrounds
- Indigo-300/600: Border colors for active states

**Neutral Surfaces**
- Slate-50: Main app background (light mode)
- White: Panel and card backgrounds
- Slate-100: Subtle input and inactive tab backgrounds
- Slate-200: Border color for separation

**Text Colors**
- Slate-900: Primary text
- Slate-700: Secondary text and labels
- Slate-600: Tertiary text and inactive states
- Slate-500: Help text and muted content

**Dark Mode**
- Slate-900: Dark background
- Slate-800: Panel backgrounds
- Slate-700: Borders and subtle backgrounds
- Slate-100/200: Text colors

### Typography

**Font Weights**
- Semibold (600): Primary buttons, tabs, headings
- Bold (700): Active states, emphasized text
- Medium (500): Secondary labels
- Regular (400): Body text

**Tracking**
- Tight: Headings and titles
- Normal: Body text
- Wide: Section labels and uppercase text

## Using the Theme

### Import the Theme Tokens

```typescript
import { enterprise } from '@/styles/enterpriseTheme';
```

### Applying Styles

#### Shell and Layout

```tsx
<div className={enterprise.shell}>
  <div className={enterprise.layout}>
    {/* Content */}
  </div>
</div>
```

#### Panels and Cards

```tsx
<div className={enterprise.panel}>
  <div className={enterprise.panelHeader}>
    <h2 className={enterprise.panelTitle}>Panel Title</h2>
    <p className={enterprise.panelSubTitle}>Subtitle text</p>
  </div>
  {/* Panel content */}
</div>

{/* Or use card variant */}
<div className={enterprise.card}>
  <div className={enterprise.cardHeader}>
    <h3 className={enterprise.cardTitle}>Card Title</h3>
  </div>
  <div className={enterprise.cardBody}>
    {/* Card content */}
  </div>
</div>
```

#### Enterprise Pill Tabs

Pill tabs have been refactored to look professional and enterprise:

```tsx
<div className={enterprise.pillTabsContainer}>
  <button className={`${enterprise.pillTabBase} ${enterprise.pillTabActive}`}>
    Active Tab
  </button>
  <button className={`${enterprise.pillTabBase} ${enterprise.pillTabInactive}`}>
    Inactive Tab
  </button>
</div>
```

Key characteristics:
- Subtle slate-100 background for inactive pills
- White background with indigo border for active pills
- Crisp border all around (not borderless)
- Shadow-sm on active state
- Font-semibold throughout
- Consistent hover states

#### Buttons

Buttons use bold styling with clear visual hierarchy:

```tsx
{/* Primary action */}
<button className={enterprise.btnPrimary}>
  Save Changes
</button>

{/* Secondary action */}
<button className={enterprise.btnSecondary}>
  Cancel
</button>

{/* Ghost/tertiary action */}
<button className={enterprise.btnGhost}>
  Learn More
</button>

{/* Danger action */}
<button className={enterprise.btnDanger}>
  Delete
</button>
```

Or use the Button component:

```tsx
import Button from '@/components/common/Button';

<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>
```

#### Sidebar Navigation

White sidebar with enterprise styling:

```tsx
<aside className={enterprise.sidebar}>
  {/* Section label */}
  <div className={enterprise.sidebarSectionLabel}>
    Section Name
  </div>
  
  {/* Navigation items */}
  <a className={`${enterprise.navItemBase} ${enterprise.navItemActive}`}>
    Active Item
  </a>
  <a className={`${enterprise.navItemBase} ${enterprise.navItemInactive}`}>
    Inactive Item
  </a>
</aside>
```

Active states feature:
- Indigo-50 background tint
- Bold font weight
- 4px left border in indigo-600
- Shadow-sm for subtle depth

#### Tables

```tsx
<div className={enterprise.tableWrap}>
  <table>
    <thead className={enterprise.thead}>
      <tr>
        <th className={enterprise.th}>Column Header</th>
      </tr>
    </thead>
    <tbody>
      <tr className={enterprise.trHover}>
        <td className={enterprise.td}>Cell content</td>
      </tr>
    </tbody>
  </table>
</div>
```

#### Alerts and Badges

```tsx
{/* Alert */}
<div className={`${enterprise.alertBase} ${enterprise.alertInfo}`}>
  Information message
</div>

{/* Badge */}
<span className={`${enterprise.badgeBase} ${enterprise.badgePrimary}`}>
  New
</span>
```

#### Forms

```tsx
<div>
  <label className={enterprise.label}>
    Field Label
  </label>
  <input className={enterprise.inputBase} />
  <p className={enterprise.helpText}>
    Help text for this field
  </p>
</div>
```

### Dark Mode

Dark mode variants are available under `enterprise.dark`:

```tsx
// Example: Conditional dark mode styling
const isDarkMode = true; // from theme context

<div className={isDarkMode ? enterprise.dark.shell : enterprise.shell}>
  <div className={isDarkMode ? enterprise.dark.panel : enterprise.panel}>
    {/* Content */}
  </div>
</div>
```

The application already handles dark mode switching via Tailwind's `dark:` prefix, so most components automatically adapt.

## Design Principles

1. **Avoid large indigo fills**: Use indigo primarily for accents, not as the dominant color across large surfaces
2. **Use white generously**: White backgrounds for panels, cards, and the sidebar create a clean, professional look
3. **Crisp borders**: Slate-200 borders provide clear visual separation without being heavy
4. **Consistent spacing**: Use padding and margins from the design system (px-4, py-2.5, etc.)
5. **Subtle shadows**: shadow-sm for slight elevation, not dramatic drop shadows
6. **Enterprise, not friendly**: Avoid overly rounded corners (use rounded-lg, not rounded-full for surfaces), flat gradients, or playful styling

## Component Updates

The following components have been updated with enterprise styling:

- ✅ `src/styles/enterpriseTheme.ts` - Central theme tokens
- ✅ `src/App.tsx` - Shell background (slate-50)
- ✅ `src/components/Sidebar.tsx` - White sidebar, enterprise nav items
- ✅ `src/components/layouts/SectionLayout.tsx` - Enterprise pill tabs
- ✅ `src/components/common/Button.tsx` - Bold button styles with focus rings

## Migration Guide

For existing components that need updating:

1. **Replace generic colors**: Switch from blue-* to indigo-* for brand colors
2. **Update backgrounds**: Use white for surfaces, slate-50 for app background
3. **Add borders**: Include border-slate-200 for component separation
4. **Increase font weights**: Use font-semibold instead of font-medium for emphasis
5. **Add focus rings**: Include focus:ring-2 focus:ring-indigo-500 for accessibility
6. **Update pills/tabs**: Remove flat styling, add borders and subtle backgrounds

### Example Migration

**Before:**
```tsx
<button className="px-4 py-2 bg-blue-500 text-white rounded-md">
  Click me
</button>
```

**After:**
```tsx
<button className={enterprise.btnPrimary}>
  Click me
</button>
```

## Compatibility

- ✅ React Router v6 compatible
- ✅ Tailwind CSS v3.4+ 
- ✅ Dark mode supported
- ✅ Responsive design maintained
- ✅ Accessibility focus rings included

## Support

For questions or issues with the enterprise theme, consult this documentation or review the `src/styles/enterpriseTheme.ts` file for the complete set of available tokens.

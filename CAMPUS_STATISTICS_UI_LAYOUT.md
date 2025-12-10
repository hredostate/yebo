# Campus Statistics Dashboard - UI Layout

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Campus Statistics Report                    [🖨️ Print] [📊 Export CSV] │
│  Comprehensive analytics and metrics across all campuses                │
├─────────────────────────────────────────────────────────────────────────┤
│  FILTERS                                                                │
│  ┌──────────────────────────┐  ┌──────────────────────────┐            │
│  │ Campus                   │  │ Term (Optional)          │            │
│  │ [All Campuses       ▼]  │  │ [All Terms          ▼]  │            │
│  └──────────────────────────┘  └──────────────────────────┘            │
├─────────────────────────────────────────────────────────────────────────┤
│  KPI SUMMARY CARDS                                                      │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────┐│
│  │ 👥            │ │ 👨‍🏫           │ │ 💰            │ │ 📈          ││
│  │ Total         │ │ Active        │ │ Total Fees    │ │ Collection  ││
│  │ Students      │ │ Users         │ │ Expected      │ │ Rate        ││
│  │               │ │               │ │               │ │             ││
│  │   1,234       │ │    89         │ │  ₦45.2M       │ │   78%       ││
│  │               │ │               │ │               │ │             ││
│  │ 1,180 active  │ │ Staff members │ │ ₦35.3M coll.  │ │ ₦9.9M out.  ││
│  └───────────────┘ └───────────────┘ └───────────────┘ └─────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  DETAILED BREAKDOWN BY CAMPUS                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Campus      Students  Active  Susp.  Staff  Expected  Collected  ... ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Main Campus    500     480     15     45   ₦20.5M    ₦16.2M    79% ││
│  │ Branch A       300     290      8     28   ₦12.3M    ₦9.8M     80% ││
│  │ Branch B       250     240      7     22   ₦10.2M    ₦7.5M     74% ││
│  │ No Campus      184     170      9     14   ₦2.2M     ₦1.8M     82% ││
│  └─────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  ADDITIONAL DETAILS (when single campus selected)                       │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐  │
│  │ Fees Owed by        │ │ Fees Owed by        │ │ Student-to-Staff │  │
│  │ Graduated Students  │ │ Expelled Students   │ │ Ratio            │  │
│  │     ₦125,000        │ │     ₦86,000         │ │      11.1:1      │  │
│  └─────────────────────┘ └─────────────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

### Campus Selector
- **All Campuses**: Shows aggregate statistics across all campuses
- **Individual Campuses**: Shows statistics for a specific campus
- **No Campus Assigned**: Shows statistics for students/staff not assigned to any campus

### Term Filter
- Optional filter for financial data
- Affects: Invoices, fees expected, fees collected, fees outstanding
- Default: All Terms (shows all-time data)

### KPI Cards
1. **Total Students** (Blue gradient)
   - Total count with active students shown below
   - Icon: 👥

2. **Active Users** (Purple gradient)
   - Staff member count
   - Icon: 👨‍🏫

3. **Total Fees Expected** (Green gradient)
   - Total invoiced amount
   - Collected amount shown below
   - Icon: 💰

4. **Collection Rate** (Orange gradient)
   - Percentage of fees collected
   - Outstanding amount shown below
   - Icon: 📈

### Data Table
Columns:
- Campus name
- Total students
- Active students
- Suspended students
- Total staff
- Expected fees
- Collected fees (green text)
- Outstanding fees (red text)
- Collection rate (color-coded badge)

**Collection Rate Color Coding:**
- 🟢 Green: ≥80% (good)
- 🟡 Yellow: 50-79% (fair)
- 🔴 Red: <50% (needs attention)

### Additional Details (Single Campus View)
When viewing a single campus (not "All Campuses"), three additional cards show:
1. Fees owed by graduated students
2. Fees owed by expelled students
3. Student-to-staff ratio

### Export Options
- **CSV Export**: Downloads formatted CSV with all statistics
- **Print**: Opens browser print dialog with print-optimized layout

## Color Scheme

### Light Mode
- Background: White with slight transparency and backdrop blur
- Cards: Gradient backgrounds (blue, purple, green, orange)
- Text: Slate-900 for headers, Slate-700 for content
- Borders: Slate-200/60

### Dark Mode
- Background: Slate-900/40 with slight transparency and backdrop blur
- Cards: Dark gradient backgrounds (blue-900, purple-900, green-900, orange-900)
- Text: White for headers, Slate-300 for content
- Borders: Slate-800/60

## Responsive Design
- Mobile: Single column layout for cards
- Tablet: 2 columns for cards
- Desktop: 4 columns for cards (one row)
- Table: Horizontal scroll on smaller screens

## Loading States
- Spinner animation while loading data
- Disabled state for buttons during loading

## Error States
- Red border card with error message
- Retry option (refresh by changing filters)

## Accessibility
- Proper ARIA labels
- Keyboard navigation support
- High contrast in both light and dark modes
- Readable font sizes
- Clear visual hierarchy

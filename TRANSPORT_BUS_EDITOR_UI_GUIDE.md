# TransportBusEditor UI Components Guide

## Component Structure

### 1. Main Bus List View

```
┌────────────────────────────────────────────────────────────────────────┐
│  Bus Management                                      [+ Add New Bus]    │
│  Manage school buses and view seat assignments                         │
├────────────────────────────────────────────────────────────────────────┤
│  🔍 Search by bus number, license plate, driver name, or campus...     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ Bus # │ License │ Capacity │ Driver    │ Campus  │ Status │ Act. │ │
│  ├───────┼─────────┼──────────┼───────────┼─────────┼────────┼──────┤ │
│  │ BUS01 │ ABC123  │ 40 seats │ John Doe  │ Main    │ Active │ 👁📝🗑 │ │
│  │       │         │          │ 555-1234  │         │        │      │ │
│  ├───────┼─────────┼──────────┼───────────┼─────────┼────────┼──────┤ │
│  │ BUS02 │ XYZ789  │ 32 seats │ Jane Smith│ North   │ Active │ 👁📝🗑 │ │
│  │       │         │          │ 555-5678  │         │        │      │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘

Icons: 👁 = View Seat Map | 📝 = Edit | 🗑 = Delete
```

### 2. Add/Edit Bus Form Modal

```
┌────────────────────────────────────────────────────┐
│  Add New Bus                                    ✕  │
├────────────────────────────────────────────────────┤
│                                                     │
│  Bus Number *        License Plate                 │
│  ┌──────────────┐   ┌──────────────┐              │
│  │ BUS03        │   │ DEF456       │              │
│  └──────────────┘   └──────────────┘              │
│                                                     │
│  Capacity (Number of Seats) *                      │
│  ┌──────────────────────────────┐                  │
│  │ 40                           │                  │
│  └──────────────────────────────┘                  │
│  Rows will be calculated as: 10 rows × 4 seats     │
│                                                     │
│  Driver Name         Driver Phone                  │
│  ┌──────────────┐   ┌──────────────┐              │
│  │ Mike Johnson │   │ 555-9999     │              │
│  └──────────────┘   └──────────────┘              │
│                                                     │
│  Home Campus                                        │
│  ┌──────────────────────────────┐                  │
│  │ Select a campus         ▼    │                  │
│  └──────────────────────────────┘                  │
│                                                     │
│  ☑ Active                                          │
│                                                     │
├────────────────────────────────────────────────────┤
│                          [Cancel] [Create Bus]     │
└────────────────────────────────────────────────────┘
```

### 3. Delete Confirmation Modal

```
┌─────────────────────────────────────────┐
│  Confirm Deletion                       │
├─────────────────────────────────────────┤
│                                          │
│  Are you sure you want to delete bus    │
│  BUS03? This action cannot be undone.   │
│                                          │
├─────────────────────────────────────────┤
│                   [Cancel] [Delete Bus] │
└─────────────────────────────────────────┘
```

### 4. Visual Seat Map Modal

```
┌────────────────────────────────────────────────────────────────────┐
│  Seat Map - Bus BUS01                                           ✕  │
├────────────────────────────────────────────────────────────────────┤
│  Bus BUS01 - Seat Selection                                        │
│  Capacity: 40 seats                                                │
│                                                                     │
│  Legend:  🟢 Available   🔴 Occupied   🔵 Selected                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                        [DRIVER]                               │ │
│  │ ─────────────────────────────────────────────────────────────│ │
│  │                                                               │ │
│  │  1  🟢1A  🟢1B      [AISLE]      🔴1C  🔴1D  1               │ │
│  │                                   ↑ Shows student name       │ │
│  │  2  🟢2A  🟢2B      [AISLE]      🟢2C  🟢2D  2               │ │
│  │                                                               │ │
│  │  3  🔴3A  🔴3B      [AISLE]      🟢3C  🟢3D  3               │ │
│  │                                                               │ │
│  │  4  🟢4A  🟢4B      [AISLE]      🔴4C  🟢4D  4               │ │
│  │                                                               │ │
│  │  5  🟢5A  🟢5B      [AISLE]      🟢5C  🟢5D  5               │ │
│  │                                                               │ │
│  │  ... (rows continue) ...                                     │ │
│  │                                                               │ │
│  │ 10  🟢10A 🟢10B     [AISLE]      🟢10C 🟢10D 10              │ │
│  │                                                               │ │
│  │                    BACK OF BUS                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Hover over red (occupied) seats to see student names              │
└────────────────────────────────────────────────────────────────────┘
```

### 5. Toast Notifications

```
┌─────────────────────────────────────┐
│ ✓ Bus created successfully          │  (Success - Green)
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ✓ Bus updated successfully          │  (Success - Green)
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ✓ Bus deleted successfully          │  (Success - Green)
└─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ⚠ Cannot delete bus: 15 active subscription(s) found.          │  (Warning - Orange)
│   Please reassign or cancel subscriptions first.               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ✗ Failed to load buses: [error]     │  (Error - Red)
└─────────────────────────────────────┘
```

## User Interactions

### Adding a New Bus
1. Click **"Add New Bus"** button (top right)
2. Fill in required fields:
   - Bus Number (required)
   - Capacity (required, minimum 1)
3. Optionally fill:
   - License Plate
   - Driver Name & Phone
   - Home Campus
   - Active status (default: checked)
4. Click **"Create Bus"**
5. See success toast notification
6. New bus appears in the list

### Editing a Bus
1. Click the **Edit icon** (📝) for any bus
2. Form modal opens with pre-filled data
3. Modify any fields
4. Click **"Update Bus"**
5. See success toast notification
6. Changes reflect in the list

### Viewing Seat Map
1. Click the **Eye icon** (👁) for any bus
2. Seat map modal opens showing:
   - Visual grid of all seats
   - Color-coded availability:
     - Green = Available
     - Red = Occupied
     - Blue = Selected (not used in admin view)
   - Driver seat at front
   - Legend explaining colors
3. Hover over red seats to see student names
4. Read-only view (no selection allowed)

### Deleting a Bus
1. Click the **Delete icon** (🗑) for any bus
2. Confirmation modal appears
3. Click **"Delete Bus"** to confirm
4. If bus has active subscriptions:
   - Warning toast appears
   - Deletion is prevented
   - Admin must reassign students first
5. If no subscriptions:
   - Bus is deleted
   - Success toast appears
   - Bus removed from list

### Searching Buses
1. Type in the search box
2. Results filter in real-time
3. Search across:
   - Bus number
   - License plate
   - Driver name
   - Campus name

## Responsive Behavior

### Desktop (> 1024px)
- Full table layout
- All columns visible
- Comfortable spacing
- Large modals

### Tablet (768px - 1024px)
- Table with horizontal scroll
- Compact spacing
- Medium-sized modals

### Mobile (< 768px)
- Card-based layout (future enhancement)
- Horizontal scroll for table
- Full-screen modals
- Touch-friendly buttons

## Color Scheme

### Status Badges
- **Active**: Green background (#10B981), dark green text
- **Inactive**: Red background (#EF4444), dark red text

### Buttons
- **Primary (Add)**: Blue (#2563EB)
- **Success (Save)**: Blue (#2563EB)
- **Danger (Delete)**: Red (#DC2626)
- **Secondary (Cancel)**: Gray (#6B7280)

### Action Icons
- **View**: Blue (#2563EB)
- **Edit**: Indigo (#6366F1)
- **Delete**: Red (#DC2626)

### Seat Colors (in Seat Map)
- **Available**: Light green (#D1FAE5) with green border
- **Occupied**: Light red (#FEE2E2) with red border
- **Selected**: Blue (#3B82F6) with dark blue border
- **Driver**: Gray (#D1D5DB)

## Accessibility Features

1. **Keyboard Navigation**: All interactive elements are keyboard accessible
2. **ARIA Labels**: Screen reader support for icons and actions
3. **Color Contrast**: WCAG AA compliant color combinations
4. **Focus Indicators**: Clear focus states for keyboard users
5. **Semantic HTML**: Proper use of table, button, and form elements
6. **Error Messages**: Clear, descriptive error messages
7. **Loading States**: Visual indicators during data fetching

## Data Flow

```
User Action
    ↓
Component State Change
    ↓
Supabase Query (via requireSupabaseClient)
    ↓
Database Operation
    ↓
Response Handling
    ↓
UI Update + Toast Notification
```

## Integration Points

1. **BusSeatSelector Component**: Reused existing component for seat visualization
2. **TransportManager**: Parent component that renders TransportBusEditor in Buses tab
3. **Supabase Tables**:
   - `transport_buses`: Main bus data
   - `transport_subscriptions`: For checking occupied seats
   - `campuses`: For campus dropdown
4. **Toast System**: Global toast notification system via `addToast` prop

## Future UI Enhancements (Out of Scope)

1. Card view option for mobile
2. Bulk actions (delete multiple buses)
3. Export bus list to CSV
4. Print-friendly seat map
5. Drag-and-drop for seat reassignment
6. Real-time occupancy updates
7. Bus photo upload
8. Maintenance history timeline

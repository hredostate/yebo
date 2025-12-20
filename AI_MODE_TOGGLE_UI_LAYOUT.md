# AI Mode Toggle - UI Layout

## Component Visual Design

### Toggle Component (AICommentToggle)
```
┌─────────────────────────────────────────────────────────────┐
│ Comment Mode:  [◯───●]  ☁️ AI (online)                      │
└─────────────────────────────────────────────────────────────┘

When OFF (Offline Mode):
┌─────────────────────────────────────────────────────────────┐
│ Comment Mode:  [●───◯]  🗄️ Offline (instant)                │
└─────────────────────────────────────────────────────────────┘
```

## Integration in TeacherCommentEditor

### Before (Old Design)
```
┌──────────────────────────────────────────────────────────────┐
│  Edit Teacher Comments                                    ×  │
│  JS1A - First Term 2024                                      │
├──────────────────────────────────────────────────────────────┤
│  [Search students...] [Generate (Rule-Based)] [Generate (AI)]│
│                       [Save All (0)]                          │
└──────────────────────────────────────────────────────────────┘
```

### After (New Design with Toggle)
```
┌──────────────────────────────────────────────────────────────┐
│  Edit Teacher Comments                                    ×  │
│  JS1A - First Term 2024                                      │
├──────────────────────────────────────────────────────────────┤
│  [Search students...]                                         │
│  Comment Mode: [◯───●] ☁️ AI (online)                        │
│  [🪄 Generate Comments]  [✓ Save All (0)]                    │
└──────────────────────────────────────────────────────────────┘
```

## Features

### Visual States

#### AI Mode ON (Default)
- Toggle switch: Right position (enabled)
- Icon: ☁️ Cloud icon (blue/indigo)
- Label: "AI (online)"
- Background: Blue/indigo color (bg-indigo-600)
- Button text: "Generate Comments" (uses AI)

#### Offline Mode
- Toggle switch: Left position (disabled)
- Icon: 🗄️ Database icon (gray)
- Label: "Offline (instant)"
- Background: Gray color (bg-slate-300)
- Button text: "Generate Comments" (uses offline bank)

### User Interactions

1. **Clicking the toggle**:
   - Switches between AI and Offline modes
   - Shows toast notification
   - Persists choice in localStorage
   - Updates button behavior

2. **Generating comments**:
   - Single button adapts to current mode
   - Shows loading spinner during generation
   - Displays mode in toast message

3. **Hover states**:
   - Toggle shows tooltip explaining the mode
   - Button shows hover effect

### Responsive Design

#### Desktop (>1024px)
```
[Search input (flexible width)]  [Comment Mode: Toggle + Label]  [Generate]  [Save All]
```

#### Tablet (768-1024px)
```
[Search input (full width)]
[Comment Mode: Toggle + Label]  [Generate]  [Save All]
```

#### Mobile (<768px)
```
[Search input (full width)]
[Comment Mode: Toggle + Label]
[Generate Comments (full width)]
[Save All (full width)]
```

## Colors & Styling

### Toggle Component
- **ON (AI Mode)**
  - Switch background: `bg-indigo-600`
  - Switch knob: `bg-white`
  - Icon: `text-indigo-600`
  - Label: `text-slate-700`

- **OFF (Offline Mode)**
  - Switch background: `bg-slate-300` / `dark:bg-slate-600`
  - Switch knob: `bg-white`
  - Icon: `text-slate-600`
  - Label: `text-slate-700`

- **Disabled**
  - Opacity: `opacity-50`
  - Cursor: `cursor-not-allowed`

### Focus States
- Focus ring: `focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`

## Accessibility

- ✅ Proper ARIA labels (`role="switch"`, `aria-checked`)
- ✅ Keyboard navigation support
- ✅ Screen reader friendly labels
- ✅ Clear visual states
- ✅ Tooltips for additional context

## Toast Notifications

### Switching to AI Mode
```
ℹ️ Switched to AI mode - comments will use AI service
```

### Switching to Offline Mode
```
ℹ️ Switched to Offline mode - comments will use offline bank
```

### During Generation (AI Mode)
```
ℹ️ Generating teacher comments with AI...
```

### During Generation (Offline Mode)
```
ℹ️ Generating teacher comments using offline comment bank...
```

## Implementation Details

### Component Props
```typescript
interface AICommentToggleProps {
  enabled: boolean;           // Current state
  onChange: (enabled: boolean) => void;  // State change handler
  disabled?: boolean;         // Disable toggle during operations
  showLabels?: boolean;       // Show/hide labels
  className?: string;         // Additional CSS classes
}
```

### Usage Example
```tsx
<AICommentToggle
  enabled={useAIComments}
  onChange={handleAIToggleChange}
  disabled={isGenerating}
  showLabels={true}
/>
```

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ localStorage support required (all modern browsers)

## Performance

- **Toggle interaction**: <50ms (instant)
- **localStorage read/write**: <5ms (synchronous)
- **AI generation**: 500ms per comment (with rate limiting)
- **Offline generation**: <10ms per comment (instant)

## Dark Mode Support

The toggle component fully supports dark mode:
- Uses Tailwind's `dark:` variants
- Adjusts colors for visibility
- Maintains contrast ratios
- Smooth transitions between modes

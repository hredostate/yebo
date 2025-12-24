# Navigation Architecture - Before and After Fix

## Before Fix (Race Condition)

```
User clicks sidebar link
         |
         v
  [SidebarLink onClick]
         |
         +------------------+------------------+
         |                  |                  |
         v                  v                  v
   navigate(path)      onNavigate(view)   window.hash = view
   (React Router)      (sets state)       (App.tsx)
         |                  |                  |
         v                  v                  v
   location changes    currentView set    hashchange event
         |                  |                  |
         v                  v                  v
   LocationSync path→view   |             hashchange handler
         |                  |             sets currentView
         v                  v                  v
   setCurrentView(view) ←---+                  |
         |                                     |
         v                                     |
   LocationSync view→path                      |
         |                                     |
         v                                     |
   navigate(path) ←----------------------------+
         |
         v
   🔄 INFINITE LOOP!
```

## After Fix (Stable Navigation)

```
User clicks sidebar link
         |
         v
  [SidebarLink onClick]
         |
         v
   navigate(path)
   (React Router ONLY)
         |
         v
   location changes
         |
         v
   LocationSync path→view
   (with isUpdatingRef guard)
         |
         v
   setCurrentView(view)
   isUpdatingRef = true
         |
         v
   LocationSync view→path
   (sees isUpdatingRef = true)
         |
         v
   SKIP - no infinite loop!
         |
         v
   ✅ Navigation complete
```

## Key Changes

### 1. Removed Hash Sync (App.tsx)
```diff
- useEffect(() => {
-   // Sync currentView to hash
-   window.location.hash = targetView;
- }, [currentView]);
-
- useEffect(() => {
-   // Sync hash to currentView
-   setCurrentView(hash);
- }, []);
```

### 2. Added Update Tracking (RouterWrapper.tsx, CompatibleRouter.tsx)
```diff
+ const isUpdatingRef = React.useRef(false);

  useEffect(() => {
+   if (isUpdatingRef.current) {
+     isUpdatingRef.current = false;
+     return; // Prevent re-trigger
+   }
    
    const view = pathToView(location.pathname);
    if (view && view !== currentView) {
+     isUpdatingRef.current = true;
      setCurrentView(view);
    }
- }, [location.pathname, currentView, setCurrentView]);
+ }, [location.pathname, setCurrentView]);
```

### 3. Fixed Duplicate Navigation (SidebarLink.tsx)
```diff
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick();
    }
-   // Always call onNavigate
-   onNavigate(viewId);
+   // Only call onNavigate for legacy mode
+   if (!useNewNav) {
+     onNavigate(viewId);
+   }
  };
```

## Navigation Flow After Fix

```
┌─────────────────────────────────────────────────┐
│              User Interaction                    │
└─────────────────┬───────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────┐
│         SidebarLink (NavLink)                    │
│  - Uses React Router navigation only             │
│  - No legacy state updates                       │
└─────────────────┬───────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────┐
│           React Router                           │
│  - Updates location.pathname                     │
│  - Triggers navigation event                     │
└─────────────────┬───────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────┐
│     LocationSync (path → view)                   │
│  - Detects pathname change                       │
│  - Sets isUpdatingRef = true                     │
│  - Updates currentView state                     │
└─────────────────┬───────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────┐
│     LocationSync (view → path)                   │
│  - Sees isUpdatingRef = true                     │
│  - SKIPS navigation (prevents loop)              │
│  - Resets isUpdatingRef = false                  │
└─────────────────┬───────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────┐
│          Navigation Complete ✅                  │
│  - User sees target view                         │
│  - URL shows correct path                        │
│  - No bouncing or glitching                      │
└─────────────────────────────────────────────────┘
```

## Legacy Hash URL Support

```
User visits old hash URL
(e.g., example.com/#Dashboard)
         |
         v
  LegacyHashRedirect
  (in RouterWrapper)
         |
         v
  hashToPath('#Dashboard')
  returns '/workspace/dashboard'
         |
         v
  navigate('/workspace/dashboard')
  (React Router)
         |
         v
  Standard navigation flow
  (as shown above)
         |
         v
  ✅ User sees Dashboard
```

## Debugging Console Logs

When navigation is working correctly, you'll see:

```
[RouterWrapper] Location changed, updating currentView: /academics/lesson-plans → Lesson Plans
```

When there was a race condition, you'd see:

```
[RouterWrapper] Location changed, updating currentView: /academics/lesson-plans → Lesson Plans
[RouterWrapper] currentView changed, navigating to: Lesson Plans → /academics/lesson-plans
[RouterWrapper] Location changed, updating currentView: /workspace/dashboard → Dashboard
[RouterWrapper] currentView changed, navigating to: Dashboard → /workspace/dashboard
[RouterWrapper] Location changed, updating currentView: /academics/lesson-plans → Lesson Plans
... (repeating infinitely)
```

## Rollback Safety

The fix maintains backward compatibility:

```
Feature Flag: USE_NEW_NAVIGATION = false
         |
         v
  SidebarLink uses legacy mode
         |
         v
  onClick calls onNavigate(viewId)
         |
         v
  setCurrentView(viewId)
         |
         v
  LocationSync view→path
         |
         v
  navigate(path)
         |
         v
  ✅ Legacy navigation works
```

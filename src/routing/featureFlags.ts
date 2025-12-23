/**
 * Feature Flag for New Navigation
 * 
 * Controls whether the new React Router v6 navigation architecture is enabled
 * This allows for gradual rollout and easy rollback if needed
 */

export const FEATURE_FLAGS = {
  // Enable React Router v6 navigation with SectionLayout
  USE_NEW_NAVIGATION: true, // Enabled by default - migration complete
  
  // Enable section-based layouts
  USE_SECTION_LAYOUTS: true, // Enabled by default - migration complete
  
  // Enable pill sub-tabs
  USE_PILL_TABS: true, // Enabled by default - migration complete
} as const;

export function isNewNavigationEnabled(): boolean {
  // Check localStorage override for testing
  const override = localStorage.getItem('sg360_use_new_nav');
  if (override !== null) {
    return override === 'true';
  }
  return FEATURE_FLAGS.USE_NEW_NAVIGATION;
}

export function areSectionLayoutsEnabled(): boolean {
  const override = localStorage.getItem('sg360_use_section_layouts');
  if (override !== null) {
    return override === 'true';
  }
  return FEATURE_FLAGS.USE_SECTION_LAYOUTS;
}

export function arePillTabsEnabled(): boolean {
  const override = localStorage.getItem('sg360_use_pill_tabs');
  if (override !== null) {
    return override === 'true';
  }
  return FEATURE_FLAGS.USE_PILL_TABS;
}

/**
 * Enable new navigation for current session (for testing)
 */
export function enableNewNavigation(): void {
  localStorage.setItem('sg360_use_new_nav', 'true');
  window.location.reload();
}

/**
 * Disable new navigation for current session
 */
export function disableNewNavigation(): void {
  localStorage.setItem('sg360_use_new_nav', 'false');
  window.location.reload();
}

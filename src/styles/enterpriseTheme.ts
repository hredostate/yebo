/**
 * Enterprise Theme Tokens
 * 
 * Centralized design tokens for the enterprise visual refresh.
 * Provides consistent styling across the application with:
 * - Indigo accent color for active states and key actions
 * - White sidebar and surfaces
 * - Crisp borders and subtle shadows
 * - Enterprise pill tabs (not friendly/flat)
 * 
 * Note: Import paths in this project use relative imports.
 * Example: import { enterprise } from '../../styles/enterpriseTheme';
 */

export interface EnterpriseTheme {
  // Shell & Layout
  shell: string;
  layout: string;
  panel: string;
  panelHeader: string;
  panelTitle: string;
  panelSubTitle: string;

  // Sidebar
  sidebar: string;
  sidebarSectionLabel: string;
  navItemBase: string;
  navItemActive: string;
  navItemInactive: string;

  // Pill Tabs
  pillTabsContainer: string;
  pillTabBase: string;
  pillTabActive: string;
  pillTabInactive: string;

  // Alternative: Underline tabs
  tabsBar: string;
  tabBase: string;
  tabActiveText: string;
  tabInactiveText: string;
  tabIndicator: string;

  // Buttons
  btnPrimary: string;
  btnSecondary: string;
  btnGhost: string;
  btnDanger: string;

  // Cards
  card: string;
  cardHeader: string;
  cardTitle: string;
  cardBody: string;

  // Tables
  tableWrap: string;
  thead: string;
  th: string;
  td: string;
  trHover: string;

  // Alerts & Badges
  alertBase: string;
  alertInfo: string;
  alertSuccess: string;
  alertWarning: string;
  alertError: string;
  badgeBase: string;
  badgePrimary: string;
  badgeSuccess: string;
  badgeWarning: string;
  badgeDanger: string;
  badgeNeutral: string;

  // Forms
  inputBase: string;
  label: string;
  helpText: string;

  // Dark mode
  dark: Partial<EnterpriseTheme>;
}

export const enterprise: EnterpriseTheme = {
  // Shell & Layout
  shell: "min-h-screen bg-slate-50 text-slate-900",
  layout: "mx-auto max-w-[1400px] px-4 py-6",
  panel: "bg-white border border-slate-200 rounded-xl shadow-sm",
  panelHeader: "px-6 py-4 border-b border-slate-200",
  panelTitle: "text-lg font-semibold tracking-tight text-slate-900",
  panelSubTitle: "text-sm text-slate-600 mt-1",

  // Sidebar
  sidebar: "bg-white border-r border-slate-200",
  sidebarSectionLabel: "px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500",

  navItemBase:
    "group flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors " +
    "text-slate-700 hover:text-slate-900 hover:bg-slate-50 " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white",
  navItemActive: "bg-indigo-50 text-slate-900 border-l-4 border-indigo-600 font-bold",
  navItemInactive: "border-l-4 border-transparent",

  // Enterprise Pill Tabs (not friendly, more professional)
  pillTabsContainer: "flex items-center gap-2 overflow-x-auto px-6 py-3 border-t border-slate-100",
  pillTabBase: 
    "px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 " +
    "whitespace-nowrap border border-slate-200 bg-slate-100 " +
    "hover:bg-slate-200 hover:border-slate-300 " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
  pillTabActive: 
    "bg-white text-indigo-700 border-indigo-300 shadow-sm " +
    "hover:bg-white hover:border-indigo-400 font-bold",
  pillTabInactive: "text-slate-600 hover:text-slate-900",

  // Alternative: Underline tabs (enterprise style)
  tabsBar: "bg-white border-b border-slate-200 px-6",
  tabBase: "relative py-3 text-sm font-semibold transition-colors",
  tabActiveText: "text-slate-900",
  tabInactiveText: "text-slate-600 hover:text-slate-900",
  tabIndicator: "absolute left-0 -bottom-px h-0.5 w-full rounded-full transition-opacity",

  // Buttons
  btnPrimary:
    "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white " +
    "shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
    "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnSecondary:
    "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 " +
    "shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
    "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnGhost:
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 " +
    "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
    "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnDanger:
    "inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white " +
    "shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 " +
    "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",

  // Cards
  card: "bg-white border border-slate-200 rounded-xl shadow-sm",
  cardHeader: "px-5 py-4 border-b border-slate-200",
  cardTitle: "text-sm font-semibold text-slate-900",
  cardBody: "p-5",

  // Tables
  tableWrap: "bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden",
  thead: "bg-slate-50 border-b border-slate-200",
  th: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700",
  td: "px-4 py-3 text-sm text-slate-800",
  trHover: "hover:bg-slate-50 transition-colors",

  // Alerts & Badges
  alertBase: "rounded-lg p-4 border",
  alertInfo: "bg-blue-50 border-blue-200 text-blue-800",
  alertSuccess: "bg-green-50 border-green-200 text-green-800",
  alertWarning: "bg-amber-50 border-amber-200 text-amber-800",
  alertError: "bg-red-50 border-red-200 text-red-800",

  badgeBase: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
  badgePrimary: "bg-indigo-100 text-indigo-800",
  badgeSuccess: "bg-green-100 text-green-800",
  badgeWarning: "bg-amber-100 text-amber-800",
  badgeDanger: "bg-red-100 text-red-800",
  badgeNeutral: "bg-slate-100 text-slate-800",

  // Forms
  inputBase: 
    "block w-full rounded-lg border-slate-300 shadow-sm " +
    "focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm " +
    "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
  label: "block text-sm font-semibold text-slate-700 mb-1",
  helpText: "mt-1 text-xs text-slate-500",

  // Dark Mode Variants (complete theme)
  dark: {
    // Shell & Layout
    shell: "min-h-screen bg-slate-900 text-slate-100",
    layout: "mx-auto max-w-[1400px] px-4 py-6",
    panel: "bg-slate-800 border border-slate-700 rounded-xl shadow-sm",
    panelHeader: "px-6 py-4 border-b border-slate-700",
    panelTitle: "text-lg font-semibold tracking-tight text-slate-100",
    panelSubTitle: "text-sm text-slate-400 mt-1",
    
    // Sidebar
    sidebar: "bg-slate-800 border-r border-slate-700",
    sidebarSectionLabel: "px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400",
    navItemBase:
      "group flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors " +
      "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 " +
      "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800",
    navItemActive: "bg-indigo-900/30 text-slate-100 border-l-4 border-indigo-500 font-bold",
    navItemInactive: "border-l-4 border-transparent",
    
    // Pill Tabs
    pillTabsContainer: "flex items-center gap-2 overflow-x-auto px-6 py-3 border-t border-slate-700",
    pillTabBase: 
      "px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 " +
      "whitespace-nowrap border border-slate-700 bg-slate-800 " +
      "hover:bg-slate-700 hover:border-slate-600 " +
      "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
    pillTabActive: 
      "bg-slate-900 text-indigo-400 border-indigo-600 shadow-sm " +
      "hover:bg-slate-900 hover:border-indigo-500 font-bold",
    pillTabInactive: "text-slate-400 hover:text-slate-200",
    
    // Alternative: Underline tabs
    tabsBar: "bg-slate-800 border-b border-slate-700 px-6",
    tabBase: "relative py-3 text-sm font-semibold transition-colors",
    tabActiveText: "text-slate-100",
    tabInactiveText: "text-slate-400 hover:text-slate-200",
    tabIndicator: "absolute left-0 -bottom-px h-0.5 w-full rounded-full transition-opacity",
    
    // Buttons
    btnPrimary:
      "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white " +
      "shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 " +
      "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
    btnSecondary:
      "inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 " +
      "shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 " +
      "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
    btnGhost:
      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 " +
      "hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
      "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
    btnDanger:
      "inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white " +
      "shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800 " +
      "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
    
    // Cards
    card: "bg-slate-800 border border-slate-700 rounded-xl shadow-sm",
    cardHeader: "px-5 py-4 border-b border-slate-700",
    cardTitle: "text-sm font-semibold text-slate-100",
    cardBody: "p-5",
    
    // Tables
    tableWrap: "bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden",
    thead: "bg-slate-900 border-b border-slate-700",
    th: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300",
    td: "px-4 py-3 text-sm text-slate-200",
    trHover: "hover:bg-slate-700/50 transition-colors",
    
    // Alerts & Badges
    alertBase: "rounded-lg p-4 border",
    alertInfo: "bg-blue-900/20 border-blue-800 text-blue-200",
    alertSuccess: "bg-green-900/20 border-green-800 text-green-200",
    alertWarning: "bg-amber-900/20 border-amber-800 text-amber-200",
    alertError: "bg-red-900/20 border-red-800 text-red-200",
    badgeBase: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
    badgePrimary: "bg-indigo-900/30 text-indigo-300",
    badgeSuccess: "bg-green-900/30 text-green-300",
    badgeWarning: "bg-amber-900/30 text-amber-300",
    badgeDanger: "bg-red-900/30 text-red-300",
    badgeNeutral: "bg-slate-700 text-slate-300",
    
    // Forms
    inputBase: 
      "block w-full rounded-lg border-slate-600 bg-slate-800 text-slate-100 shadow-sm " +
      "focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm " +
      "disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed",
    label: "block text-sm font-semibold text-slate-300 mb-1",
    helpText: "mt-1 text-xs text-slate-400",
  } as EnterpriseTheme,
};

export default enterprise;

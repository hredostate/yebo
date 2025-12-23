/**
 * Routing Module Index
 * 
 * Central export point for all routing-related functionality
 */

// Route-View Mapping
export * from './routeViewMapping';

// Section Configuration
export * from './sectionConfig';

// Navigation Hook
export { useNavigation, useViewNavigation } from '../hooks/useNavigation';

// Router Configuration
export { default as RouterConfig } from './routes';

// Feature Flags
export * from './featureFlags';

// Re-export React Router hooks for convenience
export { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';

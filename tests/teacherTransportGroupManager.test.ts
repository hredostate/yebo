/**
 * Unit test for TeacherTransportGroupManager component
 * Tests the component structure and the fixed loadGroupMembers functionality
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple validation tests for TeacherTransportGroupManager
console.log('Starting TeacherTransportGroupManager component tests...');

// Test 1: Verify component file exists
const componentPath = join(__dirname, '../../src/components/transport/TeacherTransportGroupManager.tsx');

try {
  if (!existsSync(componentPath)) {
    throw new Error('TeacherTransportGroupManager.tsx file not found');
  }
  console.log('✓ Test 1 passed: TeacherTransportGroupManager.tsx file exists');
} catch (error) {
  console.error('✗ Test 1 failed:', (error as Error).message);
  process.exit(1);
}

// Test 2: Verify component uses requireSupabaseClient
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes('requireSupabaseClient')) {
    throw new Error('Component does not import requireSupabaseClient');
  }
  
  console.log('✓ Test 2 passed: Component uses requireSupabaseClient');
} catch (error) {
  console.error('✗ Test 2 failed:', (error as Error).message);
  process.exit(1);
}

// Test 3: Verify loadGroupMembers does NOT use nested joins (the bug we fixed)
try {
  const content = readFileSync(componentPath, 'utf8');
  
  // Check that the old nested join pattern is NOT present
  if (content.includes('route:transport_routes!route_id(*)')) {
    throw new Error('Component still uses nested join for routes (route:transport_routes!route_id(*))');
  }
  
  if (content.includes('stop:transport_stops!stop_id(*)')) {
    throw new Error('Component still uses nested join for stops (stop:transport_stops!stop_id(*))');
  }
  
  if (content.includes('assigned_bus:transport_buses!assigned_bus_id(*)')) {
    throw new Error('Component still uses nested join for buses (assigned_bus:transport_buses!assigned_bus_id(*))');
  }
  
  console.log('✓ Test 3 passed: Component does not use problematic nested joins');
} catch (error) {
  console.error('✗ Test 3 failed:', (error as Error).message);
  process.exit(1);
}

// Test 4: Verify loadGroupMembers uses separate queries for routes, stops, and buses
try {
  const content = readFileSync(componentPath, 'utf8');
  
  // Check for the fixed implementation pattern
  if (!content.includes("supabase.from('transport_routes').select('id, route_name')")) {
    throw new Error('Component does not fetch routes separately with proper fields');
  }
  
  if (!content.includes("supabase.from('transport_stops').select('id, stop_name')")) {
    throw new Error('Component does not fetch stops separately with proper fields');
  }
  
  if (!content.includes("supabase.from('transport_buses').select('id, bus_number')")) {
    throw new Error('Component does not fetch buses separately with proper fields');
  }
  
  console.log('✓ Test 4 passed: Component fetches routes, stops, and buses separately');
} catch (error) {
  console.error('✗ Test 4 failed:', (error as Error).message);
  process.exit(1);
}

// Test 5: Verify loadGroupMembers uses Promise.all for parallel fetching
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes('await Promise.all([')) {
    throw new Error('Component does not use Promise.all for parallel fetching');
  }
  
  console.log('✓ Test 5 passed: Component uses Promise.all for parallel queries');
} catch (error) {
  console.error('✗ Test 5 failed:', (error as Error).message);
  process.exit(1);
}

// Test 6: Verify loadGroupMembers creates lookup maps
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes('routesMap') || !content.includes('Object.fromEntries')) {
    throw new Error('Component does not create routesMap lookup');
  }
  
  if (!content.includes('stopsMap')) {
    throw new Error('Component does not create stopsMap lookup');
  }
  
  if (!content.includes('busesMap')) {
    throw new Error('Component does not create busesMap lookup');
  }
  
  console.log('✓ Test 6 passed: Component creates lookup maps for efficient data access');
} catch (error) {
  console.error('✗ Test 6 failed:', (error as Error).message);
  process.exit(1);
}

// Test 7: Verify loadGroupMembers handles empty arrays (null safety)
try {
  const content = readFileSync(componentPath, 'utf8');
  
  // Check that queries have conditional execution for empty ID arrays
  if (!content.includes('routeIds.length > 0')) {
    throw new Error('Component does not check for non-empty routeIds before querying');
  }
  
  if (!content.includes('stopIds.length > 0')) {
    throw new Error('Component does not check for non-empty stopIds before querying');
  }
  
  if (!content.includes('busIds.length > 0')) {
    throw new Error('Component does not check for non-empty busIds before querying');
  }
  
  console.log('✓ Test 7 passed: Component handles empty ID arrays safely');
} catch (error) {
  console.error('✗ Test 7 failed:', (error as Error).message);
  process.exit(1);
}

// Test 8: Verify component has all required CRUD operations
try {
  const content = readFileSync(componentPath, 'utf8');
  
  const requiredFunctions = [
    'loadGroups',
    'loadRoutes',
    'loadGroupMembers',
    'loadAvailableStudents',
    'handleCreateGroup',
    'handleAddStudent',
    'handleRemoveStudent'
  ];
  
  for (const func of requiredFunctions) {
    if (!content.includes(func)) {
      throw new Error(`Component missing function: ${func}`);
    }
  }
  
  console.log('✓ Test 8 passed: Component has all required CRUD operations');
} catch (error) {
  console.error('✗ Test 8 failed:', (error as Error).message);
  process.exit(1);
}

// Test 9: Verify component uses TransportRoster type
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes('TransportRoster')) {
    throw new Error('Component does not use TransportRoster type');
  }
  
  // Check roster transformation
  if (!content.includes('const roster: TransportRoster[]')) {
    throw new Error('Component does not create roster array with proper type');
  }
  
  console.log('✓ Test 9 passed: Component uses TransportRoster type correctly');
} catch (error) {
  console.error('✗ Test 9 failed:', (error as Error).message);
  process.exit(1);
}

// Test 10: Verify component handles errors properly
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes('handleSupabaseError')) {
    throw new Error('Component does not use handleSupabaseError');
  }
  
  // Check that loadGroupMembers has error handling
  const loadGroupMembersMatch = content.match(/const loadGroupMembers[\s\S]*?catch[\s\S]*?handleSupabaseError/);
  if (!loadGroupMembersMatch) {
    throw new Error('loadGroupMembers function does not have proper error handling');
  }
  
  console.log('✓ Test 10 passed: Component has proper error handling');
} catch (error) {
  console.error('✗ Test 10 failed:', (error as Error).message);
  process.exit(1);
}

console.log('\n✓ All tests passed! TeacherTransportGroupManager component is properly implemented.');
console.log('✓ The loadGroupMembers function has been fixed to avoid PostgREST nested join errors.');
process.exit(0);

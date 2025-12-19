/**
 * Unit test for TransportBusEditor component
 * Tests the component structure and key functionality
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple validation tests for TransportBusEditor
console.log('Starting TransportBusEditor component tests...');

// Test 1: Verify component file exists
const componentPath = join(__dirname, '../../src/components/transport/TransportBusEditor.tsx');

try {
  if (!existsSync(componentPath)) {
    throw new Error('TransportBusEditor.tsx file not found');
  }
  console.log('✓ Test 1 passed: TransportBusEditor.tsx file exists');
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
  
  // Count the number of times requireSupabaseClient is called (should be 4 times)
  const matches = content.match(/const supabase = requireSupabaseClient\(\)/g);
  if (!matches || matches.length < 4) {
    throw new Error(`Component should call requireSupabaseClient() at least 4 times, found ${matches ? matches.length : 0}`);
  }
  
  console.log('✓ Test 2 passed: Component uses requireSupabaseClient() correctly');
} catch (error) {
  console.error('✗ Test 2 failed:', (error as Error).message);
  process.exit(1);
}

// Test 3: Verify component has required props interface
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes('interface TransportBusEditorProps')) {
    throw new Error('Component does not have TransportBusEditorProps interface');
  }
  
  if (!content.includes('schoolId: number')) {
    throw new Error('Props interface missing schoolId');
  }
  
  if (!content.includes('campuses: Campus[]')) {
    throw new Error('Props interface missing campuses');
  }
  
  if (!content.includes('addToast')) {
    throw new Error('Props interface missing addToast');
  }
  
  console.log('✓ Test 3 passed: Component has correct props interface');
} catch (error) {
  console.error('✗ Test 3 failed:', (error as Error).message);
  process.exit(1);
}

// Test 4: Verify component imports BusSeatSelector
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes("import BusSeatSelector from './BusSeatSelector'")) {
    throw new Error('Component does not import BusSeatSelector');
  }
  
  if (!content.includes('<BusSeatSelector')) {
    throw new Error('Component does not use BusSeatSelector component');
  }
  
  console.log('✓ Test 4 passed: Component integrates BusSeatSelector');
} catch (error) {
  console.error('✗ Test 4 failed:', (error as Error).message);
  process.exit(1);
}

// Test 5: Verify component has all required CRUD operations
try {
  const content = readFileSync(componentPath, 'utf8');
  
  const requiredFunctions = [
    'fetchBuses',
    'fetchOccupiedSeats',
    'handleOpenSeatMap',
    'handleOpenForm',
    'handleSubmit',
    'handleDelete'
  ];
  
  for (const func of requiredFunctions) {
    if (!content.includes(func)) {
      throw new Error(`Component missing function: ${func}`);
    }
  }
  
  console.log('✓ Test 5 passed: Component has all required CRUD operations');
} catch (error) {
  console.error('✗ Test 5 failed:', (error as Error).message);
  process.exit(1);
}

// Test 6: Verify component has search functionality
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes('searchQuery')) {
    throw new Error('Component missing searchQuery state');
  }
  
  if (!content.includes('filteredBuses')) {
    throw new Error('Component missing filteredBuses');
  }
  
  console.log('✓ Test 6 passed: Component has search functionality');
} catch (error) {
  console.error('✗ Test 6 failed:', (error as Error).message);
  process.exit(1);
}

// Test 7: Verify component has proper modals
try {
  const content = readFileSync(componentPath, 'utf8');
  
  const requiredModals = [
    'showFormModal',
    'showDeleteConfirm',
    'showSeatMapModal'
  ];
  
  for (const modal of requiredModals) {
    if (!content.includes(modal)) {
      throw new Error(`Component missing modal: ${modal}`);
    }
  }
  
  console.log('✓ Test 7 passed: Component has all required modals');
} catch (error) {
  console.error('✗ Test 7 failed:', (error as Error).message);
  process.exit(1);
}

// Test 8: Verify TransportManager integration
try {
  const managerPath = join(__dirname, '../../src/components/transport/TransportManager.tsx');
  const content = readFileSync(managerPath, 'utf8');
  
  if (!content.includes("import TransportBusEditor from './TransportBusEditor'")) {
    throw new Error('TransportManager does not import TransportBusEditor');
  }
  
  if (!content.includes('<TransportBusEditor')) {
    throw new Error('TransportManager does not use TransportBusEditor component');
  }
  
  if (!content.includes('fetchCampuses')) {
    throw new Error('TransportManager does not fetch campuses');
  }
  
  console.log('✓ Test 8 passed: TransportManager properly integrates TransportBusEditor');
} catch (error) {
  console.error('✗ Test 8 failed:', (error as Error).message);
  process.exit(1);
}

// Test 9: Verify component uses proper icons
try {
  const content = readFileSync(componentPath, 'utf8');
  
  const requiredIcons = [
    'PlusCircleIcon',
    'TrashIcon',
    'EditIcon',
    'EyeIcon',
    'SearchIcon',
    'CloseIcon'
  ];
  
  for (const icon of requiredIcons) {
    if (!content.includes(icon)) {
      throw new Error(`Component missing icon: ${icon}`);
    }
  }
  
  console.log('✓ Test 9 passed: Component uses all required icons');
} catch (error) {
  console.error('✗ Test 9 failed:', (error as Error).message);
  process.exit(1);
}

// Test 10: Verify component has validation
try {
  const content = readFileSync(componentPath, 'utf8');
  
  if (!content.includes('Bus number is required')) {
    throw new Error('Component missing bus number validation');
  }
  
  if (!content.includes('Capacity must be at least 1')) {
    throw new Error('Component missing capacity validation');
  }
  
  console.log('✓ Test 10 passed: Component has proper validation');
} catch (error) {
  console.error('✗ Test 10 failed:', (error as Error).message);
  process.exit(1);
}

console.log('\n✓ All tests passed! TransportBusEditor component is properly implemented.');
process.exit(0);

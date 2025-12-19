const madge = require('madge');

madge('src/main.tsx', {
  fileExtensions: ['ts', 'tsx'],
  tsConfigPath: './tsconfig.json',
}).then((res) => {
  const circular = res.circular();
  if (circular.length > 0) {
    console.error('❌ Circular dependencies found:');
    circular.forEach((cycle) => {
      console.error(`  ${cycle.join(' → ')}`);
    });
    process.exit(1);
  } else {
    console.log('✅ No circular dependencies found');
  }
}).catch((err) => {
  console.error('Error analyzing dependencies:', err);
  process.exit(1);
});

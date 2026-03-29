const { spawnSync } = require('child_process');

// Run drizzle-kit with stdin connected to /dev/null and let --force handle it
const result = spawnSync('npx', ['drizzle-kit', 'push', '--force'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: 120000,
  encoding: 'utf-8',
  input: '\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n'
});

console.log(result.stdout);
if (result.stderr) console.error(result.stderr);
process.exit(result.status || 0);

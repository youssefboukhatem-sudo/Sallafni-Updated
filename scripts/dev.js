// Starts the API (port 3000) and the Angular dev server (port 4200) together.
const { spawn } = require('child_process');
const isWin = process.platform === 'win32';
const run = (name, cmd, args) => {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: isWin });
  p.on('exit', (code) => { console.log(`[${name}] exited (${code})`); shutdown(); });
  return p;
};
const procs = [
  run('api', 'npm', ['--prefix', 'backend', 'start']),
  run('web', 'npm', ['start']),
];
let closing = false;
function shutdown() { if (closing) return; closing = true; procs.forEach((p) => p.kill()); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

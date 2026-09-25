import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(command, ['exec', 'ng', 'build'], {
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe']
});

let buildCompleted = false;
let forcedExitTimer;

function handleOutput(stream, destination) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    destination.write(chunk);

    if (!buildCompleted && text.includes('Output location:')) {
      buildCompleted = true;
      // Angular has already written the production bundle. Give it a moment
      // to flush files, then stop it if an open handle keeps Node alive.
      forcedExitTimer = setTimeout(() => {
        if (child.exitCode === null) {
          console.log('\nAngular bundle completed; closing lingering build process.');
          child.kill('SIGTERM');
        }
      }, 2000);
    }
  });
}

handleOutput(child.stdout, process.stdout);
handleOutput(child.stderr, process.stderr);

child.on('error', (error) => {
  console.error('Unable to start Angular build:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (forcedExitTimer) clearTimeout(forcedExitTimer);

  if (buildCompleted && signal === 'SIGTERM') {
    process.exit(0);
  }

  process.exit(code ?? (buildCompleted ? 0 : 1));
});

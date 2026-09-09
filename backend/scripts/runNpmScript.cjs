const { spawn } = require('node:child_process');

const cwd = process.argv[2];
const script = process.argv[3];
if (!cwd || !script) {
    console.error('Usage: node runNpmScript.cjs <projectDir> <script>');
    process.exit(2);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const command = script === 'test' ? `${npmCommand} run test -- --run` : `${npmCommand} run ${script}`;
const child = spawn('cmd.exe', ['/d', '/s', '/c', command], {
    cwd,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, CI: 'true' },
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
child.on('close', (code) => {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    process.exit(code ?? 1);
});
child.on('error', (error) => {
    process.stderr.write(String(error));
    process.exit(1);
});

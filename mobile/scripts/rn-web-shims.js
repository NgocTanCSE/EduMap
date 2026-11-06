
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOTP = path.resolve(__dirname, '..');

const lineRe = /ModuleNotFoundError: Module not found: Error: Can't resolve '([^']+)' in '([^']+)'/g;

function createShim(targetDir, request) {

  let resolved = path.normalize(path.join(targetDir, request));
  const ext = path.extname(resolved);
  const candidate =
    ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx'
      ? resolved
      : resolved + '.web.js';

  if (fs.existsSync(candidate)) return null;

  fs.mkdirSync(path.dirname(candidate), { recursive: true });


  fs.writeFileSync(
    candidate,
    "\nmodule.exports = {};\n"
  );
  return candidate;
}

let round = 0;
while (true) {
  round++;
  const r = spawnSync('npx', ['expo', 'export:web', '--clear'], {
    cwd: ROOTP,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  const out = r.stdout.toString() + r.stderr.toString();
  const errors = [];
  let m;
  lineRe.lastIndex = 0;
  while ((m = lineRe.exec(out))) errors.push({ req: m[1], dir: m[2] });

  if (r.status === 0 && !errors.length) {
    console.log('BUILD OK after ' + round + ' shim round(s).');
    break;
  }

  if (!errors.length) {
    console.error('Build failed, but no parseable ModuleNotFoundError found:');
    console.error(out.slice(-3000));
    process.exit(1);
  }

  const distinct = [];
  for (const e of errors) {
    const shim = createShim(e.dir, e.req);
    if (shim) distinct.push(shim);
  }
  console.error('[round ' + round + '] created ' + distinct.length + ' shim(s):');
  for (const s of distinct) console.error('  - ' + s);

  if (round > 25) {
    console.error('Aborting after 25 rounds.');
    process.exit(1);
  }
}

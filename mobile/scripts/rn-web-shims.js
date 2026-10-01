/**
 * Self-healing web shim discoverer for react-native@0.73.2 + expo export:web.
 *
 * RN 0.73.2 ships several internal modules WITHOUT a `.web.js` variant that
 * `ReactNativePrivateInterface` / `StyleSheet` / etc. require on web. This
 * script runs `expo export:web` repeatedly; each time webpack reports a
 * `ModuleNotFoundError: Can't resolve 'X' in 'Y'`, it writes a tiny no-op
 * `X.web.js` into the resolved location and retries.
 *
 * It prints the full list of shims created so the Dockerfile can bake them
 * deterministically.
 *
 * Usage: node scripts/rn-web-shims.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOTP = path.resolve(__dirname, '..');

const lineRe = /ModuleNotFoundError: Module not found: Error: Can't resolve '([^']+)' in '([^']+)'/g;

function createShim(targetDir, request) {
  // Resolve the request relative to the dir that failed to resolve it (handles ../).
  let resolved = path.normalize(path.join(targetDir, request));
  const ext = path.extname(resolved);
  const candidate =
    ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx'
      ? resolved
      : resolved + '.web.js';

  if (fs.existsSync(candidate)) return null;

  fs.mkdirSync(path.dirname(candidate), { recursive: true });
  // Generic no-op web shim (object). react-native-web overrides these modules;
  // the stub only exists so the static resolver is satisfied on web exports.
  fs.writeFileSync(
    candidate,
    "/** Auto-generated web no-op shim for RN 0.73.2 web export (scripts/rn-web-shims.js). */\nmodule.exports = {};\n"
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

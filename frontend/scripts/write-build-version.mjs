/** Write deploy id so clients auto-reload once after a new Vercel/Netlify deploy. */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });

const build =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_REF ||
  process.env.DEPLOY_ID ||
  `build-${Date.now()}`;

writeFileSync(
  join(outDir, 'version.json'),
  JSON.stringify({ build, builtAt: new Date().toISOString() }),
);
console.log('[write-build-version]', build.slice(0, 12));

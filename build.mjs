import {readdirSync, readFileSync, statSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Assets are served directly; the build validates the deployable source in place.
const root = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(root);
let checked = 0;
const errors = [];
for (const file of files.filter(name => /\.(js|mjs)$/.test(name))) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], {encoding: 'utf8'});
  if (result.status !== 0) errors.push(result.stderr || `Could not check ${file}`);
  checked++;
}
for (const file of files.filter(name => /\.(html|css)$/.test(name))) {
  const content = readFileSync(resolve(root, file), 'utf8');
  const references = file.endsWith('.html')
    ? [...content.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(match => match[1])
    : [...content.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;
    const path = reference.split(/[?#]/)[0] === '/' ? 'index.html' : reference.split(/[?#]/)[0];
    if (!path) continue;
    const target = path.startsWith('/') ? resolve(root, path.slice(1)) : resolve(dirname(resolve(root, file)), path);
    try {
      if (!statSync(target).isFile()) throw new Error('Not a file');
    } catch {
      errors.push(`${file}: missing asset ${reference}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Build passed: ${checked} JavaScript files and all local HTML/CSS asset references validated.`);

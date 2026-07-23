import console from 'node:console';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const outputRoot = '.output/chrome-mv3';
const contentPath = join(outputRoot, 'content-scripts/content.js');
const maxContentBytes = 400 * 1024;

const manifest = JSON.parse(await readFile(join(outputRoot, 'manifest.json'), 'utf8'));
const content = await readFile(contentPath, 'utf8');
const contentBytes = (await stat(contentPath)).size;
const failures = [];

if (contentBytes > maxContentBytes) {
  failures.push(`content.js is ${contentBytes} bytes; limit is ${maxContentBytes}`);
}
if (content.includes('MathJax SVG renderer initialized')) {
  failures.push('MathJax renderer code leaked into content.js');
}
if (manifest.permissions?.includes('tabs')) {
  failures.push('manifest still requests the tabs permission');
}
const accessibleResources = manifest.web_accessible_resources?.flatMap(
  (entry) => entry.resources ?? [],
);
if (!accessibleResources?.includes('formula-renderer.html')) {
  failures.push('formula-renderer.html is not web accessible');
}

const chunkNames = await readdir(join(outputRoot, 'chunks'));
const chunkContents = await Promise.all(
  chunkNames
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFile(join(outputRoot, 'chunks', name), 'utf8')),
);
if (!chunkContents.some((chunk) => chunk.includes('MathJax SVG renderer initialized'))) {
  failures.push('MathJax renderer code is missing from lazy extension chunks');
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[verify-build] ${failure}`);
  process.exitCode = 1;
} else {
  console.info(`[verify-build] content.js: ${contentBytes} bytes (limit ${maxContentBytes})`);
  console.info('[verify-build] MathJax is isolated from the content script');
  console.info('[verify-build] manifest permissions and renderer resources are valid');
}

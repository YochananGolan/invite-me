import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal = readFileSync(new URL('../components/Modal.js', import.meta.url), 'utf8');
const drawer = readFileSync(new URL('../components/Drawer.js', import.meta.url), 'utf8');

for (const [name, source] of [
  ['Modal', modal],
  ['Drawer', drawer],
]) {
  assert.match(
    source,
    /hidden sm:block pointer-events-none absolute -top-32 -right-24/,
    `${name} top glow should be hidden on mobile to avoid clipped square artifacts around titles`
  );

  assert.match(
    source,
    /hidden sm:block pointer-events-none absolute -bottom-32 -left-24/,
    `${name} bottom glow should be hidden on mobile to avoid clipped square artifacts`
  );

  assert.match(
    source,
    /relative z-10 flex items-start justify-between/,
    `${name} header content should sit above decorative effects`
  );
}

console.log('mobile modal glow artifact contract passed');

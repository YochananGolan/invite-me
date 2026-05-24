import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../components/StepButtons.js', import.meta.url), 'utf8');

function expectSource(pattern, message) {
  assert.ok(pattern.test(source), message);
}

function rejectSource(pattern, message) {
  assert.ok(!pattern.test(source), message);
}

expectSource(/STEP_BAR_SETTLE_DELAY_MS\s*=\s*\d+/, 'step bar defines a short fixed-start delay before settling');

expectSource(/STEP_BAR_SETTLE_DURATION_MS\s*=\s*\d+/, 'step bar defines an explicit fast transition duration');

expectSource(/stepBarPhase/, 'step bar uses a phase state instead of rendering immediately settled');

expectSource(/fixed inset-x-0 bottom-0/, 'step bar has an initial fixed viewport-bottom state');

expectSource(/absolute inset-x-0 bottom-0/, 'step bar has a settled absolute state');

expectSource(
  /translate3d\(\$\{deltaX\}px, \$\{deltaY\}px, 0\)/,
  'step bar animates from the fixed rect to the absolute anchor rect'
);

rejectSource(/className="sticky bottom-0/, 'step bar should no longer be sticky-only');

console.log('step bar transition contract passed');

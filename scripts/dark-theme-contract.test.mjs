import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const files = [
  'components/StepButtons.js',
  'pages/archive-past.js',
  'pages/check-past.js',
  'pages/debug-event.js',
  'styles/globals.css',
];

const forbiddenByFile = {
  'components/StepButtons.js': [
    /\bbg-(green|blue|yellow|purple|orange|red)-50\b/,
    /\bbg-amber-50\b/,
    /\bbg-(green|yellow|orange|red)-100\b/,
    /\bbg-orange-200\b/,
    /\bbg-\[#FCE6AC\]/,
    /\bbg-\[#FFF9E8\]/,
    /\bfrom-\[#FCE6AC\]\b/,
    /\bto-\[#FFF9E8\]\b/,
    /\btext-black\b/,
    /\btext-\[#FCE6AC\]/,
    /\btext-amber-900\b/,
    /\btext-(green|blue|yellow|orange|purple|red)-(600|700|800|900)\b/,
    /\bborder-amber-500\b/,
    /\bborder-(green|blue|yellow|orange|red)-(200|300|500|600|700|900)\b/,
    /\bring-offset-\[#FCE6AC\]\b/,
    /guestErrorMsg && <p className="text-red-400 text-lg text-center mb-2">/,
    /searchError && <p className="text-center text-red-400 mb-4 text-sm">/,
  ],
  'pages/archive-past.js': [
    /\btext-(green|red)-(600|700|800|900)\b/,
    /<main className="p-6/,
  ],
  'pages/check-past.js': [
    /\bbg-gray-100\b/,
    /\btext-red-600\b/,
    /<main className="p-6/,
  ],
  'pages/debug-event.js': [
    /\bbg-gray-100\b/,
    /\btext-red-600\b/,
    /<main className="p-6/,
  ],
  'styles/globals.css': [
    /#FFF9E8/i,
    /#FFEEC0/i,
    /#f3f4f6/i,
  ],
};

for (const file of files) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const pattern of forbiddenByFile[file]) {
    assert.ok(!pattern.test(source), `${file} still contains light-theme token ${pattern}`);
  }
}

for (const page of ['pages/archive-past.js', 'pages/check-past.js', 'pages/debug-event.js']) {
  const source = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  assert.match(
    source,
    /bg-\[linear-gradient\(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%\)\]/,
    `${page} should use the app dark page background`
  );
  assert.match(source, /bg-white\/\[0\.055\]/, `${page} should use a glass content surface`);
}

console.log('dark theme contract passed');

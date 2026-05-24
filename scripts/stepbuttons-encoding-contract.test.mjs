import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stepButtonsPath = path.join(root, 'components', 'StepButtons.js');
const source = fs.readFileSync(stepButtonsPath, 'utf8');

const mojibakePatterns = [
  { label: 'C1 control characters from decoded UTF-8 bytes', pattern: /[\u0080-\u009f]/ },
  { label: 'Hebrew UTF-8 decoded as Windows-1255', pattern: /\u05f3[\u2013\u00d7\u2022\u00a0\u201d]/ },
  { label: 'en dash/emoji/currency mojibake lead sequence', pattern: /\u05d2[\u20ac\u201c\u02dc\u009c\u009d\u0080-\u009f]/ },
  { label: 'emoji mojibake lead sequence', pattern: /\u05e0\u009f/ },
];

const requiredHebrewText = [
  '\u05d7\u05ea\u05d5\u05e0\u05d4',
  '\u05e9\u05dd \u05d4\u05d7\u05ea\u05df',
  '\u05d1\u05d7\u05e8 \u05de\u05e1\u05dc\u05d5\u05dc',
  '\u05e9\u05d2\u05d9\u05d0\u05d4',
  '\u05d4\u05d4\u05d6\u05de\u05e0\u05d4 \u05e0\u05e9\u05dc\u05d7\u05ea \u05db\u05e2\u05ea',
  '\u20aa',
];

const failures = [];

for (const { label, pattern } of mojibakePatterns) {
  if (pattern.test(source)) {
    failures.push(`Found ${label}`);
  }
}

for (const text of requiredHebrewText) {
  if (!source.includes(text)) {
    failures.push(`Missing expected Hebrew/UI token: ${text}`);
  }
}

if (failures.length) {
  console.error(`StepButtons encoding contract failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('StepButtons encoding contract passed');

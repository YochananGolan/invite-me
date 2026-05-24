import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/HeroSection.js', import.meta.url), 'utf8');

assert.match(
  source,
  /const HeroStatsDonut = \(\) => \(/,
  'Hero stats preview should isolate the donut in a dedicated component'
);

assert.match(
  source,
  /<svg className="h-16 w-16 shrink-0 overflow-visible"/,
  'Hero stats donut should use a bounded responsive SVG size'
);

assert.match(
  source,
  /<span className="text-\[12px\] font-black leading-none tabular-nums">326<\/span>/,
  'Hero stats donut center number should be compact and tabular'
);

assert.match(
  source,
  /<span className="mt-0\.5 text-center text-\[7px\] leading-\[0\.7rem\] text-slate-400">/,
  'Hero stats donut center caption should be compact'
);

assert.match(
  source,
  /<div className="grid grid-cols-\[minmax\(0,1fr\)_4rem\] items-center gap-2 px-3 py-3">/,
  'Hero stats card should reserve a fixed donut column instead of flex crowding'
);

assert.match(
  source,
  /<span className="shrink-0 text-left font-bold tabular-nums text-slate-100">/,
  'Hero stats legend values should be non-wrapping tabular values'
);

assert.ok(
  !source.includes('<svg width="68" height="68"'),
  'Hero stats preview should not use the old oversized fixed SVG donut'
);

assert.ok(
  !source.includes('text-base font-black">326'),
  'Hero stats preview should not use the old large center number'
);

console.log('hero stats preview containment contract passed');

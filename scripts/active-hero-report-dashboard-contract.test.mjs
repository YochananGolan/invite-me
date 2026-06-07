import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/HeroSection.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../pages/index.js', import.meta.url), 'utf8');

assert.match(
  source,
  /import \{ supabase \} from '\.\.\/lib\/supabaseClient';/,
  'HeroSection should fetch the active event report summary from Supabase'
);

assert.match(
  source,
  /const ActiveEventReportsDashboard = \(\{ summary \}\) => \(/,
  'HeroSection should isolate the active-event report dashboard in its own component'
);

for (const label of [
  'דוחות בקרה מרכזיים',
  'סה"כ אורחים',
  'מבוגרים',
  'ילדים',
  'סטטוס אישורי הגעה',
  'מגיעים',
  'לא מגיעים',
  'טרם השיבו',
  'יתרת הזמנות לשליחה',
]) {
  assert.ok(source.includes(label), `Active-event dashboard is missing Hebrew label: ${label}`);
}

assert.match(
  source,
  /const shouldShowActiveReports = Boolean\(activeReportSummary && activeReportSummary\.hasReportData\);/,
  'HeroSection should only replace the marketing preview when report data exists'
);

assert.match(
  source,
  /lg:order-1/,
  'The active report dashboard should sit on the left side of the desktop hero layout'
);

assert.match(
  source,
  /<ProductCards \/>/,
  'The existing marketing preview should remain available as the fallback state'
);

assert.match(
  indexSource,
  /session=\{session\}/,
  'Home should pass the auth session to HeroSection so the dashboard can load user event data'
);

console.log('active hero report dashboard contract passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/StepButtons.js', import.meta.url), 'utf8');

assert.match(
  source,
  /const getContainedStatusSliceLabelProps = \(/,
  'status donut labels need a helper that constrains center labels inside the donut hole'
);

const statusLabelBlock = source.match(/const renderStatusSliceLabel = React\.useCallback\([\s\S]*?\}, \[statusChartData, statusTotal\]\);/)?.[0] || '';

assert.match(
  statusLabelBlock,
  /\{\.\.\.getContainedStatusSliceLabelProps\(numericValue, innerRadius, isOnlySlice\)\}/,
  'status donut label renderer should use constrained text props'
);

assert.match(
  statusLabelBlock,
  /fontSize=\{isOnlySlice \? 14 : 13\}/,
  'status donut labels should use compact font sizes'
);

assert.match(
  source,
  /innerRadius=\{isMobileView \? 46 : 58\}/,
  'status donut should leave a predictable inner hole on mobile and desktop'
);

assert.match(
  source,
  /outerRadius=\{isMobileView \? 78 : 88\}/,
  'status donut should stay inside its preview card'
);

assert.match(
  source,
  /<PieChart margin=\{\{ top: 8, right: 8, bottom: 8, left: 8 \}\}>/,
  'status donut needs chart margins so labels do not touch the frame'
);

assert.match(
  source,
  /wrapperStyle=\{\{\s*maxWidth: isMobileView \? '100%' : 112,/,
  'status donut legend should have a width cap so it cannot crowd the donut'
);

console.log('status donut containment contract passed');

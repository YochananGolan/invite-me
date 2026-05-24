import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/StepButtons.js', import.meta.url), 'utf8');

assert.match(
  source,
  /const previewMetricValueClass = ['"`][^'"`]*max-w-full[^'"`]*min-w-0[^'"`]*break-all[^'"`]*tabular-nums[^'"`]*['"`]/,
  'preview metric values need shared containment classes'
);

assert.match(
  source,
  /const getContainedChartNumberProps = \(/,
  'chart labels need a helper that constrains long numeric labels to their bar width'
);

const guestSummaryLabelBlock = source.match(/const renderGuestSummaryLabel = React\.useCallback\([\s\S]*?\}, \[guestSummaryChartData\]\);/)?.[0] || '';
assert.match(
  guestSummaryLabelBlock,
  /\{\.\.\.getContainedChartNumberProps\(value, width\)\}/,
  'guest summary bar labels need width-constrained SVG text props'
);

const capacityLabelBlock = source.match(/const renderCapacityLabel = React\.useCallback\([\s\S]*?\[messageCapacityChartModel\],\s*\);/)?.[0] || '';
assert.match(
  capacityLabelBlock,
  /\{\.\.\.getContainedChartNumberProps\(value, width\)\}/,
  'capacity bar labels need width-constrained SVG text props'
);

for (const token of [
  '{guestSummary.adults}',
  '{guestSummary.children}',
  '{guestSummary.adults + guestSummary.children}',
  '{guestStatusSummary.approved}',
  '{guestStatusSummary.pending}',
  '{guestStatusSummary.rejected}',
  '{messageCapacityChartModel.messageLimit}',
  '{messageCapacityChartModel.messagesSent}',
]) {
  const tokenIndex = source.indexOf(token);
  assert.notEqual(tokenIndex, -1, `Missing preview metric token ${token}`);
  const precedingClass = source.slice(Math.max(0, tokenIndex - 220), tokenIndex);
  assert.match(
    precedingClass,
    /previewMetricValueClass/,
    `Preview metric ${token} should use the shared contained value class`
  );
}

console.log('preview metric containment contract passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/TranzilaPayment.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8');

assert.match(
  source,
  /const isTrustedTranzilaOrigin =/,
  'Payment modal should still identify Tranzila origins for diagnostics'
);

assert.match(
  source,
  /if \(isOwnOrigin && parsedSuccess\)/,
  'String success messages should only be final when they come from our callback pages'
);

assert.match(
  source,
  /if \(isOwnOrigin && !parsedSuccess && parsedFailure\)/,
  'String failure messages should not let Tranzila intermediate Google Pay messages fail the payment'
);

assert.match(
  source,
  /if \(isSuccess && isOwnOrigin\)/,
  'Object success messages should only close the modal from our same-origin success callback'
);

assert.match(
  source,
  /if \(isOwnOrigin && !isSuccess && hasFailureSignal\)/,
  'Object failure messages should only open failure UI from our same-origin failure callback'
);

assert.ok(
  !source.includes('if (isTrustedOrigin && parsedSuccess)'),
  'Parsed success should not accept direct Tranzila intermediate messages'
);

assert.ok(
  !source.includes('if (isTrustedOrigin && !parsedSuccess && parsedFailure)'),
  'Parsed failure should not accept direct Tranzila intermediate messages'
);

assert.ok(
  !source.includes('if (isSuccess && isTrustedOrigin)'),
  'Object success should not accept direct Tranzila intermediate messages'
);

assert.ok(
  !source.includes('if (isTrustedOrigin && !isSuccess && hasFailureSignal)'),
  'Object failure should not accept direct Tranzila intermediate messages'
);

assert.match(
  source,
  /sm:h-\[clamp\(520px,62vh,640px\)\]/,
  'Desktop iframe should use viewport-aware height instead of a rigid 600px block'
);

assert.match(
  source,
  /overflow-y-auto/,
  'Payment modal body should scroll internally instead of clipping Tranzila or Google Pay content'
);

assert.match(
  css,
  /body\.payment-modal-open\s*\{[\s\S]*?overflow:\s*hidden/,
  'Opening the payment modal should lock background scrolling'
);

console.log('payment modal Google Pay contract passed');

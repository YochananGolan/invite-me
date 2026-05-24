import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stepButtons = readFileSync(new URL('../components/StepButtons.js', import.meta.url), 'utf8');
const guestPage = readFileSync(new URL('../pages/[eventId]/[guestId].js', import.meta.url), 'utf8');

assert.match(
  stepButtons,
  /const invitationPreviewLineContainmentStyle = \{/,
  'StepButtons should define shared invitation preview line containment styles'
);

for (const token of ['width: \'100%\'', 'maxWidth: \'88%\'', 'boxSizing: \'border-box\'', 'overflowWrap: \'anywhere\'']) {
  assert.ok(
    stepButtons.includes(token),
    `StepButtons line containment style should include ${token}`
  );
}

assert.ok(
  !stepButtons.includes('relative pt-[100%]'),
  'template previews should not use a square frame for vertical invitations'
);

assert.match(
  stepButtons,
  /className="relative aspect-\[4\/5\] w-full/,
  'template previews should use a 4:5 invitation aspect frame'
);

assert.match(
  stepButtons,
  /style=\{\{ width: 'min\(100%, 520px, calc\(\(92vh - 170px\) \* 0\.8\)\)' \}\}/,
  'lightbox preview should constrain its frame to the visible modal height'
);

const lineContainmentUses = (stepButtons.match(/\.\.\.invitationPreviewLineContainmentStyle/g) || []).length;
assert.ok(lineContainmentUses >= 2, 'StepButtons preview lines should use shared containment in thumbnail and lightbox previews');

assert.match(
  guestPage,
  /className="absolute inset-0 flex flex-col justify-center items-center p-6 pointer-events-none z-20"/,
  'guest page text overlay should live inside the invitation image frame'
);

assert.match(
  guestPage,
  /maxWidth: '88%'/,
  'guest page invitation lines should be constrained inside the image frame'
);

console.log('invitation preview containment contract passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/StepButtons.js', import.meta.url), 'utf8');

const requiredPatterns = [
  [
    'event details banner must be gated by the save action',
    /eventDetailsSubmitAttempted && errorMsg &&/,
  ],
  [
    'guest invitation banner must be gated by a send action',
    /guestSubmitAttempted && guestErrorMsg &&/,
  ],
  [
    'RSVP count banner must be gated by the count confirmation action',
    /countSubmitAttempted && countError &&/,
  ],
  [
    'guest search banner must be gated by the search action',
    /guestSearchAttempted && searchError &&/,
  ],
  [
    'pricing error banner must be gated by a pricing action',
    /pricingActionAttempted && planSelectionError &&/,
  ],
  [
    'event detail fields should use only visible attempted errors',
    /const visibleFormErrors = eventDetailsSubmitAttempted \? formErrors : \{\};/,
  ],
  [
    'guest fields should use only visible attempted errors',
    /const visibleGuestErrors = guestSubmitAttempted \? guestErrors : \{\};/,
  ],
];

for (const [label, pattern] of requiredPatterns) {
  assert.match(source, pattern, label);
}

for (const rawPattern of [
  /\{errorMsg && <p/,
  /\{guestErrorMsg && <p/,
  /\{countError && \(/,
  /\{searchError && <p/,
  /\{planSelectionError && \(/,
  /formErrors\.[a-zA-Z]/,
  /guestErrors\.[a-zA-Z]/,
]) {
  assert.ok(!rawPattern.test(source), `validation UI should not render raw error state: ${rawPattern}`);
}

for (const [label, pattern] of [
  ['saving event details marks the action attempted', /const handleSaveDetails = async \(\) => \{[\s\S]*?setEventDetailsSubmitAttempted\(true\);/],
  ['WhatsApp guest send marks the action attempted', /const handleSendInvitation = async \(\) => \{[\s\S]*?setGuestSubmitAttempted\(true\);/],
  ['SMS guest send marks the action attempted', /const handleSendInvitationSms = async \(\) => \{[\s\S]*?setGuestSubmitAttempted\(true\);/],
  ['guest search marks the action attempted', /const handleGuestSearch = async \(\) => \{[\s\S]*?setGuestSearchAttempted\(true\);/],
  ['count confirmation marks the action attempted', /const totalSpecialAdults = Object\.values\(specialMeals\)[\s\S]*?setCountSubmitAttempted\(true\);/],
]) {
  assert.match(source, pattern, label);
}

console.log('error message action gating contract passed');

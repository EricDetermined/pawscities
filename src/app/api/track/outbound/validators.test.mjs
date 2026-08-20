/**
 * Validator tests for the outbound-click endpoint.
 *
 * This endpoint is the one place in the app where an anonymous, unauthenticated
 * party writes to the database, so its input handling is worth pinning down.
 *
 * The uuid cases exist because the obvious implementation was wrong and this
 * test is what caught it: trimming to 36 characters BEFORE validating turns
 * 'a'.repeat(40) into 36 a's, and since 'a' is a hex digit, a loose
 * /^[0-9a-f-]{36}$/ accepted it. The value then reached Postgres as a malformed
 * UUID and the insert failed silently, losing the click.
 *
 * Run:  node src/app/api/track/outbound/validators.test.mjs
 */

const LINK_TYPES = new Set(['tickets', 'instagram', 'maps']);
const EVENT_STATES = new Set(['live', 'cancelled', 'past']);

// Kept in sync with route.ts by hand — if you change one, change both.
const str = (v, max) => {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
};
const slug = (v, max = 200) => {
  const s = str(v, max);
  return s && /^[a-z0-9][a-z0-9-]*$/i.test(s) ? s : null;
};
const uuid = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
};
const host = (v) => {
  const s = str(v, 253);
  return s && /^[a-z0-9.-]+$/i.test(s) ? s.toLowerCase() : null;
};

const CASES = [
  // slug — our own format; anything else is probing
  ['slug: normal', slug, 'ekka-royal-queensland-show-2026', 'ekka-royal-queensland-show-2026'],
  ['slug: sql injection', slug, "a'; DROP TABLE events;--", null],
  ['slug: path traversal', slug, '../../etc/passwd', null],
  ['slug: xss', slug, '<script>alert(1)</script>', null],
  ['slug: whitespace', slug, 'my event', null],
  ['slug: leading dash', slug, '-evil', null],
  ['slug: unicode', slug, 'événement', null],
  ['slug: type confusion', slug, 12345, null],
  ['slug: null', slug, null, null],
  ['slug: oversize truncates safely', slug, 'a'.repeat(500), 'a'.repeat(200)],

  // uuid — must enforce STRUCTURE, and must reject rather than truncate
  ['uuid: valid', uuid, 'a65ab3f8-0b08-4b5e-91cf-c3095ce2b43e', 'a65ab3f8-0b08-4b5e-91cf-c3095ce2b43e'],
  ['uuid: uppercase', uuid, 'A65AB3F8-0B08-4B5E-91CF-C3095CE2B43E', 'A65AB3F8-0B08-4B5E-91CF-C3095CE2B43E'],
  ['uuid: 40 hex chars (the regression)', uuid, 'a'.repeat(40), null],
  ['uuid: 36 chars, no structure', uuid, 'a'.repeat(36), null],
  ['uuid: sql injection', uuid, "' OR 1=1--", null],
  ['uuid: wrong group sizes', uuid, 'a65ab3f8-0b08-4b5e-91cf-c3095ce2b43', null],
  ['uuid: non-hex letter', uuid, 'z65ab3f8-0b08-4b5e-91cf-c3095ce2b43e', null],
  ['uuid: type confusion', uuid, 12345, null],

  // host — hostname only, never a URL
  ['host: normal', host, 'www.eventbrite.com', 'www.eventbrite.com'],
  ['host: lowercased', host, 'EventBrite.COM', 'eventbrite.com'],
  ['host: with path', host, 'evil.com/steal?x=1', null],
  ['host: with credentials', host, 'user:pass@evil.com', null],
  ['host: with port', host, 'evil.com:8080', null],
];

let failures = 0;
for (const [name, fn, input, expected] of CASES) {
  const got = fn(input);
  if (got !== expected) {
    failures++;
    console.log(`  FAIL ${name}\n       got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
}

// Closed allowlists — anything outside them must not reach the database.
for (const [value, set, shouldPass, label] of [
  ['tickets', LINK_TYPES, true, 'link_type accepts tickets'],
  ['maps', LINK_TYPES, true, 'link_type accepts maps'],
  ['DROP TABLE', LINK_TYPES, false, 'link_type rejects injection'],
  ['', LINK_TYPES, false, 'link_type rejects empty'],
  ['cancelled', EVENT_STATES, true, 'event_state accepts cancelled'],
  ['../', EVENT_STATES, false, 'event_state rejects traversal'],
]) {
  if (set.has(value) !== shouldPass) {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

if (failures) {
  console.log(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log(`All ${CASES.length + 6} validator cases pass.`);

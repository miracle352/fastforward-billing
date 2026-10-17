/**
 * Recorded evidence used for the explanatory parts of the page.
 *
 * Every value here is copied from the public, redacted receipts committed by the backend:
 *   docs/evidence/2026-10-17-live-repair.json        (run 20:35:06 → 20:36:53 UTC, 17 Oct 2026)
 *   docs/evidence/2026-10-17-browser-integration.json (browser-started run 20:58:52 → 21:00:52 UTC)
 * and from the public sample source fixtures/sample-app/billing.py.
 * Nothing here is shown as the visitor's own run; the live test section reads only the API.
 */

export const RECORDED_ON = '17 October 2026';
export const RECEIPT = 'docs/evidence/2026-10-17-live-repair.json';
export const BROWSER_RECEIPT = 'docs/evidence/2026-10-17-browser-integration.json';

export type Situation = 'leo-fails' | 'maya-renews' | 'stranger' | 'cross';
export type Version = 'original' | 'repaired';

type Side = {
  /** What the app returned to the real HTTP request. */
  http: string;
  access: 'opened' | 'refused';
  verdict: 'agree' | 'mismatch';
  message: string; // the evaluator's recorded message
};

export type Recorded = {
  id: Situation;
  /** The sentence that becomes the section's headline. */
  line: string;
  short: string;
  who: string;
  request: string;
  stripe: { status: string; detail: string } | null;
  policy: string;
  versions: Record<Version, Side>;
};

export const SITUATIONS: Recorded[] = [
  {
    id: 'leo-fails',
    line: 'Leo’s trial payment fails.',
    short: 'Leo’s payment fails',
    who: 'Leo · trial customer',
    request: 'GET /report as Leo',
    stripe: { status: 'Past due', detail: 'Invoice open · $19.00 due · $0.00 paid' },
    policy: 'Past due is not active or trialing, so the report must stay closed.',
    versions: {
      original: { http: '200 OK', access: 'opened', verdict: 'mismatch', message: 'Expected access denied (403); observed HTTP 200.' },
      repaired: { http: '403 Forbidden', access: 'refused', verdict: 'agree', message: 'Customer without an eligible subscription was denied.' },
    },
  },
  {
    id: 'maya-renews',
    line: 'Maya’s subscription renews.',
    short: 'Maya renews',
    who: 'Maya · paying customer',
    request: 'GET /report as Maya',
    stripe: { status: 'Active', detail: 'Invoice paid · $19.00 paid' },
    policy: 'Active may open the report. A fix that blocks Maya is a failure.',
    versions: {
      original: { http: '200 OK', access: 'opened', verdict: 'agree', message: 'Authenticated customer received only their private report.' },
      repaired: { http: '200 OK', access: 'opened', verdict: 'agree', message: 'Authenticated customer received only their private report.' },
    },
  },
  {
    id: 'stranger',
    line: 'A stranger asks for a report.',
    short: 'A stranger asks',
    who: 'No signed-in customer',
    request: 'GET /report, no identity',
    stripe: null,
    policy: 'Nobody signed in, nothing to open.',
    versions: {
      original: { http: '401 Unauthorized', access: 'refused', verdict: 'agree', message: 'Request correctly denied with HTTP 401.' },
      repaired: { http: '401 Unauthorized', access: 'refused', verdict: 'agree', message: 'Request correctly denied with HTTP 401.' },
    },
  },
  {
    id: 'cross',
    line: 'Maya asks for Leo’s report.',
    short: 'Maya asks for Leo’s',
    who: 'Maya, signed in',
    request: 'GET /report?customer=Leo as Maya',
    stripe: null,
    policy: 'A customer may only ever see their own report.',
    versions: {
      original: { http: '403 Forbidden', access: 'refused', verdict: 'agree', message: 'Request correctly denied with HTTP 403.' },
      repaired: { http: '403 Forbidden', access: 'refused', verdict: 'agree', message: 'Request correctly denied with HTTP 403.' },
    },
  },
];

/** Stage durations from the event timestamps of the recorded run (seconds). */
export const STAGES_RECORDED = [
  { id: 'setup', seconds: 3.8, said: 'Four seconds', text: 'A sandbox starts the sample app. Stripe creates test customers on test clocks.' },
  { id: 'check', seconds: 52.5, said: 'Fifty-two seconds', text: 'Each clock jumps past renewal. The report is requested and the answer compared with Stripe.' },
  { id: 'repair', seconds: 2.9, said: 'Three seconds', text: 'A model writes a new billing handler. CreateOS validates and compiles it.' },
  { id: 'verify', seconds: 48.4, said: 'Forty-eight seconds', text: 'Brand-new test customers go through the same events. Then everything is cleaned up.' },
] as const;

export const TOTAL_RECORDED = '1 minute 47 seconds';

/** The sample app's real handler (public fixture). Line 6 is the defect. */
export const ORIGINAL_SOURCE = [
  'def handle_event(event, db, stripe_get):',
  '    # Acknowledges updates but never applies them to access.',
  '    if event.get("type") != "customer.subscription.created":',
  '        return',
  '    subscription = event["data"]["object"]',
  '    customer = subscription["customer"]',
  '    access = int(subscription.get("status") in ("active", "trialing"))',
  '    db.execute("INSERT INTO access … ON CONFLICT …", (customer, …, access))',
];
export const DEFECT_LINES = [2, 3];

/** The model's own recorded explanation of its first repair (live-repair receipt, model event). */
export const REPAIR_EXPLANATION =
  'Added handling for created, updated, and deleted events, extracted customer and subscription IDs safely, fetched authoritative subscription via stripe_get, set allowed only for active/trialing statuses, and performed upsert. Ignored other event types and handled fetch errors without DB changes.';

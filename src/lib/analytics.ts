/**
 * GA4 event tracking.
 *
 * WHY THIS EXISTS
 * ---------------
 * GA4 has been installed since launch but only ever called gtag('config'),
 * which fires page_view and nothing else. So GA4 could report that 62% of
 * traffic is organic search, but not whether any of it ever converted — the
 * "0 key events configured" warning in the GA4 UI was accurate, and there was
 * nothing to configure because the site fired no custom events at all.
 *
 * Marking a key event in the GA4 UI only works once the event has actually
 * been SEEN by GA4 — the picker lists observed event names, not hypothetical
 * ones. So the code has to ship and fire first, then the UI step becomes
 * possible. That ordering is why this file precedes the dashboard work.
 *
 * SSR SAFETY
 * ----------
 * Next.js renders components on the server where `window` does not exist.
 * Every call is guarded; on the server it is a no-op rather than a crash.
 */

/** Event names we deliberately track. Keeping them in one union stops the
 *  drift where the same conversion gets logged under three spellings and
 *  splits its own reporting. */
export type AnalyticsEvent =
  | 'newsletter_signup'        // NEW subscriber only — see note in trackSignup
  | 'newsletter_duplicate'     // already on the list; interest, not conversion
  | 'event_external_click'     // clicked through to the organiser's own page
  | 'business_claim_start'
  | 'business_claim_submit';

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      targetOrName: string | Date,
      params?: EventParams
    ) => void;
  }
}

/**
 * Send an event to GA4. Silent no-op if gtag has not loaded (ad blockers,
 * consent tooling, SSR, or the measurement ID being unset in preview builds).
 * Analytics must never be able to break a user-facing flow.
 */
export function trackEvent(name: AnalyticsEvent, params: EventParams = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    // Strip undefined so GA4 doesn't record the literal string "undefined",
    // which is indistinguishable from a real value once it's in a report.
    const clean: EventParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') clean[k] = v;
    }
    window.gtag('event', name, clean);
  } catch {
    // Never let a reporting failure surface to the user.
  }
}

/**
 * Newsletter signup.
 *
 * `alreadySubscribed` is deliberately routed to a DIFFERENT event. A repeat
 * submission is a real signal — someone wanted in again — but counting it as a
 * conversion would inflate the number we are about to start optimising
 * against, and it would never reconcile with the subscribers table. With only
 * 5 subscribers today, a handful of duplicates would visibly distort the rate.
 */
export function trackSignup(opts: {
  alreadySubscribed?: boolean;
  source?: string;
  citySlug?: string;
}): void {
  trackEvent(
    opts.alreadySubscribed ? 'newsletter_duplicate' : 'newsletter_signup',
    { source: opts.source, city: opts.citySlug }
  );
}

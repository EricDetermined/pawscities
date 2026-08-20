'use client';

/**
 * An outbound link that records the click before the visitor leaves.
 *
 * WHY A COMPONENT AND NOT AN onClick ON EACH <a>
 * ----------------------------------------------
 * The event page is a server component, so it cannot attach handlers. Wrapping
 * the link once keeps the three outbound destinations (tickets, Instagram,
 * maps) firing an identical, correctly-shaped payload instead of three
 * hand-rolled handlers that drift apart.
 *
 * WHY sendBeacon
 * --------------
 * These links open a new tab, so a normal fetch would usually survive — but
 * "usually" is not good enough for the one metric that says whether the site
 * works. sendBeacon hands the request to the browser to deliver regardless of
 * what happens to the page, and cannot be aborted by navigation. Falls back to
 * a keepalive fetch where it is unavailable.
 *
 * The click is NEVER blocked on the tracking call. No await, no preventDefault:
 * if analytics is down, slow, or blocked by an extension, the visitor still
 * gets where they were going.
 */

import { trackEvent } from '@/lib/analytics';

export type OutboundLinkType = 'tickets' | 'instagram' | 'maps';

interface OutboundLinkProps {
  href: string;
  eventSlug: string;
  eventId?: string;
  citySlug?: string;
  linkType: OutboundLinkType;
  /** 'live' | 'cancelled' | 'past' at render time. */
  eventState?: string;
  className?: string;
  children: React.ReactNode;
}

/** Host only — never the full URL, which can carry tracking and personal
 *  parameters we have no business storing. */
function destHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Bucket the referrer into a coarse channel instead of storing it.
 * A full referrer URL can identify a person (private forums, email webmail
 * URLs, internal tools); the bucket answers the same question safely.
 */
function channel(): string {
  if (typeof document === 'undefined') return 'unknown';
  const ref = document.referrer;
  if (!ref) return 'direct';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (h === window.location.hostname) return 'internal';
    if (/^(google|bing|duckduckgo|yahoo|ecosia|brave)\./.test(h)) return 'organic';
    if (/instagram|facebook|threads|tiktok|twitter|x\.com|linkedin/.test(h)) return 'social';
    return 'referral';
  } catch {
    return 'other';
  }
}

export default function OutboundLink({
  href,
  eventSlug,
  eventId,
  citySlug,
  linkType,
  eventState,
  className,
  children,
}: OutboundLinkProps) {
  const handleClick = () => {
    const host = destHost(href);

    // 1. GA4 — ONE event name, identity carried in parameters.
    // Deliberately not one event name per event: GA4 caps key events at 30 per
    // property and we have 327 events, so per-event names could never all be
    // measured and would scatter the total across hundreds of report rows.
    trackEvent('event_external_click', {
      link_type: linkType,
      event_slug: eventSlug,
      city: citySlug,
      dest_host: host,
      event_state: eventState,
    });

    // 2. Our own database — per-event detail at a cardinality GA4 folds into
    // its "(other)" row, and joinable to events/cities.
    try {
      const body = JSON.stringify({
        event_slug: eventSlug,
        event_id: eventId,
        city_slug: citySlug,
        link_type: linkType,
        dest_host: host,
        event_state: eventState,
        channel: channel(),
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track/outbound', new Blob([body], {
          type: 'application/json',
        }));
      } else {
        void fetch('/api/track/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never let measurement interfere with the visitor leaving.
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

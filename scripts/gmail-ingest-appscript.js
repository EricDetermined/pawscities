/**
 * Paw Cities — Gmail → Ingest Queue Bridge
 *
 * Google Apps Script that watches a Gmail inbox for emails containing
 * Instagram links and forwards them to the Paw Cities ingest API.
 *
 * SETUP:
 * 1. Go to https://script.google.com
 * 2. Create a new project, name it "Paw Cities Ingest"
 * 3. Paste this entire file into Code.gs
 * 4. Update WEBHOOK_URL and WEBHOOK_SECRET below
 * 5. Click Run → select "processNewEmails" → Authorize
 * 6. Go to Triggers (clock icon) → Add Trigger:
 *    - Function: processNewEmails
 *    - Event source: Time-driven
 *    - Type: Minutes timer
 *    - Interval: Every 5 minutes
 *
 * HOW IT WORKS:
 * - Checks for unread emails in inbox (or a specific label)
 * - Extracts URLs from the email body
 * - POSTs to /api/ingest/email with from, subject, text
 * - Marks email as read and labels it "PawCities/Processed"
 * - Emails with no URLs get labeled "PawCities/NoLinks" and skipped
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const WEBHOOK_URL = 'https://pawcities.com/api/ingest/email';
const WEBHOOK_SECRET = '3344a89bf005fe23c6c0e529c462e3cca378fbffcbb02b54a3b501656c9f11eb';

// Which inbox to watch. Options:
//   'ingest@pawcities.com' — dedicated ingest address (recommended)
//   'INBOX'                — watch entire inbox (not recommended)
//   'PawCities/Inbox'      — watch a specific Gmail label
const WATCH_ADDRESS = 'ingest@pawcities.com';

// ─── Main function (runs on timer) ──────────────────────────────────────────

function processNewEmails() {
  // Search for unread emails to the ingest address
  const query = `to:${WATCH_ADDRESS} is:unread`;
  const threads = GmailApp.search(query, 0, 20); // Process up to 20 at a time

  if (threads.length === 0) return;

  // Ensure labels exist
  const processedLabel = getOrCreateLabel('PawCities/Processed');
  const noLinksLabel = getOrCreateLabel('PawCities/NoLinks');
  const errorLabel = getOrCreateLabel('PawCities/Error');

  let processed = 0;
  let errors = 0;

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const message of messages) {
      if (message.isUnread()) {
        try {
          const result = forwardToIngest(message);
          message.markRead();

          if (result.success) {
            thread.addLabel(processedLabel);
            processed++;
          } else if (result.noLinks) {
            thread.addLabel(noLinksLabel);
          } else {
            thread.addLabel(errorLabel);
            errors++;
          }
        } catch (e) {
          Logger.log('Error processing message: ' + e.toString());
          thread.addLabel(errorLabel);
          message.markRead(); // Don't retry forever
          errors++;
        }
      }
    }
  }

  if (processed > 0 || errors > 0) {
    Logger.log(`Paw Cities Ingest: ${processed} processed, ${errors} errors`);
  }
}

// ─── Forward a single email to the webhook ──────────────────────────────────

function forwardToIngest(message) {
  const from = message.getFrom();
  const subject = message.getSubject();
  const body = message.getPlainBody();

  // Quick check: does the body contain any URLs?
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const urls = body.match(urlPattern);

  if (!urls || urls.length === 0) {
    Logger.log('No URLs found in: ' + subject);
    return { success: false, noLinks: true };
  }

  // POST to the ingest webhook
  const payload = {
    from: from,
    subject: subject,
    text: body.substring(0, 5000), // Cap body length
    source: 'email',
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const url = WEBHOOK_URL + '?secret=' + WEBHOOK_SECRET;
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code === 200) {
    const result = JSON.parse(response.getContentText());
    Logger.log(`Ingested: ${subject} → ${result.classification || 'unknown'} (${result.urls_found || 0} URLs)`);
    return { success: true };
  } else {
    Logger.log(`Webhook error ${code}: ${response.getContentText()}`);
    return { success: false, noLinks: false };
  }
}

// ─── Helper: get or create a Gmail label ────────────────────────────────────

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

// ─── Manual test function ───────────────────────────────────────────────────

function testWebhook() {
  const payload = {
    from: 'eric@ericdetermined.com',
    subject: 'Test - Paris dog event',
    text: 'Check out this event in Paris! https://www.instagram.com/p/TEST123/',
    source: 'email',
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const url = WEBHOOK_URL + '?secret=' + WEBHOOK_SECRET;
  const response = UrlFetchApp.fetch(url, options);

  Logger.log('Status: ' + response.getResponseCode());
  Logger.log('Response: ' + response.getContentText());
}

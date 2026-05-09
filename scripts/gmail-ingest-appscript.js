/**
 * Paw Cities — Gmail to Ingest Queue Bridge
 *
 * Google Apps Script that watches Gmail for emails sent to the ingest
 * address and forwards them to the Paw Cities ingest API.
 *
 * Uses LABEL-BASED tracking (not read/unread) so that self-sent emails
 * (same Google Workspace account) are correctly detected and processed.
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
 * - Searches for emails TO the ingest address that haven't been labeled yet
 * - Extracts URLs from the email body
 * - POSTs to /api/ingest/email with from, subject, text
 * - Labels thread "PawCities-Processed" on success
 * - Emails with no URLs get labeled "PawCities-NoLinks" and skipped
 *
 * NOTE: Uses hyphens in label names (PawCities-Processed) not slashes,
 * because Gmail search -label: syntax works more reliably with hyphens.
 */

// ─── Configuration ───────────────────────────────────────────────────────────

var WEBHOOK_URL = 'https://pawcities.com/api/ingest/email';
var WEBHOOK_SECRET = '3344a89bf005fe23c6c0e529c462e3cca378fbffcbb02b54a3b501656c9f11eb';

// Emails sent TO this address will be processed
var WATCH_ADDRESS = 'ingest@pawcities.com';

// ─── Main function (runs on timer) ──────────────────────────────────────────

function processNewEmails() {
  // Search for emails TO the ingest address that have NOT been processed yet
  // Uses label exclusion instead of is:unread so self-sent emails are found
  var query = 'to:' + WATCH_ADDRESS + ' -label:PawCities-Processed -label:PawCities-NoLinks -label:PawCities-Error';
  var threads = GmailApp.search(query, 0, 20);

  if (threads.length === 0) return;

  var processedLabel = getOrCreateLabel('PawCities-Processed');
  var noLinksLabel = getOrCreateLabel('PawCities-NoLinks');
  var errorLabel = getOrCreateLabel('PawCities-Error');
  var processed = 0;
  var errors = 0;

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    // Process the last message in thread (most recent)
    var message = messages[messages.length - 1];
    try {
      var result = forwardToIngest(message);
      if (result.success) {
        threads[i].addLabel(processedLabel);
        processed++;
      } else if (result.noLinks) {
        threads[i].addLabel(noLinksLabel);
      } else {
        threads[i].addLabel(errorLabel);
        errors++;
      }
    } catch (e) {
      Logger.log('Error processing message: ' + e.toString());
      threads[i].addLabel(errorLabel);
      errors++;
    }
  }

  if (processed > 0 || errors > 0) {
    Logger.log('Paw Cities Ingest: ' + processed + ' processed, ' + errors + ' errors');
  }
}

// ─── Forward a single email to the webhook ──────────────────────────────────

function forwardToIngest(message) {
  var from = message.getFrom();
  var subject = message.getSubject();
  var body = message.getPlainBody();

  // Quick check: does the body contain any URLs?
  var urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  var urls = body.match(urlPattern);

  if (!urls || urls.length === 0) {
    Logger.log('No URLs found in: ' + subject);
    return { success: false, noLinks: true };
  }

  // POST to the ingest webhook
  var payload = {
    from: from,
    subject: subject,
    text: body.substring(0, 5000),
    source: 'email'
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var url = WEBHOOK_URL + '?secret=' + WEBHOOK_SECRET;
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code === 200) {
    var result = JSON.parse(response.getContentText());
    Logger.log('Ingested: ' + subject + ' -> ' + (result.classification || 'unknown') + ' (' + (result.urls_found || 0) + ' URLs)');
    return { success: true };
  } else {
    Logger.log('Webhook error ' + code + ': ' + response.getContentText());
    return { success: false, noLinks: false };
  }
}

// ─── Helper: get or create a Gmail label ────────────────────────────────────

function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

// ─── Manual test function ───────────────────────────────────────────────────

function testWebhook() {
  var payload = {
    from: 'eric@ericdetermined.com',
    subject: 'Test - Paris dog event',
    text: 'Check out this event in Paris! https://www.instagram.com/p/TEST123/',
    source: 'email'
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var url = WEBHOOK_URL + '?secret=' + WEBHOOK_SECRET;
  var response = UrlFetchApp.fetch(url, options);

  Logger.log('Status: ' + response.getResponseCode());
  Logger.log('Response: ' + response.getContentText());
}

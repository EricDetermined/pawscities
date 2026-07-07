/**
 * Paw Cities — Gmail to Ingest Queue Bridge (v2)
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
 * - Extracts URLs from BOTH plain text AND HTML body (catches shared IG links)
 * - POSTs to /api/ingest/email with from, subject, text (including extracted URLs)
 * - Labels thread "PawCities-Processed" on success
 * - Emails with no URLs get labeled "PawCities-NoLinks" and skipped
 * - Transient Google errors are caught and retried on the next run
 *
 * NOTE: Uses hyphens in label names (PawCities-Processed) not slashes,
 * because Gmail search -label: syntax works more reliably with hyphens.
 */

// ─── Configuration ───────────────────────────────────────────────────────────

var WEBHOOK_URL = 'https://pawcities.com/api/ingest/email';
var WEBHOOK_SECRET = '3344a89bf005fe23c6c0e529c462e3cca378fbffcbb02b54a3b501656c9f11eb';

// Emails sent TO this address will be processed
var WATCH_ADDRESS = 'ingest@pawcities.com';

// Max retries for transient Google errors
var MAX_RETRIES = 2;

// ─── Main function (runs on timer) ──────────────────────────────────────────

function processNewEmails() {
  var query = 'to:' + WATCH_ADDRESS + ' -label:PawCities-Processed -label:PawCities-NoLinks -label:PawCities-Error';

  var threads;
  try {
    threads = GmailApp.search(query, 0, 20);
  } catch (e) {
    // Transient Google error on search — log and exit, will retry next trigger
    Logger.log('Gmail search failed (transient): ' + e.toString());
    return;
  }

  if (threads.length === 0) return;

  var processedLabel = getOrCreateLabel('PawCities-Processed');
  var noLinksLabel = getOrCreateLabel('PawCities-NoLinks');
  var errorLabel = getOrCreateLabel('PawCities-Error');
  var processed = 0;
  var errors = 0;
  var noLinks = 0;

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
        noLinks++;
      } else {
        threads[i].addLabel(errorLabel);
        errors++;
      }
    } catch (e) {
      Logger.log('Error processing message "' + message.getSubject() + '": ' + e.toString());
      // Don't label as error for transient issues — leave unlabeled so we retry next run
      if (e.toString().indexOf('server error') === -1 && e.toString().indexOf('Service invoked too many') === -1) {
        threads[i].addLabel(errorLabel);
      }
      errors++;
    }

    // Brief pause between messages to avoid rate limits
    if (i < threads.length - 1) Utilities.sleep(500);
  }

  if (processed > 0 || errors > 0 || noLinks > 0) {
    Logger.log('Paw Cities Ingest: ' + processed + ' processed, ' + noLinks + ' no-links, ' + errors + ' errors');
  }
}

// ─── Forward a single email to the webhook ──────────────────────────────────

function forwardToIngest(message) {
  var from = message.getFrom();
  var subject = message.getSubject();
  var plainBody = message.getPlainBody() || '';
  var htmlBody = message.getBody() || '';

  // Extract URLs from BOTH plain text AND HTML body
  // Instagram shares often only put the URL in the HTML version
  var urls = extractAllUrls(plainBody, htmlBody, subject);

  if (urls.length === 0) {
    Logger.log('No URLs found in: ' + subject);
    return { success: false, noLinks: true };
  }

  // Build enriched text body with all discovered URLs
  // If plain body is empty or missing URLs, inject them so the API can find them
  var enrichedBody = plainBody;
  if (!enrichedBody || enrichedBody.trim().length < 10) {
    // Plain body is empty/minimal — build from HTML extraction
    enrichedBody = extractTextFromHtml(htmlBody);
  }

  // Always append discovered URLs to ensure the API extracts them
  var plainUrls = extractUrlsFromText(plainBody);
  var missingUrls = urls.filter(function(u) {
    return plainUrls.indexOf(u) === -1;
  });
  if (missingUrls.length > 0) {
    enrichedBody += '\n\n--- URLs found in email ---\n' + missingUrls.join('\n');
  }

  // POST to the ingest webhook
  var payload = {
    from: from,
    subject: subject,
    text: enrichedBody.substring(0, 5000),
    source: 'email'
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var webhookUrl = WEBHOOK_URL + '?secret=' + WEBHOOK_SECRET;

  // Retry on transient errors
  var lastError = null;
  for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      var response = UrlFetchApp.fetch(webhookUrl, options);
      var code = response.getResponseCode();

      if (code === 200) {
        var result = JSON.parse(response.getContentText());
        Logger.log('Ingested: ' + subject + ' -> ' + (result.classification || 'unknown') + ' (' + (result.urls_found || 0) + ' URLs, vision: ' + (result.vision_extracted || false) + ')');
        return { success: true };
      } else if (code >= 500 && attempt < MAX_RETRIES) {
        Logger.log('Webhook returned ' + code + ', retrying in 2s (attempt ' + (attempt + 1) + ')');
        Utilities.sleep(2000);
        continue;
      } else {
        Logger.log('Webhook error ' + code + ': ' + response.getContentText().substring(0, 200));
        return { success: false, noLinks: false };
      }
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES) {
        Logger.log('Fetch error, retrying in 2s: ' + e.toString().substring(0, 100));
        Utilities.sleep(2000);
      }
    }
  }

  Logger.log('All retries exhausted: ' + (lastError ? lastError.toString() : 'unknown'));
  return { success: false, noLinks: false };
}

// ─── URL extraction (from multiple sources) ─────────────────────────────────

function extractAllUrls(plainBody, htmlBody, subject) {
  var seen = {};
  var urls = [];

  // 1. Extract from plain text body
  var plainUrls = extractUrlsFromText(plainBody);
  for (var i = 0; i < plainUrls.length; i++) {
    var normalized = normalizeUrl(plainUrls[i]);
    if (!seen[normalized]) {
      seen[normalized] = true;
      urls.push(plainUrls[i]);
    }
  }

  // 2. Extract from HTML body (catches IG share links that only appear in HTML)
  var htmlUrls = extractUrlsFromHtml(htmlBody);
  for (var j = 0; j < htmlUrls.length; j++) {
    var normalizedH = normalizeUrl(htmlUrls[j]);
    if (!seen[normalizedH]) {
      seen[normalizedH] = true;
      urls.push(htmlUrls[j]);
    }
  }

  // 3. Extract from subject line
  var subjectUrls = extractUrlsFromText(subject);
  for (var k = 0; k < subjectUrls.length; k++) {
    var normalizedS = normalizeUrl(subjectUrls[k]);
    if (!seen[normalizedS]) {
      seen[normalizedS] = true;
      urls.push(subjectUrls[k]);
    }
  }

  // Filter out tracking/unsubscribe/mail URLs
  return urls.filter(function(u) {
    var lower = u.toLowerCase();
    return !lower.includes('unsubscribe') &&
           !lower.includes('tracking') &&
           !lower.includes('click.') &&
           !lower.includes('mailtrack') &&
           !lower.includes('googleadservices') &&
           !lower.includes('doubleclick') &&
           !lower.includes('google.com/maps') &&
           !lower.includes('gstatic.com') &&
           !lower.includes('googleapis.com/mail');
  });
}

function extractUrlsFromText(text) {
  if (!text) return [];
  var urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  var matches = text.match(urlPattern) || [];
  // Clean trailing punctuation
  return matches.map(function(u) {
    return u.replace(/[.,;:!?\)]+$/, '');
  });
}

function extractUrlsFromHtml(html) {
  if (!html) return [];
  var urls = [];

  // Extract href values from anchor tags
  var hrefPattern = /href=["']([^"']+)["']/gi;
  var match;
  while ((match = hrefPattern.exec(html)) !== null) {
    var href = match[1];
    if (href.indexOf('http') === 0) {
      urls.push(href.replace(/&amp;/g, '&'));
    }
  }

  // Also extract bare URLs in the HTML text
  var barePattern = /https?:\/\/[^\s<>"{}|\\^`\[\]&]+/gi;
  var bareMatches = html.match(barePattern) || [];
  for (var i = 0; i < bareMatches.length; i++) {
    urls.push(bareMatches[i].replace(/[.,;:!?\)]+$/, ''));
  }

  return urls;
}

function normalizeUrl(url) {
  // Strip tracking params and trailing slashes for dedup
  return url.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
}

// ─── HTML to plain text (basic) ─────────────────────────────────────────────

function extractTextFromHtml(html) {
  if (!html) return '';
  // Strip HTML tags but keep content
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 3000);
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

// ─── Re-process NoLinks emails (run manually after script update) ───────────
// Some emails were labeled NoLinks because v1 only checked plain text.
// This function removes that label so they get re-processed with v2's HTML extraction.

function reprocessNoLinksEmails() {
  var noLinksLabel = GmailApp.getUserLabelByName('PawCities-NoLinks');
  if (!noLinksLabel) {
    Logger.log('No PawCities-NoLinks label found');
    return;
  }

  var threads = noLinksLabel.getThreads(0, 50);
  Logger.log('Found ' + threads.length + ' NoLinks threads to re-process');

  for (var i = 0; i < threads.length; i++) {
    threads[i].removeLabel(noLinksLabel);
  }

  Logger.log('Removed NoLinks label from ' + threads.length + ' threads — they will be re-processed on next trigger run');
}

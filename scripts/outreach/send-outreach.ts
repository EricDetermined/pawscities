#!/usr/bin/env npx tsx
/**
 * PawCities Business Outreach Script
 *
 * Sends personalized outreach emails to businesses via Resend API.
 * Reads prospects from CSV, personalizes templates, tracks sends in a JSON log.
 *
 * Usage:
 *   npx tsx scripts/outreach/send-outreach.ts --csv prospects/la.csv           # dry run
 *   npx tsx scripts/outreach/send-outreach.ts --csv prospects/la.csv --send    # real send
 *   npx tsx scripts/outreach/send-outreach.ts --csv prospects/la.csv --send --followup  # follow-ups
 */

import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Prospect {
  businessName: string;
  contactName: string;
  contactEmail: string;
  city: string;
  category: string;
  listingUrl: string;
  alreadyListed: boolean;
}

interface SendLog {
  email: string;
  businessName: string;
  template: 'A' | 'B' | 'C';
  sentAt: string;
  status: 'sent' | 'failed' | 'dry-run';
  error?: string;
}

interface OutreachLog {
  sends: SendLog[];
  lastRun: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Eric Silverstein <eric@pawcities.com>';
const REPLY_TO = 'eric@ericdetermined.com';
const APP_URL = 'https://pawcities.com';
const FOR_BUSINESS_URL = `${APP_URL}/for-business`;
const DAILY_LIMIT = 90; // Leave buffer under Resend's 100/day free tier
const FOLLOWUP_DAYS = 5;
const LOG_DIR = path.join(process.cwd(), 'scripts/outreach/logs');

// ─── Email Templates ────────────────────────────────────────────────────────

function baseHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4f0;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 32px 0;">
${content}
</td></tr>
<tr><td style="padding:24px 32px 32px;">
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0;">Cheers,<br><strong>Eric Silverstein</strong><br>Founder, <a href="${APP_URL}" style="color:#ea580c;text-decoration:none;">Paw Cities</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Template A: Business already listed on PawCities */
function templateA(p: Prospect): { subject: string; html: string } {
  return {
    subject: `Your ${p.businessName} listing on Paw Cities`,
    html: baseHtml(`
<p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 16px;">Hi ${p.contactName},</p>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">I wanted to let you know that <strong>${p.businessName}</strong> is listed on Paw Cities — a dog-friendly business directory used by dog owners in ${p.city} and travelers visiting with their pets.</p>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">Your listing is live at <a href="${p.listingUrl}" style="color:#ea580c;">${p.businessName} on Paw Cities</a>, but it hasn't been claimed yet. Claiming takes under a minute and lets you:</p>
<ul style="font-size:15px;line-height:1.8;color:#4a4a4a;padding-left:20px;margin:0 0 16px;">
<li>Update your description and dog-friendly amenities</li>
<li>Add your phone number and photos</li>
<li>See how dog owners are finding you</li>
</ul>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">It's completely free — no credit card required.</p>
<table cellpadding="0" cellspacing="0" style="margin:16px 0 24px;"><tr><td>
<a href="${FOR_BUSINESS_URL}" style="display:inline-block;padding:12px 28px;background:#ea580c;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Claim Your Listing</a>
</td></tr></table>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">Happy to answer any questions.</p>
`),
  };
}

/** Template B: Business NOT yet listed on PawCities */
function templateB(p: Prospect): { subject: string; html: string } {
  return {
    subject: `Feature ${p.businessName} to dog owners visiting ${p.city}`,
    html: baseHtml(`
<p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 16px;">Hi ${p.contactName},</p>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">I'm building <a href="${APP_URL}" style="color:#ea580c;">Paw Cities</a>, a directory that helps dog owners find pet-friendly restaurants, cafes, hotels, and parks in cities around the world. We currently cover ${p.city} along with 7 other destinations.</p>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">I noticed that <strong>${p.businessName}</strong> welcomes dogs — that's exactly what our users search for. I'd love to add your business to our directory so dog owners in ${p.city} can discover you more easily.</p>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">Listing is free, and you can claim your profile to manage your description, photos, and amenities.</p>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">Would you like me to add you? Just reply and I'll set it up.</p>
`),
  };
}

/** Template C: Follow-up (5 days after no response) */
function templateC(p: Prospect): { subject: string; html: string } {
  return {
    subject: `Re: Your ${p.businessName} listing on Paw Cities`,
    html: baseHtml(`
<p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 16px;">Hi ${p.contactName},</p>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">Just following up — wanted to make sure this didn't get buried. Claiming your free listing on Paw Cities takes about 60 seconds and puts <strong>${p.businessName}</strong> in front of dog owners exploring ${p.city}.</p>
<table cellpadding="0" cellspacing="0" style="margin:16px 0 24px;"><tr><td>
<a href="${p.listingUrl || FOR_BUSINESS_URL}" style="display:inline-block;padding:12px 28px;background:#ea580c;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Claim Your Free Listing</a>
</td></tr></table>
<p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px;">No worries if it's not a priority right now — your listing will stay active either way.</p>
`),
  };
}

// ─── CSV Parser ─────────────────────────────────────────────────────────────

function parseCSV(csvPath: string): Prospect[] {
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    // Handle quoted fields
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });

    return {
      businessName: row.businessName || '',
      contactName: row.contactName || row.businessName?.split(' ')[0] || 'there',
      contactEmail: row.contactEmail || '',
      city: row.city || '',
      category: row.category || '',
      listingUrl: row.listingUrl || '',
      alreadyListed: row.alreadyListed?.toLowerCase() === 'true',
    };
  }).filter(p => p.contactEmail && p.businessName);
}

// ─── Send Log ───────────────────────────────────────────────────────────────

function getLogPath(): string {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  return path.join(LOG_DIR, 'outreach-log.json');
}

function loadLog(): OutreachLog {
  const logPath = getLogPath();
  if (fs.existsSync(logPath)) {
    return JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  }
  return { sends: [], lastRun: '' };
}

function saveLog(log: OutreachLog): void {
  fs.writeFileSync(getLogPath(), JSON.stringify(log, null, 2));
}

function alreadySent(log: OutreachLog, email: string, template: 'A' | 'B' | 'C'): SendLog | undefined {
  return log.sends.find(s => s.email === email && s.template === template && s.status === 'sent');
}

function daysSinceSend(log: OutreachLog, email: string): number | null {
  const lastSend = log.sends
    .filter(s => s.email === email && s.status === 'sent')
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];
  if (!lastSend) return null;
  return (Date.now() - new Date(lastSend.sentAt).getTime()) / (1000 * 60 * 60 * 24);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const csvIndex = args.indexOf('--csv');
  const csvPath = csvIndex !== -1 ? args[csvIndex + 1] : null;
  const realSend = args.includes('--send');
  const followUp = args.includes('--followup');

  if (!csvPath) {
    console.error('Usage: npx tsx scripts/outreach/send-outreach.ts --csv <path> [--send] [--followup]');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const prospects = parseCSV(csvPath);
  console.log(`\n📋 Loaded ${prospects.length} prospects from ${csvPath}`);
  console.log(`📧 Mode: ${realSend ? '🔴 LIVE SEND' : '🟢 DRY RUN'}`);
  console.log(`📨 Type: ${followUp ? 'Follow-up (Template C)' : 'Initial outreach (Template A/B)'}\n`);

  const log = loadLog();
  let sentCount = 0;
  let skippedCount = 0;
  const results: SendLog[] = [];

  let resend: Resend | null = null;
  if (realSend) {
    if (!RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not set. Add it to .env.local');
      process.exit(1);
    }
    resend = new Resend(RESEND_API_KEY);
  }

  for (const prospect of prospects) {
    if (sentCount >= DAILY_LIMIT) {
      console.log(`\n⚠️  Hit daily limit (${DAILY_LIMIT}). Remaining prospects will be sent tomorrow.`);
      break;
    }

    let template: 'A' | 'B' | 'C';
    let email: { subject: string; html: string };

    if (followUp) {
      // Follow-up mode: only send to those who got initial email 5+ days ago
      const days = daysSinceSend(log, prospect.contactEmail);
      if (days === null || days < FOLLOWUP_DAYS) {
        skippedCount++;
        continue;
      }
      if (alreadySent(log, prospect.contactEmail, 'C')) {
        skippedCount++;
        continue;
      }
      template = 'C';
      email = templateC(prospect);
    } else {
      // Initial outreach
      template = prospect.alreadyListed ? 'A' : 'B';
      if (alreadySent(log, prospect.contactEmail, template)) {
        skippedCount++;
        continue;
      }
      email = template === 'A' ? templateA(prospect) : templateB(prospect);
    }

    const logEntry: SendLog = {
      email: prospect.contactEmail,
      businessName: prospect.businessName,
      template,
      sentAt: new Date().toISOString(),
      status: 'dry-run',
    };

    if (realSend && resend) {
      try {
        const { error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: [prospect.contactEmail],
          replyTo: REPLY_TO,
          subject: email.subject,
          html: email.html,
        });
        if (error) {
          logEntry.status = 'failed';
          logEntry.error = error.message;
          console.log(`  ❌ ${prospect.businessName} (${prospect.contactEmail}): ${error.message}`);
        } else {
          logEntry.status = 'sent';
          sentCount++;
          console.log(`  ✅ ${prospect.businessName} → ${prospect.contactEmail} [Template ${template}]`);
        }
        // Rate limit: ~2 per second
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        logEntry.status = 'failed';
        logEntry.error = err instanceof Error ? err.message : 'Unknown error';
        console.log(`  ❌ ${prospect.businessName}: ${logEntry.error}`);
      }
    } else {
      console.log(`  📝 [DRY RUN] ${prospect.businessName} → ${prospect.contactEmail} [Template ${template}]`);
      console.log(`     Subject: ${email.subject}`);
      sentCount++;
    }

    results.push(logEntry);
    log.sends.push(logEntry);
  }

  log.lastRun = new Date().toISOString();
  saveLog(log);

  console.log(`\n─── Summary ───`);
  console.log(`  📨 ${realSend ? 'Sent' : 'Would send'}: ${sentCount}`);
  console.log(`  ⏭  Skipped (already sent): ${skippedCount}`);
  console.log(`  📊 Log saved to: ${getLogPath()}\n`);
}

main().catch(console.error);

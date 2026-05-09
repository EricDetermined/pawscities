import { Resend } from 'resend';

// âââ Configuration ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

// Lazy initialization to avoid throwing during Next.js build when env vars aren't set
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Read at request time, not build time
function getEmailFrom() { return process.env.EMAIL_FROM || 'Paw Cities <noreply@pawcities.com>'; }
// Read at call time, not build time, so env var changes take effect without redeploying
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
}
// Read at request time, not build time
function getAppUrl() { return process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://pawcities.com'; }

interface EmailResult {
  success: boolean;
  error?: string;
}

// âââ Core Send Function âââââââââââââââââââââââââââââââââââââââââââââââââââââââ

async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[EMAIL] RESEND_API_KEY not configured, skipping email send');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { error } = await getResend().emails.send({
      from: getEmailFrom(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error(`[EMAIL] Send failed to ${to}: ${error.message}`);
      return { success: false, error: error.message };
    }

    console.log(`[EMAIL] Sent "${subject}" to ${to}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[EMAIL] Exception sending to ${to}: ${message}`);
    return { success: false, error: message };
  }
}

// âââ Base Template ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function baseTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f4f0;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- Header -->
<tr><td style="background-color:#ea580c;padding:24px 32px;">
  <span style="font-size:22px;font-weight:700;color:#ffffff;">&#128062; Paw Cities</span>
</td></tr>

<!-- Title -->
<tr><td style="padding:32px 32px 0;">
  <h1 style="margin:0;font-size:22px;font-weight:700;color:#1a1a1a;">${title}</h1>
</td></tr>

<!-- Content -->
<tr><td style="padding:16px 32px 32px;font-size:15px;line-height:1.6;color:#4a4a4a;">
${content}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 32px;background-color:#fef3e8;border-top:1px solid #fed7aa;">
  <p style="margin:0;font-size:13px;color:#9a7b5a;">Paw Cities &mdash; Dog-Friendly Places Worldwide</p>
  <p style="margin:4px 0 0;font-size:12px;color:#b89b78;"><a href="${getAppUrl()}" style="color:#ea580c;text-decoration:none;">${getAppUrl()}</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
<a href="${url}" style="display:inline-block;padding:12px 28px;background-color:#ea580c;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${text}</a>
</td></tr></table>`;
}

// âââ Email Templates ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function claimConfirmationTemplate(businessName: string, claimId: string): string {
  return baseTemplate('Claim Received', `
<p>Thanks for submitting your claim for <strong>${businessName}</strong>!</p>
<p>Our team will review your submission and verify ownership. You can expect to hear back within <strong>1&ndash;2 business days</strong>.</p>
<p style="background:#fef3e8;padding:12px 16px;border-radius:8px;font-size:14px;color:#7c5a2e;">
  <strong>Reference:</strong> ${claimId.slice(0, 8)}...
</p>
<p style="background:#e8f4fe;padding:12px 16px;border-radius:8px;font-size:14px;color:#1e40af;margin:16px 0;">
  <strong>New to Paw Cities?</strong> Once your claim is approved, you&rsquo;ll receive an invitation email to set up your account and password. No action needed from your side right now &mdash; we&rsquo;ll handle everything during the review.
</p>
<p>In the meantime, you can check the status of your claim from your dashboard.</p>
${ctaButton('View Your Dashboard', `${getAppUrl()}/business/claim`)}
<p style="font-size:13px;color:#888;">If you didn&rsquo;t submit this claim, you can safely ignore this email.</p>
`);
}

function claimApprovedTemplate(businessName: string): string {
  return baseTemplate('Claim Approved!', `
<p>Great news! Your claim for <strong>${businessName}</strong> has been approved.</p>
<p>Your listing is now <strong>active</strong> on Paw Cities and you have full access to manage it. Here&rsquo;s what you can do:</p>
<ul style="padding-left:20px;margin:16px 0;">
  <li style="margin-bottom:8px;">Edit your listing details, hours and primary photo</li>
  <li style="margin-bottom:8px;">View basic analytics</li>
  <li style="margin-bottom:8px;">Respond to reviews (Premium plan)</li>
  <li style="margin-bottom:8px;">Detailed visitor tracking and insights (Premium plan)</li>
</ul>
<p style="background:#e8f4fe;padding:12px 16px;border-radius:8px;font-size:14px;color:#1e40af;">
  <strong>First time here?</strong> If this is your first time on Paw Cities, check your inbox for a separate invitation email to set up your account and password.
</p>
${ctaButton('Go to Your Dashboard', `${getAppUrl()}/business`)}
<p style="font-size:13px;color:#888;">Welcome to Paw Cities! We&rsquo;re excited to have you on board.</p>
`);
}

function claimRejectedTemplate(businessName: string, reason?: string): string {
  const reasonBlock = reason
    ? `<p style="background:#fef2f2;padding:12px 16px;border-radius:8px;font-size:14px;color:#991b1b;border-left:3px solid #ef4444;"><strong>Reason:</strong> ${reason}</p>`
    : '';

  return baseTemplate('Claim Update', `
<p>We&rsquo;ve reviewed your claim for <strong>${businessName}</strong> and unfortunately we weren&rsquo;t able to verify ownership at this time.</p>
${reasonBlock}
<p>You&rsquo;re welcome to resubmit your claim with additional verification. Common verification methods include:</p>
<ul style="padding-left:20px;margin:16px 0;">
  <li style="margin-bottom:8px;">Using an email address matching the business domain</li>
  <li style="margin-bottom:8px;">Providing a business license or registration document</li>
  <li style="margin-bottom:8px;">A utility bill or lease agreement showing the business address</li>
</ul>
${ctaButton('Submit a New Claim', `${getAppUrl()}/business/claim`)}
<p style="font-size:13px;color:#888;">Questions? Reply to this email and we&rsquo;ll be happy to help.</p>
`);
}

function newClaimAdminAlertTemplate(
  businessName: string,
  contactName: string,
  contactEmail: string,
  verificationMethod: string
): string {
  return baseTemplate('New Business Claim', `
<p>A new business claim has been submitted and needs review.</p>
<table width="100%" cellpadding="8" cellspacing="0" style="margin:16px 0;border:1px solid #e5e5e5;border-radius:8px;font-size:14px;">
  <tr style="background:#f9f9f9;"><td style="font-weight:600;width:140px;">Business</td><td>${businessName}</td></tr>
  <tr><td style="font-weight:600;">Contact</td><td>${contactName}</td></tr>
  <tr style="background:#f9f9f9;"><td style="font-weight:600;">Email</td><td><a href="mailto:${contactEmail}" style="color:#ea580c;">${contactEmail}</a></td></tr>
  <tr><td style="font-weight:600;">Verification</td><td>${verificationMethod.replace(/_/g, ' ')}</td></tr>
</table>
${ctaButton('Review in Admin Dashboard', `${getAppUrl()}/admin/claims`)}
`);
}

// âââ Public Email Functions âââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function sendClaimConfirmation(
  to: string,
  businessName: string,
  claimId: string
): Promise<EmailResult> {
  return sendEmail(
    to,
    `Claim received for ${businessName}`,
    claimConfirmationTemplate(businessName, claimId)
  );
}

export async function sendClaimApproved(
  to: string,
  businessName: string
): Promise<EmailResult> {
  return sendEmail(
    to,
    `Your claim for ${businessName} has been approved!`,
    claimApprovedTemplate(businessName)
  );
}

export async function sendClaimRejected(
  to: string,
  businessName: string,
  reason?: string
): Promise<EmailResult> {
  return sendEmail(
    to,
    `Update on your claim for ${businessName}`,
    claimRejectedTemplate(businessName, reason)
  );
}

export async function sendNewClaimAdminAlert(
  businessName: string,
  contactName: string,
  contactEmail: string,
  verificationMethod: string
): Promise<EmailResult> {
  if (getAdminEmails().length === 0) {
    console.warn('[EMAIL] No ADMIN_EMAILS configured, skipping admin alert');
    return { success: false, error: 'No admin emails configured' };
  }

  return sendEmail(
    getAdminEmails(),
    `New claim: ${businessName}`,
    newClaimAdminAlertTemplate(businessName, contactName, contactEmail, verificationMethod)
  );
}

// ——— Event Submission Emails ————————————————————————————————————————————

function newEventSubmissionAdminTemplate(
  eventName: string,
  cityName: string,
  startDate: string,
  submitterName: string,
  submitterEmail: string,
  venueName?: string | null,
): string {
  return baseTemplate('New Event Submission', `
<p>A new dog-friendly event has been submitted and needs your review.</p>
<table width="100%" cellpadding="8" cellspacing="0" style="margin:16px 0;border:1px solid #e5e5e5;border-radius:8px;font-size:14px;">
  <tr style="background:#f9f9f9;"><td style="font-weight:600;width:140px;">Event</td><td>${eventName}</td></tr>
  <tr><td style="font-weight:600;">City</td><td>${cityName}</td></tr>
  <tr style="background:#f9f9f9;"><td style="font-weight:600;">Date</td><td>${startDate}</td></tr>
  ${venueName ? `<tr><td style="font-weight:600;">Venue</td><td>${venueName}</td></tr>` : ''}
  <tr style="background:#f9f9f9;"><td style="font-weight:600;">Submitted&nbsp;by</td><td>${submitterName}</td></tr>
  <tr><td style="font-weight:600;">Email</td><td><a href="mailto:${submitterEmail}" style="color:#ea580c;">${submitterEmail}</a></td></tr>
</table>
${ctaButton('Review in Admin Dashboard', `${getAppUrl()}/admin/events`)}
<p style="font-size:13px;color:#888;">Approve or reject this event from the admin events dashboard.</p>
`);
}

export async function sendNewEventAdminAlert(
  eventName: string,
  cityName: string,
  startDate: string,
  submitterName: string,
  submitterEmail: string,
  venueName?: string | null,
): Promise<EmailResult> {
  if (getAdminEmails().length === 0) {
    console.warn('[EMAIL] No ADMIN_EMAILS configured, skipping event admin alert');
    return { success: false, error: 'No admin emails configured' };
  }

  return sendEmail(
    getAdminEmails(),
    `New event submission: ${eventName} (${cityName})`,
    newEventSubmissionAdminTemplate(eventName, cityName, startDate, submitterName, submitterEmail, venueName)
  );
}

export async function sendBusinessAccountSetup(
  to: string,
  businessName: string
): Promise<EmailResult> {
  return sendEmail(
    to,
    `Set up your Paw Cities account for ${businessName}`,
    baseTemplate('Set Up Your Account', `
<p>Your business <strong>${businessName}</strong> has been approved on Paw Cities!</p>
<p>To access your business dashboard, you need to set up your account password:</p>
<ol style="padding-left:20px;margin:16px 0;">
  <li style="margin-bottom:8px;">Go to the sign-in page</li>
  <li style="margin-bottom:8px;">Click <strong>&ldquo;Forgot Password&rdquo;</strong></li>
  <li style="margin-bottom:8px;">Enter this email address: <strong>${to}</strong></li>
  <li style="margin-bottom:8px;">Check your inbox for the password reset link</li>
  <li style="margin-bottom:8px;">Set your password and sign in!</li>
</ol>
${ctaButton('Go to Sign In', `${getAppUrl()}/login`)}
<p style="font-size:13px;color:#888;">Once signed in, you&rsquo;ll have full access to manage your listing on Paw Cities.</p>
`)
  );
}

// ——— Social Digest Email ——————————————————————————————————————————————————

interface SocialDigestData {
  newOpportunities: { permalink: string; caption: string; category: string; suggestedReply: string; likes: number }[];
  unrepliedComments: { username: string; text: string; postId: string }[];
  topPost: { permalink: string; likes: number; comments: number; caption: string } | null;
  totalPendingOpportunities: number;
  engagementSummary: { avgLikes: number; avgComments: number; postsTracked: number };
  agentHealth?: string;
  hashtagsScannedToday?: string[];
}

function socialDigestTemplate(data: SocialDigestData): string {
  // Separate story repost candidates from regular opportunities
  const storyReposts = data.newOpportunities.filter(o => o.category === 'story_repost');
  const regularOpps = data.newOpportunities.filter(o => o.category !== 'story_repost');

  const storyRepostHtml = storyReposts.length > 0
    ? storyReposts.map(opp => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #f0f0f0;background:#fff7ed;">
            <p style="margin:0 0 4px;font-size:13px;color:#c2410c;font-weight:600;">STORY REPOST CANDIDATE · ${opp.likes} likes</p>
            <p style="margin:0 0 8px;font-size:14px;color:#333;">${opp.caption.substring(0, 150)}${opp.caption.length > 150 ? '...' : ''}</p>
            <a href="${opp.permalink}" style="display:inline-block;padding:6px 16px;background-color:#ea580c;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;">View & Repost to Story</a>
          </td>
        </tr>`).join('')
    : '';

  const opportunitiesHtml = regularOpps.length > 0
    ? regularOpps.slice(0, 8).map(opp => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #f0f0f0;">
            <p style="margin:0 0 4px;font-size:13px;color:#888;">${opp.category.toUpperCase()} · ${opp.likes} likes</p>
            <p style="margin:0 0 8px;font-size:14px;color:#333;">${opp.caption.substring(0, 120)}${opp.caption.length > 120 ? '...' : ''}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#ea580c;font-style:italic;">Suggested: "${opp.suggestedReply.substring(0, 120)}${opp.suggestedReply.length > 120 ? '...' : ''}"</p>
            <a href="${opp.permalink}" style="font-size:12px;color:#ea580c;">View on Instagram &rarr;</a>
          </td>
        </tr>`).join('')
    : '<tr><td style="padding:12px;color:#888;font-size:14px;">No new engagement opportunities found today. The agent scanned hashtags but nothing matched the threshold.</td></tr>';

  const commentsHtml = data.unrepliedComments.length > 0
    ? data.unrepliedComments.slice(0, 8).map(c => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
            <p style="margin:0;font-size:14px;"><strong>@${c.username}:</strong> ${c.text.substring(0, 150)}${c.text.length > 150 ? '...' : ''}</p>
          </td>
        </tr>`).join('')
    : '<tr><td style="padding:8px 12px;color:#888;font-size:14px;">All comments replied to!</td></tr>';

  const topPostHtml = data.topPost
    ? `<p style="margin:8px 0;font-size:14px;">Best performing: <strong>${data.topPost.likes} likes, ${data.topPost.comments} comments</strong></p>
       <a href="${data.topPost.permalink}" style="font-size:13px;color:#ea580c;">View post &rarr;</a>`
    : '<p style="margin:8px 0;font-size:14px;color:#888;">No engagement data yet.</p>';

  const agentHealthHtml = data.agentHealth
    ? `<p style="font-size:12px;color:#666;margin:8px 0;padding:8px 12px;background:#f9f9f9;border-radius:6px;">${data.agentHealth}</p>`
    : '';

  const hashtagsHtml = data.hashtagsScannedToday && data.hashtagsScannedToday.length > 0
    ? `<p style="font-size:12px;color:#888;margin:4px 0;">Hashtags scanned today: ${data.hashtagsScannedToday.map(h => '#' + h).join(', ')}</p>`
    : '';

  return baseTemplate('Daily Social Digest', `
<p>Here's your daily social media intelligence for Paw Cities.</p>

${storyReposts.length > 0 ? `
<h3 style="margin:24px 0 8px;font-size:16px;color:#c2410c;border-bottom:2px solid #c2410c;padding-bottom:4px;">Story Repost Candidates (${storyReposts.length})</h3>
<p style="font-size:13px;color:#666;margin:0 0 8px;">High-engagement posts perfect for sharing to your Instagram Story:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border:1px solid #fed7aa;border-radius:8px;">
${storyRepostHtml}
</table>
` : ''}

<h3 style="margin:24px 0 8px;font-size:16px;color:#1a1a1a;border-bottom:2px solid #ea580c;padding-bottom:4px;">Engagement Opportunities (${data.totalPendingOpportunities} pending)</h3>
<p style="font-size:13px;color:#666;margin:0 0 8px;">Posts from the dog-friendly community to comment on and build connections:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border:1px solid #e5e5e5;border-radius:8px;">
${opportunitiesHtml}
</table>

<h3 style="margin:24px 0 8px;font-size:16px;color:#1a1a1a;border-bottom:2px solid #ea580c;padding-bottom:4px;">Unreplied Comments on Our Posts (${data.unrepliedComments.length})</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border:1px solid #e5e5e5;border-radius:8px;">
${commentsHtml}
</table>

<h3 style="margin:24px 0 8px;font-size:16px;color:#1a1a1a;border-bottom:2px solid #ea580c;padding-bottom:4px;">Our Post Performance</h3>
<p style="font-size:14px;">Posts tracked: ${data.engagementSummary.postsTracked} &middot; Avg likes: ${data.engagementSummary.avgLikes} &middot; Avg comments: ${data.engagementSummary.avgComments}</p>
${topPostHtml}

${ctaButton('Review All in Dashboard', `${getAppUrl()}/admin/social`)}

${agentHealthHtml}
${hashtagsHtml}
<p style="font-size:12px;color:#aaa;margin-top:16px;">This digest is sent daily at 11 AM UTC. Reply to this email with feedback or new hashtags/accounts to monitor.</p>
`);
}

export async function sendSocialDigest(data: SocialDigestData): Promise<EmailResult> {
  if (getAdminEmails().length === 0) {
    console.warn('[EMAIL] No ADMIN_EMAILS configured, skipping social digest');
    return { success: false, error: 'No admin emails configured' };
  }

  // Build a more actionable subject line
  const storyCount = data.newOpportunities.filter(o => o.category === 'story_repost').length;
  const opCount = data.totalPendingOpportunities;
  const commentCount = data.unrepliedComments.length;

  const parts: string[] = [];
  if (storyCount > 0) parts.push(`${storyCount} story repost${storyCount > 1 ? 's' : ''}`);
  if (opCount > 0) parts.push(`${opCount} opportunities`);
  if (commentCount > 0) parts.push(`${commentCount} unreplied comment${commentCount > 1 ? 's' : ''}`);

  const subject = parts.length > 0
    ? `Paw Cities Social: ${parts.join(', ')}`
    : 'Paw Cities Social: Daily check-in (all clear)';

  return sendEmail(getAdminEmails(), subject, socialDigestTemplate(data));
}

// ——— Unified Marketing Digest Email ————————————————————————————————————————

export interface MarketingDigestData {
  // System health
  health: {
    overall: 'healthy' | 'warning' | 'critical';
    checks: { name: string; status: 'healthy' | 'warning' | 'critical'; message: string }[];
    summary: string;
  };
  // Posts published yesterday
  postsPublished: {
    count: number;
    posts: { headline: string; city: string; likes: number; comments: number; permalink: string }[];
  };
  // Comment engagement
  commentActivity: {
    newComments: number;
    autoReplied: number;
    autoReplyErrors: number;
    questionsNeedingReply: number;
    negativesNeedingReview: number;
    spamBlocked: number;
    totalUnrepliedManual: number;
    recentComments: { username: string; text: string; sentiment: string; replied: boolean }[];
  };
  // Top content performance
  topContent: {
    postsTracked: number;
    avgLikes: number;
    avgComments: number;
    topPost: { permalink: string; likes: number; comments: number; caption: string } | null;
  };
  // Outreach opportunities
  outreach: {
    newOpportunities: number;
    totalPending: number;
    storyRepostCandidates: number;
    topOpportunities: { permalink: string; caption: string; category: string; likes: number; suggestedReply: string }[];
  };
  // Community
  community: {
    vips: { username: string; commentCount: number }[];
    newCommentersToday: number;
    totalUniqueCommenters: number;
  };
  // Events (if any discovered this week)
  events?: {
    newDiscovered: number;
    pendingReview: number;
  };
  // Hashtags scanned
  hashtagsScanned?: string[];
}

function sectionHeader(emoji: string, title: string, subtitle?: string): string {
  return `
    <tr><td style="padding:24px 0 8px;">
      <h2 style="margin:0;font-size:18px;font-weight:700;color:#1a1a1a;border-bottom:2px solid #ea580c;padding-bottom:6px;">${emoji} ${title}</h2>
      ${subtitle ? `<p style="margin:4px 0 0;font-size:13px;color:#888;">${subtitle}</p>` : ''}
    </td></tr>`;
}

function statBox(label: string, value: string | number, color: string = '#ea580c'): string {
  return `<td style="text-align:center;padding:12px;">
    <div style="font-size:24px;font-weight:700;color:${color};">${value}</div>
    <div style="font-size:12px;color:#888;margin-top:2px;">${label}</div>
  </td>`;
}

export async function sendMarketingDigest(data: MarketingDigestData): Promise<EmailResult> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    console.error('[EMAIL] No ADMIN_EMAILS configured — cannot send marketing digest');
    return { success: false, error: 'No ADMIN_EMAILS configured' };
  }

  const statusEmoji: Record<string, string> = { healthy: '✅', warning: '⚠️', critical: '🚨' };
  const statusColor: Record<string, string> = { healthy: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ─── Health Status Banner ──────────────────────────
  const healthBanner = `
    <div style="background:${statusColor[data.health.overall]}15;border:1px solid ${statusColor[data.health.overall]}40;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
      <strong style="color:${statusColor[data.health.overall]};">${statusEmoji[data.health.overall]} Systems: ${data.health.overall.toUpperCase()}</strong>
      <span style="color:#6b7280;font-size:13px;margin-left:8px;">${data.health.summary}</span>
    </div>`;

  // Show individual health checks only if not healthy
  const healthDetailsHtml = data.health.overall !== 'healthy'
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin:8px 0 16px;">
        ${data.health.checks
          .filter(c => c.status !== 'healthy')
          .map(c => `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">${statusEmoji[c.status]} ${c.name}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#6b7280;">${c.message}</td>
          </tr>`).join('')}
       </table>`
    : '';

  // ─── Quick Stats Row ──────────────────────────────
  const quickStats = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fef3e8;border-radius:8px;">
      <tr>
        ${statBox('Posts', data.postsPublished.count)}
        ${statBox('New Comments', data.commentActivity.newComments)}
        ${statBox('Auto-Replied', data.commentActivity.autoReplied, '#22c55e')}
        ${statBox('Needs You', data.commentActivity.questionsNeedingReply + data.commentActivity.negativesNeedingReview, data.commentActivity.questionsNeedingReply + data.commentActivity.negativesNeedingReview > 0 ? '#f59e0b' : '#22c55e')}
      </tr>
    </table>`;

  // ─── Posts Published ──────────────────────────────
  const postsHtml = data.postsPublished.posts.length > 0
    ? data.postsPublished.posts.map(p => `
        <tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
          <strong>${p.headline}</strong> <span style="color:#888;font-size:12px;">(${p.city})</span>
          <br/><span style="font-size:12px;color:#666;">❤️ ${p.likes} · 💬 ${p.comments}</span>
          <a href="${p.permalink}" style="font-size:12px;color:#ea580c;margin-left:8px;">View →</a>
        </td></tr>`).join('')
    : '<tr><td style="padding:8px 12px;color:#888;">No posts published yesterday. Next scheduled: check vercel.json cron.</td></tr>';

  // ─── Comment Activity ─────────────────────────────
  const manualActionItems: string[] = [];
  if (data.commentActivity.questionsNeedingReply > 0) {
    manualActionItems.push(`❓ ${data.commentActivity.questionsNeedingReply} question${data.commentActivity.questionsNeedingReply > 1 ? 's' : ''} need your reply`);
  }
  if (data.commentActivity.negativesNeedingReview > 0) {
    manualActionItems.push(`⚠️ ${data.commentActivity.negativesNeedingReview} negative comment${data.commentActivity.negativesNeedingReview > 1 ? 's' : ''} to review`);
  }
  if (data.commentActivity.spamBlocked > 0) {
    manualActionItems.push(`🚫 ${data.commentActivity.spamBlocked} spam comment${data.commentActivity.spamBlocked > 1 ? 's' : ''} detected`);
  }

  const manualItemsHtml = manualActionItems.length > 0
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:8px 0;">
        <strong style="color:#991b1b;font-size:13px;">Action Required:</strong><br/>
        ${manualActionItems.map(item => `<span style="display:block;font-size:13px;color:#7f1d1d;margin:4px 0;">${item}</span>`).join('')}
       </div>`
    : '<p style="font-size:13px;color:#22c55e;margin:8px 0;">✅ All comments handled automatically — nothing needs your attention!</p>';

  const recentCommentsHtml = data.commentActivity.recentComments.length > 0
    ? data.commentActivity.recentComments.slice(0, 5).map(c => {
        const sentimentBadge = c.sentiment === 'question' ? '❓' : c.sentiment === 'negative' ? '⚠️' : c.sentiment === 'spam' ? '🚫' : c.replied ? '✅' : '💬';
        return `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">
          ${sentimentBadge} <strong>@${c.username}:</strong> ${c.text.substring(0, 100)}${c.text.length > 100 ? '...' : ''}
          ${c.replied ? '<span style="color:#22c55e;font-size:11px;"> (replied)</span>' : ''}
        </td></tr>`;
      }).join('')
    : '';

  // ─── Outreach Opportunities ───────────────────────
  const outreachHtml = data.outreach.topOpportunities.length > 0
    ? data.outreach.topOpportunities.slice(0, 5).map(o => `
        <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:11px;color:#ea580c;font-weight:600;text-transform:uppercase;">${o.category} · ${o.likes} likes</span>
          <p style="margin:4px 0;font-size:13px;color:#333;">${o.caption.substring(0, 120)}${o.caption.length > 120 ? '...' : ''}</p>
          <p style="margin:2px 0;font-size:12px;color:#ea580c;font-style:italic;">"${o.suggestedReply.substring(0, 100)}${o.suggestedReply.length > 100 ? '...' : ''}"</p>
          <a href="${o.permalink}" style="font-size:12px;color:#ea580c;">Engage on Instagram →</a>
        </td></tr>`).join('')
    : '<tr><td style="padding:10px 12px;color:#888;font-size:13px;">No new opportunities found today.</td></tr>';

  // ─── Community ────────────────────────────────────
  const vipHtml = data.community.vips.length > 0
    ? `<p style="font-size:13px;color:#333;margin:8px 0;">
        <strong>Top Fans:</strong> ${data.community.vips.slice(0, 5).map(v => `@${v.username} (${v.commentCount} comments)`).join(' · ')}
       </p>`
    : '';

  const communityGrowthHtml = `
    <p style="font-size:13px;color:#666;margin:4px 0;">
      ${data.community.newCommentersToday > 0 ? `🆕 ${data.community.newCommentersToday} new people engaged today · ` : ''}
      ${data.community.totalUniqueCommenters} total unique commenters · ${data.community.vips.length} VIP fans (3+ comments)
    </p>`;

  // ─── Events ───────────────────────────────────────
  const eventsHtml = data.events
    ? `${sectionHeader('📅', 'Events', 'Weekly discovery results')}
       <tr><td style="padding:8px 0;">
         <p style="font-size:13px;color:#333;margin:4px 0;">
           ${data.events.newDiscovered} new event candidates discovered · ${data.events.pendingReview} pending review
         </p>
         ${ctaButton('Review Events', `${getAppUrl()}/admin/events`)}
       </td></tr>`
    : '';

  // ─── Hashtags ─────────────────────────────────────
  const hashtagsHtml = data.hashtagsScanned && data.hashtagsScanned.length > 0
    ? `<p style="font-size:11px;color:#aaa;margin:4px 0;">Hashtags scanned: ${data.hashtagsScanned.map(h => '#' + h).join(', ')}</p>`
    : '';

  // ─── Assemble the full email ──────────────────────
  const html = baseTemplate(`🐾 Daily Marketing Digest — ${today}`, `
    ${healthBanner}
    ${healthDetailsHtml}
    ${quickStats}

    ${sectionHeader('📬', 'Posts Published', 'Content posted in the last 24 hours')}
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;font-size:14px;">
        ${postsHtml}
      </table>
    </td></tr>

    ${sectionHeader('💬', 'Comment Activity', `${data.commentActivity.newComments} new · ${data.commentActivity.autoReplied} auto-replied`)}
    <tr><td>
      ${manualItemsHtml}
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;margin:8px 0;">
        ${recentCommentsHtml}
      </table>
      ${data.commentActivity.autoReplyErrors > 0 ? `<p style="font-size:12px;color:#ef4444;">⚠️ ${data.commentActivity.autoReplyErrors} auto-reply failures — check Vercel logs</p>` : ''}
    </td></tr>

    ${sectionHeader('🎯', 'Engagement Opportunities', `${data.outreach.newOpportunities} new · ${data.outreach.totalPending} total pending`)}
    <tr><td>
      ${data.outreach.storyRepostCandidates > 0 ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 16px;margin:8px 0;"><strong style="color:#c2410c;">📱 ${data.outreach.storyRepostCandidates} Story Repost Candidate${data.outreach.storyRepostCandidates > 1 ? 's' : ''}</strong> — high-engagement posts perfect for your story!</div>` : ''}
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;">
        ${outreachHtml}
      </table>
    </td></tr>

    ${sectionHeader('👥', 'Community', 'Who\'s engaging with Paw Cities')}
    <tr><td>
      ${vipHtml}
      ${communityGrowthHtml}
    </td></tr>

    ${eventsHtml}

    ${sectionHeader('📊', 'Content Performance', `Tracking ${data.topContent.postsTracked} posts`)}
    <tr><td>
      <p style="font-size:13px;color:#333;margin:4px 0;">
        Avg likes: <strong>${data.topContent.avgLikes}</strong> · Avg comments: <strong>${data.topContent.avgComments}</strong>
      </p>
      ${data.topContent.topPost ? `<p style="font-size:13px;color:#333;margin:4px 0;">Best performer: <strong>${data.topContent.topPost.likes} likes, ${data.topContent.topPost.comments} comments</strong> — <a href="${data.topContent.topPost.permalink}" style="color:#ea580c;">View →</a></p>` : ''}
    </td></tr>

    <tr><td style="padding:24px 0 0;">
      ${ctaButton('Open Social Command Center', `${getAppUrl()}/admin/social`)}
    </td></tr>

    ${hashtagsHtml}
    <p style="font-size:11px;color:#aaa;margin-top:16px;">This digest runs daily. Auto-replies are capped at 15/day to keep engagement natural. Questions and negative comments are flagged for your personal attention.</p>
  `);

  // Subject line reflects what needs attention
  const actionCount = data.commentActivity.questionsNeedingReply + data.commentActivity.negativesNeedingReview;
  const subject = actionCount > 0
    ? `🐾 Paw Cities Daily: ${data.postsPublished.count} posts, ${data.commentActivity.autoReplied} auto-replies, ${actionCount} need you`
    : `🐾 Paw Cities Daily: ${data.postsPublished.count} posts, ${data.commentActivity.autoReplied} auto-replies — all handled ✅`;

  const result = await sendEmail(adminEmails, subject, html);
  if (!result.success) {
    console.error(`[EMAIL] Marketing digest FAILED: ${result.error}`);
  } else {
    console.log(`[EMAIL] Marketing digest sent to ${adminEmails.join(', ')}`);
  }
  return result;
}

// ——— Health Report Email (kept for standalone health checks) ————————————————

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
}

interface HealthReportData {
  timestamp: string;
  overall: 'healthy' | 'warning' | 'critical';
  checks: HealthCheck[];
  summary: string;
}

export async function sendHealthReport(report: HealthReportData): Promise<EmailResult> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    console.error('[EMAIL] No ADMIN_EMAILS configured — cannot send health report');
    return { success: false, error: 'No ADMIN_EMAILS configured' };
  }

  const statusEmoji: Record<string, string> = { healthy: '✅', warning: '⚠️', critical: '🚨' };
  const statusColor: Record<string, string> = { healthy: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

  const checksHtml = report.checks.map(c => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;">${statusEmoji[c.status]} ${c.name}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:${statusColor[c.status]};font-weight:600;">${c.status.toUpperCase()}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">${c.message}</td>
    </tr>
  `).join('');

  const subject = report.overall === 'healthy'
    ? '✅ PawCities Daily Health — All Systems Go'
    : report.overall === 'warning'
      ? '⚠️ PawCities Health Alert — Issues Detected'
      : '🚨 PawCities CRITICAL — Immediate Action Needed';

  const html = baseTemplate(`${statusEmoji[report.overall]} Health Report`, `
    <div style="background:${statusColor[report.overall]}15;border:1px solid ${statusColor[report.overall]}40;border-radius:8px;padding:16px;margin-bottom:20px;">
      <strong style="color:${statusColor[report.overall]};font-size:16px;">${statusEmoji[report.overall]} Overall: ${report.overall.toUpperCase()}</strong>
      <p style="margin:8px 0 0;color:#374151;font-size:14px;">${report.summary}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 16px;text-align:left;font-weight:600;">Service</th>
        <th style="padding:10px 16px;text-align:left;font-weight:600;">Status</th>
        <th style="padding:10px 16px;text-align:left;font-weight:600;">Details</th>
      </tr></thead>
      <tbody>${checksHtml}</tbody>
    </table>
    ${ctaButton('View Health Dashboard', `${getAppUrl()}/admin/health`)}
    <p style="font-size:12px;color:#aaa;margin-top:16px;">Sent daily at 7 AM UTC by the PawCities health monitor.</p>
  `);

  const result = await sendEmail(adminEmails, subject, html);
  if (!result.success) {
    console.error(`[EMAIL] Health report email FAILED: ${result.error}`);
  } else {
    console.log(`[EMAIL] Health report sent to ${adminEmails.join(', ')}`);
  }
  return result;
}

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

const EMAIL_FROM = process.env.EMAIL_FROM || 'Paw Cities <noreply@pawcities.com>';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pawcities.com';

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
      from: EMAIL_FROM,
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
  <p style="margin:4px 0 0;font-size:12px;color:#b89b78;"><a href="${APP_URL}" style="color:#ea580c;text-decoration:none;">${APP_URL}</a></p>
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
<p>In the meantime, you can check the status of your claim from your dashboard.</p>
${ctaButton('View Your Dashboard', `${APP_URL}/business`)}
<p style="font-size:13px;color:#888;">If you didn&rsquo;t submit this claim, you can safely ignore this email.</p>
`);
}

function claimApprovedTemplate(businessName: string): string {
  return baseTemplate('Claim Approved!', `
<p>Great news! Your claim for <strong>${businessName}</strong> has been approved.</p>
<p>Your listing is now <strong>active</strong> on Paw Cities and you have full access to manage it. Here&rsquo;s what you can do:</p>
<ul style="padding-left:20px;margin:16px 0;">
  <li style="margin-bottom:8px;">Edit your listing details, hours, and photos</li>
  <li style="margin-bottom:8px;">View analytics and track visitors</li>
  <li style="margin-bottom:8px;">Respond to reviews (Bronze+ plan)</li>
  <li style="margin-bottom:8px;">Create events and special offers (Silver+ plan)</li>
</ul>
${ctaButton('Go to Your Dashboard', `${APP_URL}/business`)}
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
${ctaButton('Submit a New Claim', `${APP_URL}/business/claim`)}
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
${ctaButton('Review in Admin Dashboard', `${APP_URL}/admin/claims`)}
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
  if (ADMIN_EMAILS.length === 0) {
    console.warn('[EMAIL] No ADMIN_EMAILS configured, skipping admin alert');
    return { success: false, error: 'No admin emails configured' };
  }

  return sendEmail(
    ADMIN_EMAILS,
    `New claim: ${businessName}`,
    newClaimAdminAlertTemplate(businessName, contactName, contactEmail, verificationMethod)
  );
}

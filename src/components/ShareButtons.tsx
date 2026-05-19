'use client';

import { useState } from 'react';

interface ShareButtonsProps {
  /** Full URL to share */
  url: string;
  /** Share title/text */
  title: string;
  /** Optional description for platforms that support it */
  description?: string;
  /** Compact mode: just icons, no labels */
  compact?: boolean;
  /** Track share events via analytics */
  onShare?: (platform: string) => void;
}

export default function ShareButtons({
  url,
  title,
  description,
  compact = false,
  onShare,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  // Add UTM parameters for attribution
  const shareUrl = (platform: string) => {
    const u = new URL(url);
    u.searchParams.set('utm_source', platform);
    u.searchParams.set('utm_medium', 'social');
    u.searchParams.set('utm_campaign', 'share');
    return u.toString();
  };

  const trackShare = (platform: string) => {
    onShare?.(platform);
    // Also fire analytics event
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'click_share', metadata: { platform, url } }),
    }).catch(() => {});
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl('copy_link'));
      setCopied(true);
      trackShare('copy_link');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl('copy_link');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      trackShare('copy_link');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    trackShare('whatsapp');
    const text = `${title}${description ? `\n${description}` : ''}\n${shareUrl('whatsapp')}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleTwitter = () => {
    trackShare('twitter');
    const text = `${title} ${shareUrl('twitter')}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description || title,
          url: shareUrl('native_share'),
        });
        trackShare('native_share');
      } catch {
        // User cancelled — that's fine
      }
    }
  };

  const handleEmail = () => {
    trackShare('email');
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${description || title}\n\nCheck it out: ${shareUrl('email')}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const btnClass = compact
    ? 'p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors text-xs font-medium';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Native share (mobile) */}
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button onClick={handleNativeShare} className={btnClass} title="Share">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {!compact && 'Share'}
        </button>
      )}

      {/* Copy link */}
      <button onClick={handleCopyLink} className={btnClass} title="Copy link">
        {copied ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        )}
        {!compact && (copied ? 'Copied!' : 'Copy Link')}
      </button>

      {/* WhatsApp */}
      <button onClick={handleWhatsApp} className={btnClass} title="Share on WhatsApp">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        {!compact && 'WhatsApp'}
      </button>

      {/* Twitter / X */}
      <button onClick={handleTwitter} className={btnClass} title="Share on X">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        {!compact && 'X'}
      </button>

      {/* Email */}
      <button onClick={handleEmail} className={btnClass} title="Share via email">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {!compact && 'Email'}
      </button>
    </div>
  );
}

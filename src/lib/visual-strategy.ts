/**
 * Visual Strategy for Paw Cities Social Media
 *
 * Routes content types to distinct visual styles to create a varied,
 * engaging Instagram grid instead of all-mascot monotony.
 *
 * Three visual styles:
 *   mascot    — DALL-E illustrated Buster/Marley (brand personality)
 *   photo     — Real photography with brand overlay (credibility + events)
 *   text_card — Bold orange/white branded card (tips + guides)
 */

// ─── Visual Style Types ──────────────────────────────────────────────────────

export type VisualStyle = 'mascot' | 'photo' | 'text_card';
export type ContentType = 'did-you-know' | 'tip' | 'spotlight' | 'event' | 'guide' | 'fun';

// ─── Content Type → Visual Style Mapping ─────────────────────────────────────

const STYLE_MAP: Record<ContentType, VisualStyle> = {
  'did-you-know': 'mascot',     // Mascots bring personality to fun facts
  'fun':          'mascot',     // Perfect for playful mascot illustrations
  'spotlight':    'photo',      // Real business photos = credibility
  'event':        'photo',      // Real event images = professionalism for sponsors
  'tip':          'text_card',  // Clean branded cards for quick-read tips
  'guide':        'text_card',  // Clean branded cards for guides/rankings
};

/**
 * Get the visual style for a content type.
 */
export function getVisualStyle(contentType: string): VisualStyle {
  return STYLE_MAP[contentType as ContentType] || 'mascot';
}

/**
 * Check if a content type should use mascot illustration.
 */
export function shouldUseMascot(contentType: string): boolean {
  return getVisualStyle(contentType) === 'mascot';
}

/**
 * Check if a content type should use real photography.
 */
export function shouldUsePhoto(contentType: string): boolean {
  return getVisualStyle(contentType) === 'photo';
}

/**
 * Check if a content type should use a branded text card.
 */
export function shouldUseTextCard(contentType: string): boolean {
  return getVisualStyle(contentType) === 'text_card';
}

// ─── Grid Diversity Logic ────────────────────────────────────────────────────

/**
 * Given the formats of recently posted creatives, determine which visual style
 * to prefer next for maximum grid diversity.
 *
 * Rules:
 * - Never post the same visual style 3 times in a row
 * - Prefer alternating between the 3 styles
 * - If the last 2 posts were the same style, the next MUST be different
 */
export function getPreferredStyle(recentFormats: string[]): VisualStyle | null {
  if (recentFormats.length < 2) return null; // Not enough history to enforce

  const last = recentFormats[0];
  const secondLast = recentFormats[1];

  // If last 2 are the same style, MUST pick a different one
  if (last === secondLast) {
    const styles: VisualStyle[] = ['mascot', 'photo', 'text_card'];
    return styles.find(s => s !== last) || null;
  }

  return null; // No strong preference — any style is fine
}

/**
 * Score a creative candidate based on grid diversity.
 * Higher score = better fit for the next post.
 */
export function diversityScore(
  candidateFormat: string,
  recentFormats: string[]
): number {
  if (recentFormats.length === 0) return 1.0;

  let score = 1.0;

  // Penalty for matching the most recent post format
  if (recentFormats[0] === candidateFormat) score -= 0.5;

  // Bigger penalty for matching both recent posts (would make 3 in a row)
  if (recentFormats.length >= 2 && recentFormats[0] === candidateFormat && recentFormats[1] === candidateFormat) {
    score -= 1.0; // Effectively disqualifies this candidate
  }

  // Bonus for a format that hasn't appeared recently
  if (!recentFormats.slice(0, 3).includes(candidateFormat)) {
    score += 0.3;
  }

  return score;
}

// ─── Caption Style by Visual Style ───────────────────────────────────────────

/**
 * For photo-based posts, captions should be more informational and less
 * character-driven. For mascot posts, character voice is the star.
 * For text cards, the caption complements the card content.
 */
export function getCaptionStyle(visualStyle: VisualStyle): 'character' | 'informational' | 'complementary' {
  switch (visualStyle) {
    case 'mascot': return 'character';          // Buster/Marley voice
    case 'photo': return 'informational';       // Clean, factual, professional
    case 'text_card': return 'complementary';   // Expand on what the card shows
  }
}

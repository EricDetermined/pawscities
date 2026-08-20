/**
 * AI Photo Curation for Paw Cities Creatives
 *
 * The keyword scorer in `dog-photos.ts` handles the mechanical signals well —
 * breed named in the headline, city setting, activity vibe, brightness. What it
 * cannot do is read intent. It has no way to know that a post about foxtail
 * seeds burrowing into paws wants a bright, alert outdoor dog rather than a
 * moody studio portrait, or that "Dogs Ride Trains in Carriers" is about
 * commuting rather than about any particular breed.
 *
 * This module puts a model in front of the scorer to make that judgement, and
 * falls back to the scorer whenever the model is unavailable, slow, or returns
 * something we can't trust.
 *
 * Design rules:
 *   1. NEVER block creative generation on the model. Timeout is short and every
 *      failure path returns the deterministic pick.
 *   2. The model CHOOSES FROM the tagged library — it cannot invent a photo id,
 *      so a hallucination degrades to the fallback rather than a broken image.
 *   3. The model is told which breeds we do not stock, so it cannot substitute a
 *      wrong breed. Same rule the scorer follows.
 */

import OpenAI from 'openai';
import {
  DOG_PHOTOS,
  detectTone,
  pickContextualDogPhotoWithId,
  photoUrlFromId,
  type PhotoContext,
} from './dog-photos';

const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 8000;

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export interface CuratedPhoto {
  url: string;
  photoId: string;
  /** How the choice was made — surfaced so admin/debug can tell them apart. */
  source: 'ai' | 'scorer';
  reason?: string;
}

/**
 * Compact catalogue for the prompt. Kept terse deliberately: the full library is
 * ~58 rows and we send it on every call, so verbosity here is pure cost.
 */
function buildCatalogue(candidateIds: Set<string> | null): string {
  return DOG_PHOTOS
    .filter((p) => !candidateIds || candidateIds.has(p.id))
    .map(
      (p) =>
        `${p.id} | ${p.breed} | ${p.setting} | ${p.vibe} | brightness ${p.brightness.toFixed(2)}`,
    )
    .join('\n');
}

/**
 * Ask the model to pick the most editorially appropriate photo.
 * Returns null on any failure so the caller can fall back.
 */
async function aiSelect(
  context: PhotoContext,
  excludeIds: Set<string>,
): Promise<{ photoId: string; reason: string } | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const eligible = DOG_PHOTOS.filter((p) => !excludeIds.has(p.id));
  if (eligible.length === 0) return null;

  const tone = context.tone || detectTone(`${context.text} ${context.description || ''}`);
  const catalogue = buildCatalogue(new Set(eligible.map((p) => p.id)));

  const prompt = `You are the photo editor for Paw Cities, a dog-friendly city guide. Pick the single best stock photo for this social card.

POST
Headline: ${context.text}
Body: ${context.description || '(none)'}
City: ${context.citySlug}
Editorial tone: ${tone}

PHOTO LIBRARY (id | breed | setting | vibe | brightness 0-1)
${catalogue}

RULES
1. If the post is about a specific dog breed, you MUST pick that breed. If that breed is not in the library above, pick a neutral mixed-breed or generic dog instead — NEVER substitute a different named breed. Showing the wrong breed is the worst possible error.
2. The headline text is overlaid on the lower half of this photo, so brightness below 0.35 is hard to read. Prefer 0.45+ unless there is a strong reason.
3. Match the tone. A warning or safety post needs a clear, alert, daylit dog — not a dark, sombre or sleepy one. A celebration needs energy and light. A practical guide can be calm.
4. Match the city setting where it is plausible (beach for coastal cities, urban for Tokyo/NYC, cafe for Paris).
5. The photo must not contradict the copy. A post about walking in heat should not show a snow scene.

Reply with ONLY compact JSON: {"id":"<photo id>","reason":"<max 12 words>"}`;

  try {
    const res = await openai.chat.completions.create(
      {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 80,
        response_format: { type: 'json_object' },
      },
      { timeout: TIMEOUT_MS },
    );

    const raw = res.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { id?: string; reason?: string };
    if (!parsed.id) return null;

    // The model may only choose from the library — anything else is discarded.
    // It reliably drops the shared "photo-" prefix, so normalise before matching
    // rather than throwing away an otherwise valid choice.
    const wanted = String(parsed.id).trim().replace(/^photo-/, '');
    const match = eligible.find((p) => p.id.replace(/^photo-/, '') === wanted);
    if (!match) {
      console.error(`[PHOTO-CURATOR] Model returned unknown id "${parsed.id}" — falling back`);
      return null;
    }

    return { photoId: match.id, reason: (parsed.reason || '').slice(0, 80) };
  } catch (err) {
    console.error('[PHOTO-CURATOR] AI selection failed, using scorer:', err);
    return null;
  }
}

/**
 * Pick a photo for a creative: model first, deterministic scorer as fallback.
 */
export async function curatePhoto(
  context: PhotoContext,
  format: 'square' | 'wide' = 'wide',
): Promise<CuratedPhoto> {
  const excludeIds = new Set(context.recentlyUsedPhotoIds || []);

  const ai = await aiSelect(context, excludeIds);
  if (ai) {
    return {
      url: photoUrlFromId(ai.photoId, format),
      photoId: ai.photoId,
      source: 'ai',
      reason: ai.reason,
    };
  }

  const picked = pickContextualDogPhotoWithId(context, format);
  return { url: picked.url, photoId: picked.photoId, source: 'scorer' };
}

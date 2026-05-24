/**
 * Instagram / Meta Graph API client for PawCities auto-posting
 *
 * Two-step publishing flow:
 * 1. Create a media container (image + caption)
 * 2. Publish the container
 *
 * Requires env vars:
 *   META_PAGE_ACCESS_TOKEN
 *   INSTAGRAM_ACCOUNT_ID
 *   META_API_VERSION (default: v25.0)
 */

// Read at request time, not build time
function getMetaApiVersion() { return process.env.META_API_VERSION || 'v25.0'; }
function getBaseUrl() { return `https://graph.facebook.com/${getMetaApiVersion()}`; }

interface MediaContainerResponse {
  id: string;
}

interface PublishResponse {
  id: string;
}

interface MediaStatusResponse {
  status_code: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
}

export interface InstagramPostResult {
  success: boolean;
  postId?: string;
  containerId?: string;
  error?: string;
  permalink?: string;
}

/**
 * Create an Instagram media container for a single image post
 */
export async function createMediaContainer(
  imageUrl: string,
  caption: string,
): Promise<{ containerId: string } | { error: string }> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!token || !accountId) {
    return { error: 'Instagram credentials not configured (META_PAGE_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID)' };
  }

  try {
    const url = `${getBaseUrl()}/${accountId}/media`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: token,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const errMsg = data.error?.message || `HTTP ${res.status}`;
      console.error('Instagram createMediaContainer error:', data);
      return { error: `Failed to create media container: ${errMsg}` };
    }

    return { containerId: (data as MediaContainerResponse).id };
  } catch (err) {
    console.error('Instagram createMediaContainer exception:', err);
    return { error: `Network error creating media container: ${String(err)}` };
  }
}

/**
 * Create an Instagram carousel media container (multiple images)
 */
export async function createCarouselContainer(
  imageUrls: string[],
  caption: string,
): Promise<{ containerId: string } | { error: string }> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!token || !accountId) {
    return { error: 'Instagram credentials not configured' };
  }

  try {
    // Step 1: Create individual image containers (children)
    const childIds: string[] = [];
    for (const imageUrl of imageUrls) {
      const url = `${getBaseUrl()}/${accountId}/media`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: token,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { error: `Failed to create carousel child: ${data.error?.message || res.status}` };
      }
      childIds.push(data.id);

      // Brief delay between child creation
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Step 2: Create the carousel container
    const url = `${getBaseUrl()}/${accountId}/media`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds,
        caption,
        access_token: token,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: `Failed to create carousel: ${data.error?.message || res.status}` };
    }

    return { containerId: data.id };
  } catch (err) {
    return { error: `Carousel creation error: ${String(err)}` };
  }
}

/**
 * Check the processing status of a media container
 */
export async function checkContainerStatus(
  containerId: string,
): Promise<MediaStatusResponse['status_code'] | 'ERROR'> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;

  try {
    const url = `${getBaseUrl()}/${containerId}?fields=status_code&access_token=${token}`;
    const res = await fetch(url);
    const data: MediaStatusResponse = await res.json();
    return data.status_code || 'ERROR';
  } catch {
    return 'ERROR';
  }
}

/**
 * Publish a processed media container
 */
export async function publishContainer(
  containerId: string,
): Promise<{ postId: string } | { error: string }> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!token || !accountId) {
    return { error: 'Instagram credentials not configured' };
  }

  try {
    const url = `${getBaseUrl()}/${accountId}/media_publish`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: token,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const errMsg = data.error?.message || `HTTP ${res.status}`;
      console.error('Instagram publishContainer error:', data);
      return { error: `Failed to publish: ${errMsg}` };
    }

    return { postId: (data as PublishResponse).id };
  } catch (err) {
    console.error('Instagram publishContainer exception:', err);
    return { error: `Network error publishing: ${String(err)}` };
  }
}

/**
 * Full publish flow: create container → wait for processing → publish
 *
 * Uses a hybrid approach:
 *   1. Try polling container status (fast path if Meta API allows it)
 *   2. If status polling fails with auth errors (Meta Graph API restriction),
 *      fall back to direct publish with exponential backoff retries
 *
 * This handles the Meta API v25.0+ issue where container status polling
 * returns Authorization Error (subcode 33) even with valid tokens.
 */
export async function publishImagePost(
  imageUrl: string,
  caption: string,
  maxRetries: number = 10,
): Promise<InstagramPostResult> {
  // Step 1: Create container
  const containerResult = await createMediaContainer(imageUrl, caption);
  if ('error' in containerResult) {
    return { success: false, error: containerResult.error };
  }

  const { containerId } = containerResult;

  // Step 2: Try polling for status first (may fail with auth error)
  let statusPollingWorks = true;
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const status = await checkContainerStatus(containerId);

    // If we get ERROR on the very first poll, it might be an auth issue
    // rather than an actual container error. Try direct publish instead.
    if (status === 'ERROR' && i === 0) {
      console.log('Instagram: status polling returned ERROR on first attempt — trying direct publish fallback');
      statusPollingWorks = false;
      break;
    }

    if (status === 'FINISHED') {
      const publishResult = await publishContainer(containerId);
      if ('error' in publishResult) {
        return { success: false, containerId, error: publishResult.error };
      }
      return {
        success: true,
        containerId,
        postId: publishResult.postId,
      };
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      return { success: false, containerId, error: `Container status: ${status}` };
    }
  }

  if (statusPollingWorks) {
    return { success: false, containerId, error: 'Container processing timed out' };
  }

  // Step 3: Fallback — direct publish with exponential backoff
  // Container creation succeeded, so we wait for processing and try to publish
  console.log('Instagram: using direct publish fallback (status polling unavailable)');
  const delays = [5000, 8000, 12000, 15000, 20000]; // Total ~60s of waiting

  for (let attempt = 0; attempt < delays.length; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delays[attempt]));

    const publishResult = await publishContainer(containerId);
    if (!('error' in publishResult)) {
      console.log(`Instagram: direct publish succeeded on attempt ${attempt + 1}`);
      return {
        success: true,
        containerId,
        postId: publishResult.postId,
      };
    }

    const errMsg = publishResult.error || '';
    // If the container isn't ready yet, Meta returns "Media not found or not available"
    // Keep retrying. But if it's a different error, stop.
    if (!errMsg.includes('not found') && !errMsg.includes('not available') && !errMsg.includes('not yet ready') && !errMsg.includes('IN_PROGRESS')) {
      // Check if it's a "media is not ready" style error — retry those
      if (attempt < delays.length - 1 && (errMsg.includes('9007') || errMsg.includes('2207026'))) {
        continue; // Known "not ready" error codes
      }
      return { success: false, containerId, error: `Direct publish failed: ${errMsg}` };
    }
  }

  return { success: false, containerId, error: 'Container processing timed out (direct publish fallback)' };
}

/**
 * Full carousel publish flow (with same direct-publish fallback)
 */
export async function publishCarouselPost(
  imageUrls: string[],
  caption: string,
  maxRetries: number = 15,
): Promise<InstagramPostResult> {
  const containerResult = await createCarouselContainer(imageUrls, caption);
  if ('error' in containerResult) {
    return { success: false, error: containerResult.error };
  }

  const { containerId } = containerResult;
  let statusPollingWorks = true;

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const status = await checkContainerStatus(containerId);

    if (status === 'ERROR' && i === 0) {
      statusPollingWorks = false;
      break;
    }

    if (status === 'FINISHED') {
      const publishResult = await publishContainer(containerId);
      if ('error' in publishResult) {
        return { success: false, containerId, error: publishResult.error };
      }
      return { success: true, containerId, postId: publishResult.postId };
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      return { success: false, containerId, error: `Container status: ${status}` };
    }
  }

  if (statusPollingWorks) {
    return { success: false, containerId, error: 'Carousel processing timed out' };
  }

  // Fallback: direct publish with backoff
  const delays = [5000, 8000, 12000, 15000, 20000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    const publishResult = await publishContainer(containerId);
    if (!('error' in publishResult)) {
      return { success: true, containerId, postId: publishResult.postId };
    }
  }

  return { success: false, containerId, error: 'Carousel processing timed out (direct publish fallback)' };
}

/**
 * Get recent media from the Instagram account (for checking what's been posted)
 */
export async function getRecentMedia(limit: number = 10): Promise<{
  posts: Array<{ id: string; caption?: string; media_url?: string; timestamp: string; permalink: string }>;
} | { error: string }> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!token || !accountId) {
    return { error: 'Instagram credentials not configured' };
  }

  try {
    const url = `${getBaseUrl()}/${accountId}/media?fields=id,caption,media_url,timestamp,permalink&limit=${limit}&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      return { error: data.error?.message || `HTTP ${res.status}` };
    }

    return { posts: data.data || [] };
  } catch (err) {
    return { error: `Failed to fetch media: ${String(err)}` };
  }
}

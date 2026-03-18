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

const META_API_VERSION = process.env.META_API_VERSION || 'v25.0';
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

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
    const url = `${BASE_URL}/${accountId}/media`;
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
      const url = `${BASE_URL}/${accountId}/media`;
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
    const url = `${BASE_URL}/${accountId}/media`;
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
    const url = `${BASE_URL}/${containerId}?fields=status_code&access_token=${token}`;
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
    const url = `${BASE_URL}/${accountId}/media_publish`;
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
 * Polls the container status up to maxRetries times
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

  // Step 2: Poll for processing completion
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between polls

    const status = await checkContainerStatus(containerId);

    if (status === 'FINISHED') {
      // Step 3: Publish
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

    // IN_PROGRESS — keep polling
  }

  return { success: false, containerId, error: 'Container processing timed out' };
}

/**
 * Full carousel publish flow
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

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const status = await checkContainerStatus(containerId);

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

  return { success: false, containerId, error: 'Carousel processing timed out' };
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
    const url = `${BASE_URL}/${accountId}/media?fields=id,caption,media_url,timestamp,permalink&limit=${limit}&access_token=${token}`;
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

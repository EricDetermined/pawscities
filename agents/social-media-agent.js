#!/usr/bin/env node
/**
 * PawCities Social Media Agent
 *
 * Agent-drafted, human-approved social media workflow.
 * Generates post drafts and engagement outreach, wife reviews & publishes in ~15 min/day.
 *
 * Usage:
 *   node social-media-agent.js generate                    # Generate new drafts from discovery data
 *   node social-media-agent.js generate --type showcase    # Generate a showcase post about PawCities
 *   node social-media-agent.js generate --type outreach    # Generate outreach drafts for handles
 *   node social-media-agent.js review                      # Show pending drafts for review
 *   node social-media-agent.js review --type post          # Only show post drafts
 *   node social-media-agent.js review --type comment       # Only show comment/engagement drafts
 *   node social-media-agent.js approve <id>                # Approve a draft
 *   node social-media-agent.js approve all                 # Approve all pending drafts
 *   node social-media-agent.js reject <id> [reason]        # Reject a draft
 *   node social-media-agent.js publish <id>                # Publish an approved post via Graph API
 *   node social-media-agent.js publish --next              # Publish next approved post
 *   node social-media-agent.js clipboard <id>              # Copy comment text to clipboard (for manual posting)
 *   node social-media-agent.js stats                       # Queue statistics
 *   node social-media-agent.js reset                       # Clear queue
 *
 * Environment:
 *   META_PAGE_ACCESS_TOKEN   - Instagram Graph API token
 *   INSTAGRAM_ACCOUNT_ID     - Instagram account ID (80768602466)
 *   META_API_VERSION          - Graph API version (default: v25.0)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const QUEUE_PATH = path.join(__dirname, '..', 'data', 'social-queue', 'queue.json');
const EVENTS_DIR = path.join(__dirname, '..', 'data', 'events');
const HANDLES_DIR = path.join(__dirname, '..', 'data', 'events');
const FOLLOWING_PATH = path.join(__dirname, '..', 'data', 'instagram-following.json');

const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || '80768602466';
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';
const META_API_VERSION = process.env.META_API_VERSION || 'v25.0';
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// City display names
const CITY_NAMES = {
  'los-angeles': 'Los Angeles',
  'new-york-city': 'New York City',
  'london': 'London',
  'tokyo': 'Tokyo',
  'paris': 'Paris',
  'barcelona': 'Barcelona',
  'geneva': 'Geneva',
  'sydney': 'Sydney',
};

// ─── Queue Management ────────────────────────────────────────────────────────

function loadQueue() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  } catch {
    return { drafts: [], meta: { created: new Date().toISOString(), lastGenerated: null } };
  }
}

function saveQueue(queue) {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

function generateId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Draft Generators ────────────────────────────────────────────────────────

/**
 * Generate showcase posts about PawCities features/events.
 * These get published on our own @thepawcities account.
 */
function generateShowcaseDrafts() {
  const drafts = [];
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // Load latest events data to pull real numbers
  let eventCount = 0;
  let cityCount = 0;
  let topEvents = [];

  try {
    const eventsFile = fs.readdirSync(EVENTS_DIR)
      .filter(f => f.startsWith('events-') && f.endsWith('.json'))
      .sort()
      .pop();

    if (eventsFile) {
      const eventsData = JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, eventsFile), 'utf-8'));
      eventCount = eventsData.totalUniqueEvents || 0;

      // Get top events by relevance
      const events = (eventsData.events || [])
        .filter(e => e.relevanceScore >= 70)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Count unique cities
      const cities = new Set(events.map(e => e.city));
      cityCount = cities.size;

      // Pick top events with specific dates mentioned
      topEvents = events
        .filter(e => e.fullCaption && (e.fullCaption.match(/May \d+|June \d+|Saturday|Sunday/) || e.fullCaption.includes('📅')))
        .slice(0, 10);
    }
  } catch (err) {
    console.error('Could not load events data:', err.message);
  }

  // ── Draft 1: Feature announcement post ──
  drafts.push({
    id: generateId(),
    type: 'post',
    category: 'showcase',
    status: 'pending',
    priority: 'high',
    createdAt: now.toISOString(),
    platform: 'instagram',
    content: {
      caption: `🐾 Big news for dog parents everywhere!\n\nWe just launched our event calendar across 7 cities worldwide. From pack walks in LA to dog festivals in Tokyo, we're tracking the best dog-friendly events so you never miss out.\n\n📍 7 cities: LA, NYC, London, Tokyo, Paris, Barcelona & Geneva\n📅 Updated weekly with new events\n🆓 Submit your own events at pawcities.com/events/submit\n\nKnow about a dog-friendly event in your city? Drop the details in comments or submit it on our site — our community helps curate the best events for pup parents worldwide.\n\n#PawCities #DogFriendlyEvents #DogFriendlyCity #DogsOfInstagram #DogEvents #PetFriendly #DogCommunity #DogTravel #DogLife`,
      imageNote: 'Use PawCities branded graphic with event calendar preview. Could show a collage of city icons with calendar dates, or a screenshot of the events page.',
      suggestedImageUrl: null,
    },
    targeting: {
      audience: 'followers + explore',
      goalFollows: true,
      goalTraffic: true,
    },
    notes: 'Feature announcement — should be posted first before outreach begins.',
  });

  // ── Draft 2: City spotlight with real event ──
  if (topEvents.length > 0) {
    const laEvents = topEvents.filter(e => e.city === 'los-angeles');
    const spotlightEvent = laEvents[0] || topEvents[0];
    const cityName = CITY_NAMES[spotlightEvent.city] || spotlightEvent.city;

    // Extract date from caption if possible
    const dateMatch = spotlightEvent.fullCaption?.match(/((?:Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday),?\s*)?(?:May|June|July|Aug)\s+\d{1,2}/i);
    const eventDate = dateMatch ? dateMatch[0] : 'Coming soon';

    drafts.push({
      id: generateId(),
      type: 'post',
      category: 'showcase',
      status: 'pending',
      priority: 'medium',
      createdAt: now.toISOString(),
      platform: 'instagram',
      content: {
        caption: `📅 ${cityName} dog event alert!\n\n${spotlightEvent.fullCaption?.split('\n')[0] || spotlightEvent.captionPreview?.split('\n')[0]}\n\n🗓 ${eventDate}\n📍 ${spotlightEvent.locationName || cityName}\n\nFind this and more dog-friendly events at pawcities.com — your go-to guide for exploring cities with your pup.\n\n${spotlightEvent.mentions?.length > 0 ? spotlightEvent.mentions.map(m => `@${m}`).join(' ') : ''}\n\n#PawCities #DogEvents${cityName.replace(/\s/g, '')} #DogFriendly${cityName.replace(/\s/g, '')} #DogsOf${cityName.replace(/\s/g, '')}`,
        imageNote: `Repost or reference image from @${spotlightEvent.ownerUsername}. Ask for permission first or use PawCities branded template with event details.`,
        suggestedImageUrl: spotlightEvent.imageUrl,
        sourcePostUrl: spotlightEvent.url,
      },
      targeting: {
        audience: `${cityName} dog community`,
        goalFollows: true,
        goalTraffic: true,
        tagAccounts: spotlightEvent.mentions || [],
      },
      notes: `Based on high-scoring discovery post from @${spotlightEvent.ownerUsername} (score: ${spotlightEvent.relevanceScore})`,
    });
  }

  // ── Draft 3: Multi-city roundup ──
  const citiesWithEvents = {};
  topEvents.forEach(e => {
    if (!citiesWithEvents[e.city]) citiesWithEvents[e.city] = [];
    if (citiesWithEvents[e.city].length < 2) citiesWithEvents[e.city].push(e);
  });

  if (Object.keys(citiesWithEvents).length >= 3) {
    let roundupLines = [];
    for (const [city, events] of Object.entries(citiesWithEvents).slice(0, 5)) {
      const cityName = CITY_NAMES[city] || city;
      const eventName = events[0].captionPreview?.split('\n')[0]?.slice(0, 60) || 'Dog-friendly event';
      roundupLines.push(`📍 ${cityName}: ${eventName}`);
    }

    drafts.push({
      id: generateId(),
      type: 'post',
      category: 'showcase',
      status: 'pending',
      priority: 'medium',
      createdAt: now.toISOString(),
      platform: 'instagram',
      content: {
        caption: `🌍 This week in dog-friendly events around the world:\n\n${roundupLines.join('\n\n')}\n\nAll events curated and verified by our community. Browse the full calendar at pawcities.com\n\nKnow an event we're missing? Submit it free at pawcities.com/events/submit ✨\n\n#PawCities #DogEvents #DogFriendly #DogTravel #DogsOfInstagram #PetFriendlyEvents #DogCommunity`,
        imageNote: 'Carousel post with one slide per city showing the event. Use branded PawCities template.',
        suggestedImageUrl: null,
      },
      targeting: {
        audience: 'global dog community',
        goalFollows: true,
        goalTraffic: true,
      },
      notes: 'Weekly roundup format — can be repeated each week with new events',
    });
  }

  return drafts;
}

/**
 * Generate outreach / engagement drafts.
 * These are comments and DMs to post on/to discovered handles.
 * Human copies text and posts manually (~15 sec each).
 */
function generateOutreachDrafts() {
  const drafts = [];
  const now = new Date();

  // Load new handles
  let newHandles = [];
  try {
    const handlesFile = fs.readdirSync(HANDLES_DIR)
      .filter(f => f.startsWith('new-handles-') && f.endsWith('.json'))
      .sort()
      .pop();

    if (handlesFile) {
      newHandles = JSON.parse(fs.readFileSync(path.join(HANDLES_DIR, handlesFile), 'utf-8'));
    }
  } catch (err) {
    console.error('Could not load handles:', err.message);
  }

  // Load events for context
  let events = [];
  try {
    const eventsFile = fs.readdirSync(EVENTS_DIR)
      .filter(f => f.startsWith('events-') && f.endsWith('.json'))
      .sort()
      .pop();

    if (eventsFile) {
      const eventsData = JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, eventsFile), 'utf-8'));
      events = eventsData.events || [];
    }
  } catch (err) {
    console.error('Could not load events:', err.message);
  }

  // Load existing following list to avoid re-engaging
  let following = [];
  try {
    const followingData = JSON.parse(fs.readFileSync(FOLLOWING_PATH, 'utf-8'));
    following = followingData.accounts || followingData || [];
  } catch {}
  const followingSet = new Set(following.map(f => (f.username || '').toLowerCase()));

  // ── Comment drafts for top event posts ──
  // Pick the highest-scoring posts that are actually events with dates
  const commentableEvents = events
    .filter(e => e.relevanceScore >= 60 && e.url)
    .filter(e => {
      const caption = (e.fullCaption || '').toLowerCase();
      return caption.includes('may') || caption.includes('june') || caption.includes('july') ||
             caption.includes('saturday') || caption.includes('sunday') || caption.includes('📅');
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 20);

  // Group by owner so we don't spam one account
  const byOwner = {};
  commentableEvents.forEach(e => {
    if (!byOwner[e.ownerUsername]) byOwner[e.ownerUsername] = [];
    byOwner[e.ownerUsername].push(e);
  });

  const commentTemplates = [
    (event, city) => `Love this! We just added this to our dog-friendly event calendar for ${city} on pawcities.com 🐾 Thanks for sharing!`,
    (event, city) => `This looks amazing! We track dog-friendly events across ${city} and 6 other cities — just featured this one 🙌`,
    (event, city) => `Great event! We're building a global calendar of dog-friendly events and this is exactly what the ${city} community needs 🐕`,
    (event, city) => `So cool! We curate dog-friendly events worldwide and just spotted this for ${city}. Added to pawcities.com! 📅🐾`,
    (event, city) => `What an awesome event for the ${city} dog community! We've been tracking these at pawcities.com — keep them coming! 🐶`,
  ];

  let templateIdx = 0;
  for (const [username, ownerEvents] of Object.entries(byOwner).slice(0, 15)) {
    const event = ownerEvents[0];
    const cityName = CITY_NAMES[event.city] || event.city;
    const template = commentTemplates[templateIdx % commentTemplates.length];

    drafts.push({
      id: generateId(),
      type: 'comment',
      category: 'outreach',
      status: 'pending',
      priority: event.relevanceScore >= 80 ? 'high' : 'medium',
      createdAt: now.toISOString(),
      platform: 'instagram',
      content: {
        text: template(event, cityName),
        targetPost: event.url,
        targetUsername: username,
        targetCity: event.city,
      },
      context: {
        postPreview: event.captionPreview?.slice(0, 120),
        relevanceScore: event.relevanceScore,
        likesCount: event.likesCount,
        eventSignals: event.eventSignals,
      },
      notes: `Comment on @${username}'s event post. Manual: open post → paste comment → post (~15 sec).`,
    });

    templateIdx++;
  }

  // ── Follow + engage drafts for high-value new handles ──
  const topNewHandles = newHandles
    .filter(h => h.avgRelevanceScore >= 40 && h.totalLikes >= 20)
    .filter(h => !followingSet.has(h.username.toLowerCase()))
    .slice(0, 15);

  topNewHandles.forEach(handle => {
    const cityName = CITY_NAMES[handle.cities?.[0]] || handle.cities?.[0] || 'your city';

    drafts.push({
      id: generateId(),
      type: 'follow',
      category: 'outreach',
      status: 'pending',
      priority: handle.avgRelevanceScore >= 60 ? 'high' : 'medium',
      createdAt: now.toISOString(),
      platform: 'instagram',
      content: {
        targetUsername: handle.username,
        targetCity: handle.cities?.[0],
        profileUrl: `https://instagram.com/${handle.username}`,
        action: 'follow',
        engagementNote: `Follow @${handle.username} — ${handle.postCount} event-related posts, ${handle.totalLikes} total likes, avg score ${handle.avgRelevanceScore}`,
      },
      context: {
        postCount: handle.postCount,
        totalLikes: handle.totalLikes,
        avgRelevanceScore: handle.avgRelevanceScore,
        sampleUrls: handle.sampleUrls?.slice(0, 2),
      },
      notes: `Follow @${handle.username} (${cityName}). Then engage with their latest post.`,
    });
  });

  // ── DM drafts for highest-value handles (event organizers) ──
  const dmCandidates = newHandles
    .filter(h => h.avgRelevanceScore >= 55 && h.totalLikes >= 50)
    .slice(0, 5);

  dmCandidates.forEach(handle => {
    const cityName = CITY_NAMES[handle.cities?.[0]] || handle.cities?.[0] || 'your city';

    drafts.push({
      id: generateId(),
      type: 'dm',
      category: 'outreach',
      status: 'pending',
      priority: 'low',
      createdAt: now.toISOString(),
      platform: 'instagram',
      content: {
        targetUsername: handle.username,
        text: `Hey! 👋 Love what you're doing for the dog community in ${cityName}. We're building pawcities.com — a free guide to dog-friendly cities, events, and places around the world. We just featured your events on our ${cityName} calendar!\n\nWould love to connect and support each other's communities. Let us know if you have any upcoming events you'd like us to help promote! 🐾`,
      },
      context: {
        avgRelevanceScore: handle.avgRelevanceScore,
        totalLikes: handle.totalLikes,
        postCount: handle.postCount,
      },
      notes: `DM to @${handle.username} — high-value event organizer in ${cityName}. Send AFTER following + commenting.`,
    });
  });

  return drafts;
}

// ─── Instagram Graph API ─────────────────────────────────────────────────────

function graphRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${apiPath}`);
    if (!body || method === 'GET') {
      url.searchParams.set('access_token', META_PAGE_ACCESS_TOKEN);
    }
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) {
      const bodyWithToken = { ...body, access_token: META_PAGE_ACCESS_TOKEN };
      req.write(JSON.stringify(bodyWithToken));
    }
    req.end();
  });
}

async function publishPost(imageUrl, caption) {
  if (!META_PAGE_ACCESS_TOKEN) {
    return { success: false, error: 'META_PAGE_ACCESS_TOKEN not set' };
  }

  // Step 1: Create container
  console.log('  Creating media container...');
  const container = await graphRequest('POST', `/${INSTAGRAM_ACCOUNT_ID}/media`, {
    image_url: imageUrl,
    caption,
  });

  if (container.status !== 200 || container.data?.error) {
    return { success: false, error: container.data?.error?.message || `HTTP ${container.status}` };
  }

  const containerId = container.data.id;
  console.log(`  Container created: ${containerId}`);

  // Step 2: Poll for processing
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await graphRequest('GET', `/${containerId}?fields=status_code`);
    const code = status.data?.status_code;
    console.log(`  Status: ${code} (attempt ${i + 1}/10)`);

    if (code === 'FINISHED') {
      // Step 3: Publish
      console.log('  Publishing...');
      const pub = await graphRequest('POST', `/${INSTAGRAM_ACCOUNT_ID}/media_publish`, {
        creation_id: containerId,
      });

      if (pub.status !== 200 || pub.data?.error) {
        return { success: false, error: pub.data?.error?.message || `HTTP ${pub.status}` };
      }

      return { success: true, postId: pub.data.id, containerId };
    }

    if (code === 'ERROR' || code === 'EXPIRED') {
      return { success: false, error: `Container ${code}` };
    }
  }

  return { success: false, error: 'Processing timed out' };
}

// ─── Command Handlers ────────────────────────────────────────────────────────

function cmdGenerate(args) {
  const type = args.includes('--type') ? args[args.indexOf('--type') + 1] : 'all';
  const queue = loadQueue();
  let newDrafts = [];

  if (type === 'all' || type === 'showcase') {
    const showcaseDrafts = generateShowcaseDrafts();
    newDrafts.push(...showcaseDrafts);
    console.log(`\n📝 Generated ${showcaseDrafts.length} showcase post draft(s)`);
  }

  if (type === 'all' || type === 'outreach') {
    const outreachDrafts = generateOutreachDrafts();
    newDrafts.push(...outreachDrafts);
    const comments = outreachDrafts.filter(d => d.type === 'comment').length;
    const follows = outreachDrafts.filter(d => d.type === 'follow').length;
    const dms = outreachDrafts.filter(d => d.type === 'dm').length;
    console.log(`\n🎯 Generated ${outreachDrafts.length} outreach draft(s):`);
    console.log(`   ${comments} comment(s), ${follows} follow action(s), ${dms} DM(s)`);
  }

  queue.drafts.push(...newDrafts);
  queue.meta.lastGenerated = new Date().toISOString();
  saveQueue(queue);

  console.log(`\n✅ ${newDrafts.length} total drafts added to queue`);
  console.log(`📋 Queue now has ${queue.drafts.length} item(s)`);
  console.log(`\nRun 'node social-media-agent.js review' to see and approve drafts`);
}

function cmdReview(args) {
  const queue = loadQueue();
  const typeFilter = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
  const statusFilter = args.includes('--status') ? args[args.indexOf('--status') + 1] : 'pending';

  let drafts = queue.drafts.filter(d => d.status === statusFilter);
  if (typeFilter) {
    drafts = drafts.filter(d => d.type === typeFilter);
  }

  if (drafts.length === 0) {
    console.log(`\n📭 No ${statusFilter} ${typeFilter || ''} drafts in queue.`);
    console.log(`Run 'node social-media-agent.js generate' to create new drafts.`);
    return;
  }

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  📋 ${statusFilter.toUpperCase()} DRAFTS (${drafts.length})`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  drafts.forEach((draft, idx) => {
    const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' }[draft.priority] || '⚪';
    const typeIcon = { post: '📸', comment: '💬', follow: '👤', dm: '✉️' }[draft.type] || '📝';

    console.log(`${typeIcon} ${priorityIcon} [${idx + 1}] ${draft.id}`);
    console.log(`   Type: ${draft.type} | Category: ${draft.category} | Priority: ${draft.priority}`);

    if (draft.type === 'post') {
      console.log(`   Caption preview:`);
      const lines = draft.content.caption.split('\n').slice(0, 4);
      lines.forEach(l => console.log(`     ${l}`));
      if (draft.content.caption.split('\n').length > 4) console.log('     ...');
      if (draft.content.imageNote) console.log(`   📷 Image: ${draft.content.imageNote.slice(0, 80)}`);
    } else if (draft.type === 'comment') {
      console.log(`   Target: @${draft.content.targetUsername} → ${draft.content.targetPost}`);
      console.log(`   Comment: "${draft.content.text}"`);
      if (draft.context?.postPreview) console.log(`   Post: "${draft.context.postPreview.slice(0, 80)}..."`);
    } else if (draft.type === 'follow') {
      console.log(`   Target: @${draft.content.targetUsername} (${CITY_NAMES[draft.content.targetCity] || draft.content.targetCity})`);
      console.log(`   ${draft.content.engagementNote}`);
    } else if (draft.type === 'dm') {
      console.log(`   Target: @${draft.content.targetUsername}`);
      console.log(`   Message preview: "${draft.content.text.slice(0, 100)}..."`);
    }

    if (draft.notes) console.log(`   💡 ${draft.notes}`);
    console.log();
  });

  console.log(`─────────────────────────────────────────────────────────────`);
  console.log(`Commands:`);
  console.log(`  approve <id>      Approve a specific draft`);
  console.log(`  approve all       Approve all pending drafts`);
  console.log(`  reject <id>       Reject a draft`);
  console.log(`  publish <id>      Publish an approved post to Instagram`);
  console.log(`  clipboard <id>    Show comment text ready to copy`);
}

function cmdApprove(args) {
  const queue = loadQueue();
  const target = args[0];

  if (target === 'all') {
    const pending = queue.drafts.filter(d => d.status === 'pending');
    pending.forEach(d => {
      d.status = 'approved';
      d.approvedAt = new Date().toISOString();
    });
    saveQueue(queue);
    console.log(`\n✅ Approved ${pending.length} draft(s)`);
    return;
  }

  // Find by ID or index
  let draft;
  if (target?.startsWith('draft-')) {
    draft = queue.drafts.find(d => d.id === target);
  } else {
    const idx = parseInt(target) - 1;
    const pending = queue.drafts.filter(d => d.status === 'pending');
    draft = pending[idx];
  }

  if (!draft) {
    console.log(`\n❌ Draft not found: ${target}`);
    return;
  }

  draft.status = 'approved';
  draft.approvedAt = new Date().toISOString();
  saveQueue(queue);
  console.log(`\n✅ Approved: ${draft.id} (${draft.type})`);
}

function cmdReject(args) {
  const queue = loadQueue();
  const target = args[0];
  const reason = args.slice(1).join(' ') || null;

  let draft;
  if (target?.startsWith('draft-')) {
    draft = queue.drafts.find(d => d.id === target);
  } else {
    const idx = parseInt(target) - 1;
    const pending = queue.drafts.filter(d => d.status === 'pending');
    draft = pending[idx];
  }

  if (!draft) {
    console.log(`\n❌ Draft not found: ${target}`);
    return;
  }

  draft.status = 'rejected';
  draft.rejectedAt = new Date().toISOString();
  draft.rejectReason = reason;
  saveQueue(queue);
  console.log(`\n🚫 Rejected: ${draft.id}${reason ? ` (reason: ${reason})` : ''}`);
}

async function cmdPublish(args) {
  const queue = loadQueue();
  const target = args[0];

  let draft;
  if (target === '--next') {
    draft = queue.drafts.find(d => d.status === 'approved' && d.type === 'post');
  } else if (target?.startsWith('draft-')) {
    draft = queue.drafts.find(d => d.id === target);
  } else {
    const idx = parseInt(target) - 1;
    const approved = queue.drafts.filter(d => d.status === 'approved' && d.type === 'post');
    draft = approved[idx];
  }

  if (!draft) {
    console.log(`\n❌ No approved post found to publish.`);
    console.log(`Run 'review --status approved' to see approved drafts.`);
    return;
  }

  if (draft.type !== 'post') {
    console.log(`\n⚠️  Draft ${draft.id} is a ${draft.type}, not a post.`);
    console.log(`Only post drafts can be published via Graph API.`);
    console.log(`For comments/DMs, use 'clipboard ${draft.id}' to copy the text.`);
    return;
  }

  if (!draft.content.suggestedImageUrl) {
    console.log(`\n⚠️  No image URL set for this post.`);
    console.log(`Please set an image URL before publishing.`);
    console.log(`The post caption is:\n`);
    console.log(draft.content.caption);
    return;
  }

  console.log(`\n🚀 Publishing post: ${draft.id}`);
  console.log(`   Image: ${draft.content.suggestedImageUrl}`);
  console.log(`   Caption: ${draft.content.caption.slice(0, 100)}...\n`);

  const result = await publishPost(draft.content.suggestedImageUrl, draft.content.caption);

  if (result.success) {
    draft.status = 'published';
    draft.publishedAt = new Date().toISOString();
    draft.postId = result.postId;
    saveQueue(queue);
    console.log(`\n✅ Published! Post ID: ${result.postId}`);
  } else {
    draft.lastPublishError = result.error;
    saveQueue(queue);
    console.log(`\n❌ Publish failed: ${result.error}`);
  }
}

function cmdClipboard(args) {
  const queue = loadQueue();
  const target = args[0];

  let draft;
  if (target?.startsWith('draft-')) {
    draft = queue.drafts.find(d => d.id === target);
  } else {
    const idx = parseInt(target) - 1;
    const all = queue.drafts.filter(d => d.status === 'approved' || d.status === 'pending');
    draft = all[idx];
  }

  if (!draft) {
    console.log(`\n❌ Draft not found: ${target}`);
    return;
  }

  console.log(`\n═══ COPY THIS TEXT ══════════════════════════════════════════\n`);

  if (draft.type === 'comment') {
    console.log(draft.content.text);
    console.log(`\n═════════════════════════════════════════════════════════════`);
    console.log(`\n📎 Post this comment on: ${draft.content.targetPost}`);
    console.log(`   Account: @${draft.content.targetUsername}`);
  } else if (draft.type === 'dm') {
    console.log(draft.content.text);
    console.log(`\n═════════════════════════════════════════════════════════════`);
    console.log(`\n📎 Send this DM to: @${draft.content.targetUsername}`);
  } else if (draft.type === 'post') {
    console.log(draft.content.caption);
    console.log(`\n═════════════════════════════════════════════════════════════`);
    if (draft.content.imageNote) console.log(`\n📷 Image: ${draft.content.imageNote}`);
  }

  // Mark as actioned
  if (draft.status === 'approved') {
    draft.status = 'actioned';
    draft.actionedAt = new Date().toISOString();
    saveQueue(queue);
    console.log(`\n✅ Marked as actioned`);
  }
}

function cmdStats() {
  const queue = loadQueue();
  const drafts = queue.drafts;

  const byStatus = {};
  const byType = {};
  const byCategory = {};
  const byPriority = {};

  drafts.forEach(d => {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    byType[d.type] = (byType[d.type] || 0) + 1;
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    byPriority[d.priority] = (byPriority[d.priority] || 0) + 1;
  });

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  📊 SOCIAL QUEUE STATS`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  console.log(`  Total drafts: ${drafts.length}`);
  console.log(`  Last generated: ${queue.meta?.lastGenerated || 'never'}\n`);

  console.log(`  By status:`);
  Object.entries(byStatus).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  console.log(`\n  By type:`);
  Object.entries(byType).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  console.log(`\n  By category:`);
  Object.entries(byCategory).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  console.log(`\n  By priority:`);
  Object.entries(byPriority).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  // Estimated review time
  const pendingComments = drafts.filter(d => d.status === 'pending' && d.type === 'comment').length;
  const pendingFollows = drafts.filter(d => d.status === 'pending' && d.type === 'follow').length;
  const pendingDMs = drafts.filter(d => d.status === 'pending' && d.type === 'dm').length;
  const pendingPosts = drafts.filter(d => d.status === 'pending' && d.type === 'post').length;

  // Estimate: review ~30s, comment ~15s, follow ~10s, DM ~30s, post ~60s
  const estMinutes = Math.ceil(
    (pendingPosts * 60 + pendingComments * 15 + pendingFollows * 10 + pendingDMs * 30 + drafts.filter(d => d.status === 'pending').length * 30) / 60
  );

  console.log(`\n  ⏱  Estimated review + action time: ~${estMinutes} min`);
  console.log(`     (${pendingPosts} posts, ${pendingComments} comments, ${pendingFollows} follows, ${pendingDMs} DMs)\n`);
}

function cmdReset() {
  saveQueue({ drafts: [], meta: { created: new Date().toISOString(), lastGenerated: null } });
  console.log(`\n🗑  Queue cleared.`);
}

// ─── CLI Router ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  if (!command) {
    console.log(`
PawCities Social Media Agent
─────────────────────────────

Commands:
  generate [--type showcase|outreach]   Generate new drafts
  review [--type post|comment|follow|dm] [--status pending|approved]
                                         Review drafts
  approve <id|index|all>                Approve draft(s)
  reject <id|index> [reason]            Reject a draft
  publish <id|index|--next>             Publish approved post via Graph API
  clipboard <id|index>                  Show text ready to copy-paste
  stats                                 Queue statistics
  reset                                 Clear queue

Workflow:
  1. generate     → Agent creates drafts from discovery data
  2. review       → Human reviews drafts (~2 min)
  3. approve all  → Human approves good drafts
  4. publish      → Publish own posts via API (~instant)
  5. clipboard    → Copy comments/DMs for manual posting (~15 sec each)

Total daily time: ~15 minutes
`);
    return;
  }

  switch (command) {
    case 'generate': return cmdGenerate(commandArgs);
    case 'review': return cmdReview(commandArgs);
    case 'approve': return cmdApprove(commandArgs);
    case 'reject': return cmdReject(commandArgs);
    case 'publish': return cmdPublish(commandArgs);
    case 'clipboard': return cmdClipboard(commandArgs);
    case 'stats': return cmdStats();
    case 'reset': return cmdReset();
    default:
      console.log(`Unknown command: ${command}`);
      console.log(`Run without arguments to see usage.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

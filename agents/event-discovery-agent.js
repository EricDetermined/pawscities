#!/usr/bin/env node
/**
 * PawCities Event Discovery Agent
 *
 * Discovers dog-friendly events across pilot cities by scraping Instagram hashtags.
 * Designed to run weekly via cron or manually.
 *
 * Usage:
 *   node event-discovery-agent.js discover              # Run full discovery across all cities
 *   node event-discovery-agent.js discover --city tokyo  # Single city
 *   node event-discovery-agent.js status                 # Check running scraper status
 *   node event-discovery-agent.js results                # Pull & process latest results
 *   node event-discovery-agent.js results --run <id>     # Pull specific run results
 *   node event-discovery-agent.js cost-report            # Show cost breakdown
 *
 * Environment:
 *   APIFY_TOKEN - Apify API token (or uses hardcoded default)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.APIFY_TOKEN || '';
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'event-discovery-config.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'events');
const RUNS_LOG = path.join(OUTPUT_DIR, 'runs-log.json');

// ─── Apify API Helper ────────────────────────────────────────────────────────

function apifyRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.apify.com/v2${apiPath}`);
    url.searchParams.set('token', TOKEN);
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
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Config Loader ───────────────────────────────────────────────────────────

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function loadRunsLog() {
  if (fs.existsSync(RUNS_LOG)) {
    return JSON.parse(fs.readFileSync(RUNS_LOG, 'utf-8'));
  }
  return { runs: [] };
}

function saveRunsLog(log) {
  fs.writeFileSync(RUNS_LOG, JSON.stringify(log, null, 2));
}

// ─── Discovery: Launch Scrapers ──────────────────────────────────────────────

async function discover(targetCity = null) {
  const config = loadConfig();
  ensureOutputDir();
  const log = loadRunsLog();
  const runBatch = {
    id: `batch-${Date.now()}`,
    timestamp: new Date().toISOString(),
    cities: {},
    status: 'launched',
    totalEstimatedCost: 0,
  };

  // Determine which cities to run
  const cities = Object.entries(config.cities).filter(([name, city]) => {
    if (!city.enabled) return false;
    if (targetCity && name !== targetCity) return false;
    return true;
  });

  if (cities.length === 0) {
    console.log('No matching cities found.');
    return;
  }

  console.log(`\n🐕 PawCities Event Discovery Agent`);
  console.log(`   Launching scrapers for ${cities.length} cities...\n`);

  for (const [cityName, cityConfig] of cities) {
    // Combine global + city-specific hashtags, deduplicate
    const allHashtags = [...new Set([
      ...config.global_event_hashtags,
      ...cityConfig.hashtags,
    ])];

    const resultsLimit = config.results_per_hashtag || 10;
    const estimatedResults = allHashtags.length * resultsLimit;
    const estimatedCost = (estimatedResults * config.budget.cost_per_ig_result) + config.budget.cost_per_ig_run_base;

    console.log(`  📍 ${cityName}: ${allHashtags.length} hashtags × ${resultsLimit} results = ~${estimatedResults} posts (~$${estimatedCost.toFixed(2)})`);

    try {
      const result = await apifyRequest('POST', '/acts/apify~instagram-hashtag-scraper/runs', {
        hashtags: allHashtags,
        resultsLimit: resultsLimit,
      });

      const runId = result.data?.data?.id;
      const datasetId = result.data?.data?.defaultDatasetId;

      if (runId) {
        console.log(`    ✅ Run ${runId} | Dataset ${datasetId}`);
        runBatch.cities[cityName] = {
          runId,
          datasetId,
          hashtags: allHashtags,
          estimatedCost,
          status: 'RUNNING',
        };
        runBatch.totalEstimatedCost += estimatedCost;
      } else {
        console.log(`    ❌ Failed to start: ${JSON.stringify(result.data?.error || 'Unknown error')}`);
        runBatch.cities[cityName] = { status: 'FAILED', error: result.data?.error };
      }
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
      runBatch.cities[cityName] = { status: 'ERROR', error: err.message };
    }

    // Small delay between launches to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n  💰 Estimated total cost: $${runBatch.totalEstimatedCost.toFixed(2)}`);
  console.log(`  📋 Batch ID: ${runBatch.id}\n`);

  log.runs.push(runBatch);
  saveRunsLog(log);
  return runBatch;
}

// ─── Status Check ────────────────────────────────────────────────────────────

async function checkStatus() {
  const log = loadRunsLog();
  if (log.runs.length === 0) {
    console.log('No runs found. Run "discover" first.');
    return;
  }

  const latest = log.runs[log.runs.length - 1];
  console.log(`\n🐕 Status for batch: ${latest.id}`);
  console.log(`   Launched: ${latest.timestamp}\n`);

  let allDone = true;
  let totalCost = 0;

  for (const [cityName, cityRun] of Object.entries(latest.cities)) {
    if (!cityRun.runId) {
      console.log(`  📍 ${cityName}: ${cityRun.status}`);
      continue;
    }

    const result = await apifyRequest('GET', `/actor-runs/${cityRun.runId}`);
    const status = result.data?.data?.status;
    const cost = result.data?.data?.usageTotalUsd || 0;
    const items = result.data?.data?.chargedEventCounts?.result || 0;

    cityRun.status = status;
    cityRun.actualCost = cost;
    cityRun.resultCount = items;
    totalCost += cost;

    const icon = status === 'SUCCEEDED' ? '✅' : status === 'RUNNING' ? '⏳' : '❌';
    console.log(`  ${icon} ${cityName}: ${status} | ${items} results | $${cost.toFixed(4)}`);

    if (status === 'RUNNING' || status === 'READY') allDone = false;
  }

  console.log(`\n  💰 Total cost so far: $${totalCost.toFixed(4)}`);
  console.log(`  ${allDone ? '✅ All complete' : '⏳ Still running...'}\n`);

  latest.totalActualCost = totalCost;
  latest.status = allDone ? 'complete' : 'running';
  saveRunsLog(log);
}

// ─── Results Processing ──────────────────────────────────────────────────────

async function pullResults(specificRunId = null) {
  const log = loadRunsLog();
  if (log.runs.length === 0) {
    console.log('No runs found.');
    return;
  }

  const batch = log.runs[log.runs.length - 1];
  console.log(`\n🐕 Processing results from batch: ${batch.id}\n`);

  const allEvents = [];

  for (const [cityName, cityRun] of Object.entries(batch.cities)) {
    if (!cityRun.datasetId) continue;

    console.log(`  📍 Processing ${cityName}...`);

    try {
      const result = await apifyRequest('GET', `/datasets/${cityRun.datasetId}/items?limit=500`);
      const posts = Array.isArray(result.data) ? result.data : [];

      console.log(`    Found ${posts.length} raw posts`);

      // Process and classify each post
      const cityEvents = posts.map(post => classifyPost(post, cityName)).filter(Boolean);
      console.log(`    → ${cityEvents.length} event-relevant posts`);

      allEvents.push(...cityEvents);
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
    }
  }

  // Deduplicate by post ID
  const seen = new Set();
  const unique = allEvents.filter(e => {
    if (seen.has(e.postId)) return false;
    seen.add(e.postId);
    return true;
  });

  // Sort by relevance score (descending)
  unique.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Save processed results
  const outputFile = path.join(OUTPUT_DIR, `events-${new Date().toISOString().split('T')[0]}.json`);
  const output = {
    generated: new Date().toISOString(),
    batchId: batch.id,
    totalRawPosts: allEvents.length,
    totalUniqueEvents: unique.length,
    events: unique,
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n  📄 Saved ${unique.length} events to ${outputFile}`);

  // Print top events
  console.log(`\n  🏆 Top 10 Event-Relevant Posts:\n`);
  unique.slice(0, 10).forEach((event, i) => {
    console.log(`  ${i + 1}. [${event.relevanceScore}/100] ${event.city}`);
    console.log(`     @${event.ownerUsername} | ${event.likesCount} likes`);
    console.log(`     ${event.captionPreview}`);
    if (event.locationName) console.log(`     📍 ${event.locationName}`);
    if (event.eventSignals.length) console.log(`     🏷️  ${event.eventSignals.join(', ')}`);
    console.log(`     🔗 ${event.url}`);
    console.log();
  });

  // Extract new handles worth following
  const newHandles = extractNewHandles(unique);
  if (newHandles.length > 0) {
    const handlesFile = path.join(OUTPUT_DIR, `new-handles-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(handlesFile, JSON.stringify(newHandles, null, 2));
    console.log(`  👥 Found ${newHandles.length} new handles worth following → ${handlesFile}`);
  }

  return output;
}

// ─── Post Classification ─────────────────────────────────────────────────────

function classifyPost(post, city) {
  const caption = (post.caption || '').toLowerCase();
  const hashtags = (post.hashtags || []).map(h => h.toLowerCase());
  const mentions = post.mentions || [];
  const location = (post.locationName || '').toLowerCase();

  // Event signal keywords
  const eventKeywords = [
    'event', 'festival', 'show', 'fair', 'fest', 'park', 'day', 'night',
    'walk', 'run', 'race', 'parade', 'meetup', 'meet up', 'gathering',
    'fundraiser', 'charity', 'adoption', 'rescue', 'concert', 'market',
    'expo', 'convention', 'competition', 'contest', 'bark in the park',
    'dog day', 'pup night', 'canine', 'yappy hour', 'doggy brunch',
    'tickets', 'register', 'sign up', 'save the date', 'this weekend',
    'this saturday', 'this sunday', 'join us', 'come out', 'free entry',
    // French
    'événement', 'festival', 'exposition', 'concours', 'balade', 'promenade',
    // Spanish
    'evento', 'concurso', 'feria', 'paseo', 'encuentro',
    // Japanese
    'イベント', 'フェスタ', 'フェス', 'カーニバル', '開催', '参加',
    // German
    'veranstaltung', 'ausstellung', 'hundeschau',
  ];

  // Venue signals (stadiums, parks, event spaces)
  const venueKeywords = [
    'stadium', 'ballpark', 'arena', 'park', 'beach', 'pier', 'rooftop',
    'brewery', 'winery', 'garden', 'plaza', 'square', 'showground',
    'convention center', 'expo center', 'fairground',
  ];

  // Score the post
  let score = 0;
  const signals = [];

  // Check caption for event keywords
  for (const kw of eventKeywords) {
    if (caption.includes(kw)) {
      score += 10;
      signals.push(`caption:${kw}`);
      if (signals.length >= 3) break; // Cap keyword contribution
    }
  }

  // Location name present = strong event signal
  if (post.locationName) {
    score += 15;
    signals.push('has-location');
    for (const vkw of venueKeywords) {
      if (location.includes(vkw)) {
        score += 10;
        signals.push(`venue:${vkw}`);
        break;
      }
    }
  }

  // Date/time references in caption
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i.test(caption) ||
      /\d{1,2}(st|nd|rd|th)\s+(of\s+)?\w+/i.test(caption) ||
      /this (weekend|saturday|sunday|friday)/i.test(caption) ||
      /\d{4}年\d{1,2}月\d{1,2}日/.test(caption)) {
    score += 15;
    signals.push('has-date');
  }

  // Mentions of venues/orgs (more than 1 mention suggests event promotion)
  if (mentions.length >= 2) {
    score += 10;
    signals.push(`${mentions.length}-mentions`);
  }

  // Engagement level (higher engagement = more notable event)
  if (post.likesCount > 100) {
    score += 10;
    signals.push('high-engagement');
  } else if (post.likesCount > 30) {
    score += 5;
    signals.push('medium-engagement');
  }

  // Recency bonus (posts from last 7 days)
  const postDate = new Date(post.timestamp);
  const daysSincePost = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePost <= 7) {
    score += 10;
    signals.push('recent');
  } else if (daysSincePost <= 30) {
    score += 5;
    signals.push('last-30d');
  }

  // Minimum threshold — skip posts that are just cute dog photos
  if (score < 15) return null;

  return {
    postId: post.id,
    city,
    ownerUsername: post.ownerUsername,
    ownerId: post.ownerId,
    captionPreview: (post.caption || '').substring(0, 200),
    fullCaption: post.caption,
    hashtags: post.hashtags || [],
    mentions,
    locationName: post.locationName || null,
    likesCount: post.likesCount || 0,
    commentsCount: post.commentsCount || 0,
    timestamp: post.timestamp,
    url: post.url,
    imageUrl: post.displayUrl,
    relevanceScore: Math.min(score, 100),
    eventSignals: signals,
    sourceHashtag: post.inputUrl?.split('/tags/')[1] || 'unknown',
  };
}

// ─── New Handle Extraction ───────────────────────────────────────────────────

function extractNewHandles(events) {
  // Load existing following list to exclude already-followed accounts
  const followingPath = path.join(__dirname, '..', 'data', 'instagram-following.json');
  let existingHandles = new Set();
  try {
    const following = JSON.parse(fs.readFileSync(followingPath, 'utf-8'));
    existingHandles = new Set(following.accounts.map(a => a.username.toLowerCase()));
  } catch (e) {
    // No existing list, that's fine
  }

  // Count how many event posts each handle appears in
  const handleCounts = {};
  for (const event of events) {
    const username = event.ownerUsername?.toLowerCase();
    if (!username || existingHandles.has(username)) continue;

    if (!handleCounts[username]) {
      handleCounts[username] = {
        username: event.ownerUsername,
        postCount: 0,
        totalLikes: 0,
        totalRelevanceScore: 0,
        cities: new Set(),
        sampleUrls: [],
      };
    }
    handleCounts[username].postCount++;
    handleCounts[username].totalLikes += event.likesCount;
    handleCounts[username].totalRelevanceScore += event.relevanceScore;
    handleCounts[username].cities.add(event.city);
    if (handleCounts[username].sampleUrls.length < 3) {
      handleCounts[username].sampleUrls.push(event.url);
    }
  }

  // Convert to array and sort by relevance
  return Object.values(handleCounts)
    .map(h => ({
      ...h,
      cities: Array.from(h.cities),
      avgRelevanceScore: Math.round(h.totalRelevanceScore / h.postCount),
    }))
    .filter(h => h.postCount >= 1 && h.avgRelevanceScore >= 25)
    .sort((a, b) => b.totalRelevanceScore - a.totalRelevanceScore)
    .slice(0, 50);
}

// ─── Cost Report ─────────────────────────────────────────────────────────────

async function costReport() {
  const log = loadRunsLog();
  if (log.runs.length === 0) {
    console.log('No runs logged yet.');
    return;
  }

  console.log('\n🐕 PawCities Event Discovery — Cost Report\n');

  let grandTotal = 0;
  for (const batch of log.runs) {
    const cost = batch.totalActualCost || batch.totalEstimatedCost || 0;
    grandTotal += cost;
    console.log(`  ${batch.timestamp.split('T')[0]} | ${batch.id} | $${cost.toFixed(4)} | ${batch.status}`);
  }

  const config = loadConfig();
  console.log(`\n  Total spent: $${grandTotal.toFixed(4)}`);
  console.log(`  Monthly budget: $${config.budget.monthly_target_usd}`);
  console.log(`  Remaining: $${(config.budget.monthly_target_usd - grandTotal).toFixed(2)}`);
  console.log(`  Projected monthly (weekly runs): $${(grandTotal / log.runs.length * 4.3).toFixed(2)}\n`);
}

// ─── CLI Router ──────────────────────────────────────────────────────────────

async function main() {
  const action = process.argv[2];
  const args = process.argv.slice(3);

  switch (action) {
    case 'discover': {
      const cityIdx = args.indexOf('--city');
      const city = cityIdx >= 0 ? args[cityIdx + 1] : null;
      await discover(city);
      break;
    }
    case 'status':
      await checkStatus();
      break;
    case 'results': {
      const runIdx = args.indexOf('--run');
      const runId = runIdx >= 0 ? args[runIdx + 1] : null;
      await pullResults(runId);
      break;
    }
    case 'cost-report':
      await costReport();
      break;
    default:
      console.log(`
PawCities Event Discovery Agent

Usage:
  node event-discovery-agent.js discover              # Run all cities
  node event-discovery-agent.js discover --city tokyo  # Single city
  node event-discovery-agent.js status                 # Check run status
  node event-discovery-agent.js results                # Pull & process results
  node event-discovery-agent.js cost-report            # Show cost breakdown
      `);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

/**
 * PawsCities Research Agent
 * Uses Claude API to discover and validate dog-friendly establishments
 */

import Anthropic from '@anthropic-ai/sdk';
import { CITIES, CATEGORIES } from '../lib/cities-config';

// Types
export interface ResearchConfig {
  citySlug: string;
  categories?: string[];
  maxResults?: number;
  language?: 'en' | 'fr';
}

export interface DiscoveredPlace {
  name: string;
  nameFr?: string;
  category: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  description: string;
  descriptionFr?: string;
  dogFeatures: {
    waterBowl?: boolean;
    treats?: boolean;
    outdoorSeating?: boolean;
    indoorAllowed?: boolean;
    offLeashArea?: boolean;
    dogMenu?: boolean;
    fenced?: boolean;
    shadeAvailable?: boolean;
  };
  priceLevel?: number;
  source: string;
  confidence: number;
  reasoning: string;
}

export interface ResearchResult {
  taskId: string;
  citySlug: string;
  status: 'completed' | 'failed';
  placesFound: number;
  places: DiscoveredPlace[];
  tokensUsed: number;
  duration: number;
  error?: string;
}

// Initialize Anthropic client
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  return new Anthropic({ apiKey });
}

// Get city info for prompts
function getCityContext(citySlug: string): string {
  const city = CITIES[citySlug];
  if (!city) {
    throw new Error(`City not found: ${citySlug}`);
  }

  return `
City: ${city.name} (${city.nameFr})
Country: ${city.country}
Currency: ${city.currency}
Language: ${city.languages.join(', ')}
Coordinates: ${city.latitude}, ${city.longitude}

Dog Regulations:
- Leash required in public: ${city.dogRegulations.leashRequired ? 'Yes' : 'No'}
- Off-leash areas available: ${city.dogRegulations.offLeashAreas ? 'Yes' : 'No'}
- Public transport: ${city.dogRegulations.publicTransport}
`;
}

// Build discovery prompt
function buildDiscoveryPrompt(config: ResearchConfig): string {
  const cityContext = getCityContext(config.citySlug);
  const categories = config.categories || CATEGORIES.map(c => c.slug);
  const maxResults = config.maxResults || 20;

  return `You are a research assistant helping to discover dog-friendly establishments in ${CITIES[config.citySlug].name}.

${cityContext}

Your task is to identify REAL, EXISTING dog-friendly places in this city. Focus on these categories:
${categories.map(c => {
  const cat = CATEGORIES.find(cat => cat.slug === c);
  return cat ? `- ${cat.name} (${cat.nameFr})` : `- ${c}`;
}).join('\n')}

For each place, provide:
1. Name (in local language and French if different)
2. Category (from the list above)
3. Full address
4. Phone number (if known)
5. Website (if known)
6. Description of why it's dog-friendly (in English)
7. French description
8. Dog-friendly features:
   - Water bowls provided
   - Dog treats available
   - Outdoor seating (terrace)
   - Dogs allowed inside
   - Off-leash area (for parks)
   - Dog menu available
   - Fenced area
   - Shade available
9. Price level (1-4, where 1=budget, 4=luxury)
10. Your confidence score (0-100) that this place exists and is dog-friendly
11. Brief reasoning for your confidence score

IMPORTANT GUIDELINES:
- Only include places you are confident actually exist
- Prefer well-known, established venues
- Include a mix of categories
- Focus on genuinely dog-welcoming places, not just "tolerates dogs"
- Be specific with addresses (include postal code)
- If you're unsure about details, indicate lower confidence

Return your findings as a JSON array with this structure:
[
  {
    "name": "Place Name",
    "nameFr": "Nom du Lieu",
    "category": "restaurants",
    "address": "Full Address, Postal Code, City",
    "phone": "+XX XXX XXX XX XX",
    "website": "https://example.com",
    "description": "English description of dog-friendliness...",
    "descriptionFr": "Description en français...",
    "dogFeatures": {
      "waterBowl": true,
      "treats": false,
      "outdoorSeating": true,
      "indoorAllowed": false,
      "offLeashArea": false,
      "dogMenu": false,
      "fenced": false,
      "shadeAvailable": true
    },
    "priceLevel": 2,
    "confidence": 85,
    "reasoning": "Well-known restaurant with documented pet policy..."
  }
]

Find up to ${maxResults} dog-friendly places. Only return the JSON array, no other text.`;
}

// Parse Claude's response
function parseDiscoveryResponse(response: string): DiscoveredPlace[] {
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = response;

    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const places = JSON.parse(jsonStr);

    if (!Array.isArray(places)) {
      throw new Error('Response is not an array');
    }

    // Validate and clean each place
    return places.map((place: Record<string, unknown>) => ({
      name: String(place.name || ''),
      nameFr: place.nameFr ? String(place.nameFr) : undefined,
      category: String(place.category || 'restaurants'),
      address;\n      phone: place.phone ? String(place.phone) : undefined,
      website: place.website ? String(place.website) : undefined,
      description: String(place.description || ''),
      descriptionFr: place.descriptionFr ? String(place.descriptionFr) : undefined,
      dogFeatures: {
        waterBowl: Boolean((place.dogFeatures as Record<string, unknown>)?.waterBowl),
        treats: Boolean((place.dogFeatures as Record<string, unknown>)?.treats),
        outdoorSeating: Boolean((place.dogFeatures as Record<string, unknown>)?.outdoorSeating),
        indoorAllowed: Boolean((place.dogFeatures as Record<string, unknown>)?.indoorAllowed),
        offLeashArea: Boolean((place.dogFeatures as Record<string, unknown>)?.offLeashArea),
        dogMenu: Boolean((place.dogFeatures as Record<string, unknown>)?.dogMenu),
        fenced: Boolean((place.dogFeatures as Record<string, unknown>)?.fenced),
        shadeAvailable: Boolean((place.dogFeatures as Record<string, unknown>)?.shadeAvailable),
      },
      priceLevel: Number(place.priceLevel) || 2,
      source: 'claude-research',
      confidence: Number(place.confidence) || 50,
      reasoning: String(place.reasoning || ''),
    })).filter(place => place.name && place.address);
  } catch (error) {
    console.error('Error parsing discovery response:', error);
    return [];
  }
}

// Main research function
export async function discoverPlaces(config: ResearchConfig): Promise<ResearchResult> {
  const startTime = Date.now();
  const taskId = `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  console.log(`\n⟔� Starting research for ${config.citySlug}...`);
  console.log(`   Task ID: ${taskId}`);

  try {
    const client = getAnthropicClient();
    const prompt = buildDiscoveryPrompt(config);

    console.log(`   Sending request to Claude...`);
  
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const places = parseDiscoveryResponse(responseText);
    const duration = Date.now() - startTime;

    console.log(`   ✓ Found ${places.length} places in ${duration}ms`);
    console.log(`   Tokens used: ${message.usage.input_tokens + message.usage.output_tokens}`);

    return {
      taskId,
      citySlug: config.citySlug,
      status: 'completed',
      placesFound: places.length,
      places,
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`   ✗ Research failed: ${errorMessage}`);

    return {
      taskId,
      citySlug: config.citySlug,
      status: 'failed',
      placesFound: 0,
      places: [],
      tokensUsed: 0,
      duration,
      error: errorMessage,
    };
  }
}

// Enrichment function - add coordinates and validate
export async function enrichPlace(place: DiscoveredPlace): Promise<DiscoveredPlace> {
  // In production, this would:
  // 1. Use Google Places API to verify and get coordinates
  // 2. Cross-reference with other sources
  // 3. Validate phone numbers and websites
  // For now, we'll return as-is with a note

  return {
    ...place,
    reasoning: place.reasoning + ' [Awaiting coordinate enrichment]',
  };
}

// Batch research for multiple categories
export async function researchCity(
  citySlug: string,
  options?: { categories?: string[]; maxPerCategory?: number }
): Promise<ResearchResult[]> {
  const categories = options?.categories || ['restaurants', 'cafes', 'parks', 'hotels'];
  const maxPerCategory = options?.maxPerCategory || 10;
  const results: ResearchResult[] = [];

  console.log(`\n🏙️ Starting full city research for ${citySlug}`);
  console.log(`   Categories: ${categories.join(', ')}`);

  for (const category of categories) {
    console.log(`\n   📂 Researching ${category}...`);

    const result = await discoverPlaces({
      citySlug,
      categories: [category],
      maxResults: maxPerCategory,
    });

    results.push(result);

    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const totalPlaces = results.reduce((sum, r) => sum + r.placesFound, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);

  console.log(`\n✅ City research complete!`);
  console.log(`   Total places found: ${totalPlaces}`);
  console.log(`   Total tokens used: ${totalTokens}`);

  return results;
}

// Export for CLI usage
export { getCityContext, buildDiscoveryPrompt };

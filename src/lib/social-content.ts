/**
 * Social media content bank and auto-selection logic for PawCities
 *
 * Contains 44 researched facts across 8 cities, with caption generation
 * and smart scheduling (round-robin cities, no duplicates).
 */

export interface ContentFact {
  city: string;
  type: 'did-you-know' | 'tip';
  headline: string;
  body: string;
  icon: string;
}

export const CITY_META: Record<string, { name: string; country: string; emoji: string; slug: string }> = {
  paris: { name: 'Paris', country: 'France', emoji: '\u{1F1EB}\u{1F1F7}', slug: 'paris' },
  geneva: { name: 'Geneva', country: 'Switzerland', emoji: '\u{1F1E8}\u{1F1ED}', slug: 'geneva' },
  london: { name: 'London', country: 'United Kingdom', emoji: '\u{1F1EC}\u{1F1E7}', slug: 'london' },
  barcelona: { name: 'Barcelona', country: 'Spain', emoji: '\u{1F1EA}\u{1F1F8}', slug: 'barcelona' },
  losangeles: { name: 'Los Angeles', country: 'United States', emoji: '\u{1F1FA}\u{1F1F8}', slug: 'losangeles' },
  nyc: { name: 'New York City', country: 'United States', emoji: '\u{1F1FA}\u{1F1F8}', slug: 'newyork' },
  sydney: { name: 'Sydney', country: 'Australia', emoji: '\u{1F1E6}\u{1F1FA}', slug: 'sydney' },
  tokyo: { name: 'Tokyo', country: 'Japan', emoji: '\u{1F1EF}\u{1F1F5}', slug: 'tokyo' },
};

// City rotation order for balanced posting
const CITY_ROTATION = ['barcelona', 'tokyo', 'paris', 'nyc', 'geneva', 'london', 'losangeles', 'sydney'];

export const CONTENT_BANK: ContentFact[] = [
  // PARIS
  { city: 'paris', type: 'did-you-know', headline: '1 Dog for Every 7 Parisians', body: 'Paris has over 300,000 dogs - one of the highest dog-to-human ratios of any major city in Europe.', icon: '\u{1F429}' },
  { city: 'paris', type: 'did-you-know', headline: 'Dogs Dine Indoors in Paris', body: 'Unlike the US, France has no laws banning dogs from restaurants. Many Parisian caf\u00E9s welcome dogs at the table and bring out water bowls.', icon: '\u{1F377}' },
  { city: 'paris', type: 'did-you-know', headline: 'Dog Dining Since the 1800s', body: 'Wealthy Parisians brought dogs to fancy restaurants in the 1800s. It became so common that restaurants began offering special dog dishes - bouillon with rice and liver.', icon: '\u{1F4DC}' },
  { city: 'paris', type: 'tip', headline: 'Metro Tip: Small Dogs Only', body: 'Dogs must fit inside a carrier bag to travel on the Paris metro and buses. Larger dogs? You\'ll need a taxi or a long walk.', icon: '\u{1F687}' },
  { city: 'paris', type: 'did-you-know', headline: 'France\'s #1 Breed: Chihuahua', body: 'The Chihuahua is the most popular dog breed in France at 13.7%. Perfect for navigating narrow caf\u00E9 terraces!', icon: '\u{1F415}' },
  { city: 'paris', type: 'tip', headline: '\u20AC68 Fine for Not Cleaning Up', body: 'Paris enforces a \u20AC68 fine for owners who don\'t pick up after their dogs. Keep those bags handy!', icon: '\u{1F4B0}' },

  // GENEVA
  { city: 'geneva', type: 'did-you-know', headline: 'World\'s Strictest Dog Laws', body: 'Switzerland is the ONLY European country requiring all dogs to be microchipped and registered by age 3 months.', icon: '\u{1F4CB}' },
  { city: 'geneva', type: 'did-you-know', headline: '4-Hour Loneliness Rule', body: 'Swiss law says dogs shouldn\'t be left alone for more than 4 hours. One of the strictest loneliness regulations in the world.', icon: '\u23F0' },
  { city: 'geneva', type: 'did-you-know', headline: 'Shock Collars Are Illegal', body: 'Switzerland banned shock collars and punishment-based training devices. One of few countries globally with this protection.', icon: '\u{1F6AB}' },
  { city: 'geneva', type: 'did-you-know', headline: 'Dogs Ride Free on Swiss Trains', body: 'Dogs in carriers travel FREE on Swiss trains, trams, and buses. On a leash? Half-fare. One of Europe\'s best transit deals for pups.', icon: '\u{1F682}' },
  { city: 'geneva', type: 'did-you-know', headline: 'Large Dog License Test', body: 'Owners of dogs over 25kg in Geneva must pass a behavior and training test with an authorized trainer. Responsible ownership by law.', icon: '\u{1F4DD}' },

  // LONDON
  { city: 'london', type: 'did-you-know', headline: '164 Dog-Friendly Parks', body: 'London boasts 164 dedicated dog-friendly parks - making it one of the most dog-welcoming cities in the world.', icon: '\u{1F333}' },
  { city: 'london', type: 'did-you-know', headline: 'Dogs Ride the Tube Free', body: 'Dogs travel free on London\'s Underground, buses, trams, and trains. But they must be carried on escalators to protect their paws!', icon: '\u{1F687}' },
  { city: 'london', type: 'did-you-know', headline: 'Dog-Friendly Cinema Nights', body: 'Picturehouse Cinemas hosts dog-friendly film screenings. The Rooftop Film Club even runs special \'Wooftop\' events.', icon: '\u{1F3AC}' },
  { city: 'london', type: 'did-you-know', headline: 'Doggie Roasts for \u00A35', body: 'The Devonshire in Balham serves a signature \'doggie roast\' - chicken with carrots, cabbage, and low-salt gravy.', icon: '\u{1F357}' },
  { city: 'london', type: 'did-you-know', headline: 'London is the UK\'s Cat City', body: 'Surprise: London is the only region in the UK where cats outnumber dogs. Just 9% of Londoners own dogs vs. 14% with cats.', icon: '\u{1F62E}' },

  // BARCELONA
  { city: 'barcelona', type: 'did-you-know', headline: 'More Dogs Than Children', body: 'Barcelona has 172,971 dogs but only 165,482 children aged 0-12. Dogs officially outnumber kids in the city.', icon: '\u{1F476}' },
  { city: 'barcelona', type: 'did-you-know', headline: '100+ Off-Leash Dog Areas', body: 'Barcelona has over 100 designated off-leash areas across parks, plazas, and public spaces. Dog freedom is built into the city.', icon: '\u{1F415}' },
  { city: 'barcelona', type: 'did-you-know', headline: 'Europe\'s First Dog Water Park', body: 'Perros al Agua is Europe\'s first dog water park - large pools, water slides, jumping ramps, sand dunes, and even a restaurant.', icon: '\u{1F3CA}' },
  { city: 'barcelona', type: 'did-you-know', headline: '\u20AC1,500 Fine for Not Cleaning Up', body: 'Barcelona doesn\'t mess around: a \u20AC1,500 fine for not picking up after your dog. That\'s 22x more than Paris!', icon: '\u{1F4B8}' },
  { city: 'barcelona', type: 'did-you-know', headline: 'Spain #1 in Dog Ownership', body: 'Spain has the highest rate of dog ownership per capita in Europe - 71.48% of households own at least one dog.', icon: '\u{1F3C6}' },

  // LOS ANGELES
  { city: 'losangeles', type: 'did-you-know', headline: 'Only 1 Off-Leash Dog Beach', body: 'Despite 70 miles of coastline, LA County has only ONE official off-leash dog beach: Rosie\'s Dog Beach in Long Beach.', icon: '\u{1F3D6}\uFE0F' },
  { city: 'losangeles', type: 'did-you-know', headline: 'World\'s Largest Corgi Gathering', body: 'LA hosts \'Corgi Beach Day\' - the largest Corgi gathering in the world. Started with 15 dogs in 2012, now thousands attend.', icon: '\u{1F415}' },
  { city: 'losangeles', type: 'did-you-know', headline: 'Dogs Surf in Competition', body: 'Surf City Surf Dog in Huntington Beach is an annual competition where dogs catch real waves. Free to attend.', icon: '\u{1F3C4}' },
  { city: 'losangeles', type: 'did-you-know', headline: 'Runyon Canyon: 90 Acres Off-Leash', body: 'Runyon Canyon features a 90-acre off-leash dog park with hiking trails and Hollywood Hills views.', icon: '\u{1F3D4}\uFE0F' },
  { city: 'losangeles', type: 'did-you-know', headline: '2.6 Million Dogs in LA', body: 'Only 19.9% of LA households own dogs (vs. 39.1% nationally), but the city is home to 2.6 million dogs.', icon: '\u{1F4CA}' },

  // NEW YORK CITY
  { city: 'nyc', type: 'did-you-know', headline: '600,000 Dogs in NYC', body: '600,000 dogs call NYC home. The pet industry generates $1.5 billion in annual economic activity in the city.', icon: '\u{1F3D9}\uFE0F' },
  { city: 'nyc', type: 'did-you-know', headline: '75% Buy Their Dog a Puppacino', body: '75% of New Yorkers have treated their pet to a \'puppacino\' at a caf\u00E9. In Mississippi, it\'s only 2%.', icon: '\u2615' },
  { city: 'nyc', type: 'did-you-know', headline: 'More on Dog Grooming Than Their Own', body: '55% of NYC dog owners spend more on their pet\'s grooming than their own personal grooming.', icon: '\u{1F487}' },
  { city: 'nyc', type: 'did-you-know', headline: 'Central Park: 20 Off-Leash Zones', body: 'Central Park has ~20 off-leash areas during early morning (6-9 AM) and evening (9 PM-1 AM).', icon: '\u{1F33F}' },
  { city: 'nyc', type: 'did-you-know', headline: '42% Throw Dog Birthday Parties', body: '42% of NYC dog owners throw birthday parties for their pets. Dog yoga and pet bakeries are standard.', icon: '\u{1F382}' },

  // SYDNEY
  { city: 'sydney', type: 'did-you-know', headline: 'The 2-Dog Rule', body: 'In NSW, the standard legal limit is just 2 dogs per household. You need a special permit for more.', icon: '\u270C\uFE0F' },
  { city: 'sydney', type: 'did-you-know', headline: '43% of Centennial Park is Off-Leash', body: 'About 43% of Sydney\'s massive Centennial Parklands is designated as off-leash territory.', icon: '\u{1F333}' },
  { city: 'sydney', type: 'did-you-know', headline: 'Dog Beach Culture', body: 'Sydney\'s Sirius Cove and Greenhills Beach offer dedicated off-leash beach time for dogs.', icon: '\u{1F3D6}\uFE0F' },
  { city: 'sydney', type: 'did-you-know', headline: 'Escape-Proof Fences Required', body: 'NSW law requires yard fences that dogs \'cannot jump, dig under or squeeze through.\'', icon: '\u{1F3E0}' },
  { city: 'sydney', type: 'did-you-know', headline: 'Rental Rights for Dog Owners', body: 'New NSW laws now protect tenants\' rights to keep dogs in rental properties.', icon: '\u{1F3E2}' },

  // TOKYO
  { city: 'tokyo', type: 'did-you-know', headline: 'Virtually Zero Dog Waste on Streets', body: 'Tokyo\'s dog owners are so responsible about cleanup, you almost never see dog droppings on the streets.', icon: '\u2728' },
  { city: 'tokyo', type: 'did-you-know', headline: 'You Can \'Rent\' a Dog', body: 'Tokyo has dog caf\u00E9s where you can rent a dog for 1-2 hours for walks and playtime. A uniquely Japanese innovation.', icon: '\u{1F436}' },
  { city: 'tokyo', type: 'did-you-know', headline: 'Tiny Dogs Rule Tokyo', body: 'Tokyo apartments are small, so Chihuahuas, Miniature Dachshunds, and Toy Poodles dominate.', icon: '\u{1F3E0}' },
  { city: 'tokyo', type: 'did-you-know', headline: 'Yoyogi Park\'s 3-Tier Dog Run', body: 'Yoyogi Park divides its dog run by size: large, medium, and small. Prevents hierarchy issues.', icon: '\u{1F4D0}' },
  { city: 'tokyo', type: 'did-you-know', headline: '$9 Billion Pet Industry', body: 'Japan\'s pet industry is worth 1.4 trillion yen (~$9B USD). In Tokyo, dogs are treated like royalty.', icon: '\u{1F48E}' },
  { city: 'tokyo', type: 'did-you-know', headline: 'Hachiko\'s Legacy Lives On', body: 'Hachiko\'s statue at Shibuya Station remains one of Tokyo\'s most-visited spots. A loyalty story woven into Japanese identity.', icon: '\u{1F5FF}' },
];

/**
 * Generate an Instagram caption for a single fact post
 */
export function generateCaption(fact: ContentFact): string {
  const city = CITY_META[fact.city];
  if (!city) return '';

  const hashtags = [
    '#PawCities',
    `#DogFriendly${city.name.replace(/\s/g, '')}`,
    `#${city.name.replace(/\s/g, '')}Dogs`,
    '#DogTravel',
    '#DogFriendly',
    '#DogsOfInstagram',
    '#PetTravel',
    '#DogLovers',
    '#TravelWithDogs',
    '#DogFriendlyTravel',
    '#PetFriendly',
  ].join(' ');

  return [
    `${fact.icon} Did you know? ${fact.headline}`,
    '',
    fact.body,
    '',
    `Discover more dog-friendly spots in ${city.name} at pawcities.com/${city.slug} (link in bio)`,
    '',
    `Save this for your next trip! \u{1F43E}`,
    '',
    hashtags,
  ].join('\n');
}

/**
 * Pick the next content to post based on what's already been posted.
 * Uses round-robin city rotation and avoids duplicate headlines.
 *
 * @param postedHeadlines - Set of headlines that have already been posted
 * @returns The next fact to post, or null if all content has been used
 */
export function pickNextContent(postedHeadlines: Set<string>): ContentFact | null {
  // Count how many posts per city have been made
  const cityPostCounts: Record<string, number> = {};
  for (const city of CITY_ROTATION) {
    cityPostCounts[city] = 0;
  }

  for (const fact of CONTENT_BANK) {
    if (postedHeadlines.has(fact.headline)) {
      cityPostCounts[fact.city] = (cityPostCounts[fact.city] || 0) + 1;
    }
  }

  // Find the city with the fewest posts (round-robin)
  const sortedCities = [...CITY_ROTATION].sort(
    (a, b) => (cityPostCounts[a] || 0) - (cityPostCounts[b] || 0)
  );

  // Try each city in order of fewest posts
  for (const city of sortedCities) {
    const available = CONTENT_BANK.filter(
      f => f.city === city && !postedHeadlines.has(f.headline)
    );
    if (available.length > 0) {
      return available[0];
    }
  }

  return null; // All content has been posted
}

/**
 * Get a featured establishment photo URL for a city
 * Uses the first establishment's first photo ref from the city data
 */
export function getEstablishmentPhotoUrl(
  photoRef: string,
  baseUrl: string = 'https://pawcities.com',
): string {
  return `${baseUrl}/api/places/photo?name=${encodeURIComponent(photoRef)}&maxWidth=1080`;
}

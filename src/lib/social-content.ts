/**
 * Social media content bank and auto-selection logic for PawCities
 *
 * Contains 39 researched facts across 8 cities, with caption generation
 * and smart scheduling (round-robin cities, no duplicates).
 */

export interface ContentFact {
  city: string;
  type: 'did-you-know' | 'tip' | 'spotlight' | 'event' | 'guide' | 'fun';
  headline: string;
  body: string;
  icon: string;
  /** When the post references a specific business, set this so the cron can look up its actual photo via Google Places */
  placeName?: string;
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
  { city: 'paris', type: 'did-you-know', headline: 'Dog Dining Since the 1800s', body: 'Wealthy Parisians brought dogs to fancy restaurants in the 1800s. It became so common that restaurants began offering special dog dishes - bouillon with rice and liver.', icon: '\u{1F4DC}' },
  { city: 'paris', type: 'tip', headline: 'Metro Tip: Small Dogs Only', body: 'Dogs must fit inside a carrier bag to travel on the Paris metro and buses. Larger dogs? You\'ll need a taxi or a long walk.', icon: '\u{1F687}' },
  { city: 'paris', type: 'did-you-know', headline: 'France\'s #1 Breed: Chihuahua', body: 'The Chihuahua is the most popular dog breed in France at 13.7%. Perfect for navigating narrow caf\u00E9 terraces!', icon: '\u{1F415}' },

  // GENEVA
  { city: 'geneva', type: 'did-you-know', headline: 'World\'s Strictest Dog Laws', body: 'Switzerland is the ONLY European country requiring all dogs to be microchipped and registered by age 3 months.', icon: '\u{1F4CB}' },
  { city: 'geneva', type: 'did-you-know', headline: '4-Hour Loneliness Rule', body: 'Swiss law says dogs shouldn\'t be left alone for more than 4 hours. One of the strictest loneliness regulations in the world.', icon: '\u23F0' },
  { city: 'geneva', type: 'did-you-know', headline: 'Shock Collars Are Illegal', body: 'Switzerland banned shock collars and punishment-based training devices. One of few countries globally with this protection.', icon: '\u{1F6AB}' },
  { city: 'geneva', type: 'did-you-know', headline: 'Dogs Ride Free on Swiss Trains', body: 'Dogs in carriers travel FREE on Swiss trains, trams, and buses. On a leash? Half-fare. One of Europe\'s best transit deals for pups.', icon: '\u{1F682}' },
  { city: 'geneva', type: 'did-you-know', headline: 'Large Dog License Test', body: 'Owners of dogs over 25kg in Geneva must pass a behavior and training test with an authorized trainer. Responsible ownership by law.', icon: '\u{1F4DD}' },

  // LONDON
  { city: 'london', type: 'did-you-know', headline: '164 Dog-Friendly Parks', body: 'London boasts 164 dedicated dog-friendly parks - making it one of the most dog-welcoming cities in the world.', icon: '\u{1F333}' },
  { city: 'london', type: 'did-you-know', headline: 'Dogs Ride the Tube Free', body: 'Dogs travel free on London\'s Underground, buses, trams, and trains. But they must be carried on escalators to protect their paws!', icon: '\u{1F687}' },
  { city: 'london', type: 'did-you-know', headline: 'Dog-Friendly Cinema Nights', body: 'Picturehouse Cinemas hosts dog-friendly film screenings. The Rooftop Film Club even runs special \'Wooftop\' events.', icon: '\u{1F3AC}', placeName: 'Picturehouse Cinemas London' },
  { city: 'london', type: 'did-you-know', headline: 'Doggie Roasts for \u00A35', body: 'The Devonshire in Balham serves a signature \'doggie roast\' - chicken with carrots, cabbage, and low-salt gravy.', icon: '\u{1F357}', placeName: 'The Devonshire Balham London' },
  { city: 'london', type: 'did-you-know', headline: 'London is the UK\'s Cat City', body: 'Surprise: London is the only region in the UK where cats outnumber dogs. Just 9% of Londoners own dogs vs. 14% with cats.', icon: '\u{1F62E}' },

  // BARCELONA
  { city: 'barcelona', type: 'did-you-know', headline: '100+ Off-Leash Dog Areas', body: 'Barcelona has over 100 designated off-leash areas across parks, plazas, and public spaces. Dog freedom is built into the city.', icon: '\u{1F415}' },
  { city: 'barcelona', type: 'did-you-know', headline: 'Europe\'s First Dog Water Park', body: 'Perros al Agua is Europe\'s first dog water park - large pools, water slides, jumping ramps, sand dunes, and even a restaurant.', icon: '\u{1F3CA}', placeName: 'Perros al Agua Barcelona' },
  { city: 'barcelona', type: 'did-you-know', headline: '\u20AC1,500 Fine for Not Cleaning Up', body: 'Barcelona doesn\'t mess around: a \u20AC1,500 fine for not picking up after your dog. That\'s 22x more than Paris!', icon: '\u{1F4B8}' },
  { city: 'barcelona', type: 'did-you-know', headline: 'Spain #1 in Dog Ownership', body: 'Spain has the highest rate of dog ownership per capita in Europe - 71.48% of households own at least one dog.', icon: '\u{1F3C6}' },

  // LOS ANGELES
  { city: 'losangeles', type: 'did-you-know', headline: 'Only 1 Off-Leash Dog Beach', body: 'Despite 70 miles of coastline, LA County has only ONE official off-leash dog beach: Rosie\'s Dog Beach in Long Beach.', icon: '\u{1F3D6}\uFE0F', placeName: 'Rosie\'s Dog Beach Long Beach' },
  { city: 'losangeles', type: 'did-you-know', headline: 'World\'s Largest Corgi Gathering', body: 'LA hosts \'Corgi Beach Day\' - the largest Corgi gathering in the world. Started with 15 dogs in 2012, now thousands attend.', icon: '\u{1F415}' },
  { city: 'losangeles', type: 'did-you-know', headline: 'Dogs Surf in Competition', body: 'Surf City Surf Dog in Huntington Beach is an annual competition where dogs catch real waves. Free to attend.', icon: '\u{1F3C4}' },
  { city: 'losangeles', type: 'did-you-know', headline: 'Runyon Canyon: 90 Acres Off-Leash', body: 'Runyon Canyon features a 90-acre off-leash dog park with hiking trails and Hollywood Hills views.', icon: '\u{1F3D4}\uFE0F', placeName: 'Runyon Canyon Park Los Angeles' },
  { city: 'losangeles', type: 'did-you-know', headline: '2.6 Million Dogs in LA', body: 'Only 19.9% of LA households own dogs (vs. 39.1% nationally), but the city is home to 2.6 million dogs.', icon: '\u{1F4CA}' },

  // NEW YORK CITY
  { city: 'nyc', type: 'did-you-know', headline: '600,000 Dogs in NYC', body: '600,000 dogs call NYC home. The pet industry generates $1.5 billion in annual economic activity in the city.', icon: '\u{1F3D9}\uFE0F' },
  { city: 'nyc', type: 'did-you-know', headline: '75% Buy Their Dog a Puppacino', body: '75% of New Yorkers have treated their pet to a \'puppacino\' at a caf\u00E9. In Mississippi, it\'s only 2%.', icon: '\u2615' },
  { city: 'nyc', type: 'did-you-know', headline: 'More on Dog Grooming Than Their Own', body: '55% of NYC dog owners spend more on their pet\'s grooming than their own personal grooming.', icon: '\u{1F487}' },
  { city: 'nyc', type: 'did-you-know', headline: 'Central Park: 20 Off-Leash Zones', body: 'Central Park has ~20 off-leash areas during early morning (6-9 AM) and evening (9 PM-1 AM).', icon: '\u{1F33F}', placeName: 'Central Park New York' },
  { city: 'nyc', type: 'did-you-know', headline: '42% Throw Dog Birthday Parties', body: '42% of NYC dog owners throw birthday parties for their pets. Dog yoga and pet bakeries are standard.', icon: '\u{1F382}' },

  // SYDNEY
  { city: 'sydney', type: 'did-you-know', headline: 'The 2-Dog Rule', body: 'In NSW, the standard legal limit is just 2 dogs per household. You need a special permit for more.', icon: '\u270C\uFE0F' },
  { city: 'sydney', type: 'did-you-know', headline: '43% of Centennial Park is Off-Leash', body: 'About 43% of Sydney\'s massive Centennial Parklands is designated as off-leash territory.', icon: '\u{1F333}', placeName: 'Centennial Parklands Sydney' },
  { city: 'sydney', type: 'did-you-know', headline: 'Dog Beach Culture', body: 'Sydney\'s Sirius Cove and Greenhills Beach offer dedicated off-leash beach time for dogs.', icon: '\u{1F3D6}\uFE0F' },
  { city: 'sydney', type: 'did-you-know', headline: 'Escape-Proof Fences Required', body: 'NSW law requires yard fences that dogs \'cannot jump, dig under or squeeze through.\'', icon: '\u{1F3E0}' },
  { city: 'sydney', type: 'did-you-know', headline: 'Rental Rights for Dog Owners', body: 'New NSW laws now protect tenants\' rights to keep dogs in rental properties.', icon: '\u{1F3E2}' },

  // TOKYO
  { city: 'tokyo', type: 'did-you-know', headline: 'Virtually Zero Dog Waste on Streets', body: 'Tokyo\'s dog owners are so responsible about cleanup, you almost never see dog droppings on the streets.', icon: '\u2728' },
  { city: 'tokyo', type: 'did-you-know', headline: 'Tiny Dogs Rule Tokyo', body: 'Tokyo apartments are small, so Chihuahuas, Miniature Dachshunds, and Toy Poodles dominate.', icon: '\u{1F3E0}' },
  { city: 'tokyo', type: 'did-you-know', headline: 'Yoyogi Park\'s 3-Tier Dog Run', body: 'Yoyogi Park divides its dog run by size: large, medium, and small. Prevents hierarchy issues.', icon: '\u{1F4D0}', placeName: 'Yoyogi Park Dog Run Tokyo' },
  { city: 'tokyo', type: 'did-you-know', headline: '$9 Billion Pet Industry', body: 'Japan\'s pet industry is worth 1.4 trillion yen (~$9B USD). In Tokyo, dogs are treated like royalty.', icon: '\u{1F48E}' },
  { city: 'tokyo', type: 'did-you-know', headline: 'Hachiko\'s Legacy Lives On', body: 'Hachiko\'s statue at Shibuya Station remains one of Tokyo\'s most-visited spots. A loyalty story woven into Japanese identity.', icon: '\u{1F5FF}', placeName: 'Hachiko Statue Shibuya Tokyo' },

  // ════════════════════════════════════════════════════════════════
  // WAVE 2 — Dog-First Content (Events, Spotlights, Tips, Fun)
  // ════════════════════════════════════════════════════════════════

  // ─── PARIS (7 posts) ──────────────────────────────────────────
  { city: 'paris', type: 'spotlight', headline: 'Best Terrace for Pups in Le Marais', body: 'The cafés along Rue des Rosiers are famous for welcoming dogs with water bowls and treats. Your pup gets served before you do. That\'s Parisian hospitality.', icon: '☕\u{1F43E}', placeName: 'Rue des Rosiers Le Marais Paris' },
  { city: 'paris', type: 'fun', headline: 'POV: Your Dog Has a Better Croissant Than You', body: 'Paris bakeries now sell dog-friendly croissants and pastries. Your golden retriever eating a pain au chocolat at a sidewalk café is peak main character energy.', icon: '\u{1F950}\u{1F436}' },
  { city: 'paris', type: 'guide', headline: 'Off-Leash in Paris: The Complete List', body: 'Bois de Vincennes, Bois de Boulogne, Jardin des Tuileries (early mornings), Parc de Bercy — here are the best spots to let your pup run free in Paris.', icon: '\u{1F3C3}\u{1F43E}' },
  { city: 'paris', type: 'event', headline: 'Woofstock Paris Returns This Summer', body: 'The annual dog festival in Parc de la Villette brings together hundreds of pups for agility shows, treats, and the famous Cutest Mutt competition. Free entry for all dogs and humans.', icon: '\u{1F389}\u{1F436}', placeName: 'Parc de la Villette Paris' },
  { city: 'paris', type: 'tip', headline: 'Your Dog Can Join You in Most Paris Hotels', body: '85% of Paris hotels accept dogs, many at no extra charge. Pro tip: boutique hotels in Saint-Germain are especially pup-friendly — some leave treats on the pillow.', icon: '\u{1F3E8}\u{1F43E}' },
  { city: 'paris', type: 'fun', headline: 'French Dogs Don\'t Do Fetch', body: 'Studies show French dogs are trained differently — less "sit/stay/fetch" and more socialized for café culture. They\'re basically tiny Parisians who judge your outfit.', icon: '\u{1F1EB}\u{1F1F7}\u{1F436}' },

  // ─── GENEVA (6 posts) ─────────────────────────────────────────
  { city: 'geneva', type: 'spotlight', headline: 'Lake Geneva\'s Secret Dog Beach', body: 'Plage de la Savonnière near Versoix is Geneva\'s best-kept secret — a quiet lakeside beach where dogs swim freely with stunning Alpine views. Locals only... until now.', icon: '\u{1F3D6}\u{1F43E}', placeName: 'Plage de la Savonnière Versoix Geneva' },
  { city: 'geneva', type: 'guide', headline: 'Hiking With Your Dog in the Swiss Alps', body: 'Trails from Carouge to Salève, the Jura ridge walks — Geneva is a gateway to epic dog hikes. Most mountain huts welcome dogs and even provide water stations.', icon: '⛰\u{1F43E}' },
  { city: 'geneva', type: 'fun', headline: 'Swiss Dogs Are Better Trained Than Your Boss', body: 'Geneva mandates professional training courses for first-time dog owners. The result? Swiss dogs are absurdly well-behaved. They probably file their own taxes too.', icon: '\u{1F9D1}‍\u{1F393}\u{1F436}' },
  { city: 'geneva', type: 'tip', headline: 'Dog Poop Bags Are Free All Over Geneva', body: 'Green dispensers on nearly every street corner provide free bags. Geneva takes cleanup seriously — and makes it easy. No excuses, no fines.', icon: '♻\u{1F43E}' },
  { city: 'geneva', type: 'event', headline: 'Fête de la Musique: Dogs Welcome', body: 'Geneva\'s annual free music festival across the city is surprisingly dog-friendly. Outdoor stages, laid-back vibes, and your pup gets to enjoy live jazz by the lake.', icon: '\u{1F3B6}\u{1F436}' },
  { city: 'geneva', type: 'spotlight', headline: 'Parc des Bastions: Where Dogs Meet History', body: 'The famous Reformation Wall park doubles as Geneva\'s favorite dog hangout. Pups play in the shadow of 500-year-old history while their owners play giant chess.', icon: '♟\u{1F43E}', placeName: 'Parc des Bastions Geneva' },

  // ─── LONDON (7 posts) ─────────────────────────────────────────
  { city: 'london', type: 'spotlight', headline: 'This Pub Has a Bigger Dog Menu Than People Menu', body: 'The Baring in Islington serves a dedicated dog menu including "Barkscotti" and a Sunday roast for pups. They also have a dog beer garden. Yes, really.', icon: '\u{1F37A}\u{1F436}', placeName: 'The Baring pub Islington London' },
  { city: 'london', type: 'fun', headline: 'London Dogs Have Their Own Fashion Week', body: 'Paws in the Park hosts an annual dog fashion show with actual runway walks, designer outfits, and crowd cheering. Your corgi in a bow tie deserves this moment.', icon: '\u{1F451}\u{1F43E}' },
  { city: 'london', type: 'guide', headline: 'Best Dog Walks Along the Thames', body: 'From Richmond Park deer spotting to the South Bank buzz — these Thames-side walks give your pup river views, squirrel chases, and the best sniff trails in London.', icon: '\u{1F30A}\u{1F43E}' },
  { city: 'london', type: 'event', headline: 'Pup Up Café: Dachshund Edition', body: 'London\'s viral Pup Up Café series runs breed-specific meetups. The Dachshund edition fills out in minutes — 100+ sausage dogs in one room. Pure chaos. Pure joy.', icon: '\u{1F32D}\u{1F436}', placeName: 'Pup Up Cafe London' },
  { city: 'london', type: 'tip', headline: 'Every London Park Has Off-Leash Hours', body: 'Most Royal Parks allow dogs off-leash except in designated wildlife areas. Hampstead Heath and Battersea Park are local favorites for dawn zoomies.', icon: '\u{1F305}\u{1F43E}' },
  { city: 'london', type: 'spotlight', headline: 'Harrods Has a Dog Spa', body: 'The Harrods Urban Retreat offers full grooming, pawdicures, and blueberry facials for dogs. Starting at £65. Your dog will come out posher than you went in.', icon: '\u{1F485}\u{1F43E}', placeName: 'Harrods London' },

  // ─── BARCELONA (6 posts) ──────────────────────────────────────
  { city: 'barcelona', type: 'spotlight', headline: 'This Beach Bar Serves Dog Smoothies', body: 'Chiringuito del Mar in Barceloneta serves frozen bone broth smoothies for dogs alongside your sangria. Your pup gets the beach day they deserve.', icon: '\u{1F379}\u{1F436}', placeName: 'Chiringuito del Mar Barceloneta Barcelona' },
  { city: 'barcelona', type: 'guide', headline: 'Barcelona\'s Dog-Friendly Beaches: The Full Guide', body: 'Platja de Llevant is the city\'s official dog beach, but locals know Platja del Fòrum and Platja de Sant Adrià are less crowded and equally pup-friendly.', icon: '\u{1F3D6}\u{1F43E}' },
  { city: 'barcelona', type: 'fun', headline: 'Barcelona Dogs Party Harder Than You', body: 'Sant Joan (June 23) is Spain\'s biggest street party and dogs are everywhere — wearing bandanas, eating treats from pop-up stalls, partying until dawn. Living their best vida.', icon: '\u{1F386}\u{1F436}' },
  { city: 'barcelona', type: 'event', headline: 'Fira de Mascotes: Barcelona\'s Biggest Pet Fair', body: 'The annual pet expo in Montjuïc brings dog brands, rescues, agility demos, and adoption drives together. The treats aisle alone is worth the trip.', icon: '\u{1F3AA}\u{1F43E}' },
  { city: 'barcelona', type: 'tip', headline: 'Dogs Ride Barcelona Metro for Free', body: 'Dogs travel free on Barcelona\'s metro, buses, and trams — no carrier needed for small dogs, muzzle + leash for larger breeds. One of Europe\'s best deals for dog owners.', icon: '\u{1F687}\u{1F43E}' },
  { city: 'barcelona', type: 'spotlight', headline: 'Park Güell\'s Dog-Friendly Secret Path', body: 'Skip the ticketed Gaudí zone — the free park area around Park Güell is off-leash friendly with stunning mosaic views. Locals bring their dogs here daily at sunset.', icon: '\u{1F305}\u{1F436}', placeName: 'Park Güell Barcelona' },

  // ─── LOS ANGELES (6 posts) ────────────────────────────────────
  { city: 'losangeles', type: 'spotlight', headline: 'This Hollywood Café Treats Dogs Like Celebrities', body: 'The Larchmont Bungalow brings out water and treats for every dog before asking what humans want. Regulars say their golden has a better social life than they do.', icon: '\u{1F31F}\u{1F436}', placeName: 'Larchmont Bungalow Cafe Los Angeles' },
  { city: 'losangeles', type: 'fun', headline: 'LA Dogs Have Their Own Instagram Agents', body: 'Only in LA: professional pet influencer agencies manage Instagram accounts for dogs with 100K+ followers. Your neighbor\'s poodle might be making more than you.', icon: '\u{1F4F1}\u{1F43E}' },
  { city: 'losangeles', type: 'guide', headline: 'Best Sunrise Hikes With Your Dog in LA', body: 'Griffith Observatory trail, Temescal Gateway, Eaton Canyon — these sunrise hikes give you and your pup golden hour views without the midday heat.', icon: '\u{1F305}\u{1F43E}' },
  { city: 'losangeles', type: 'event', headline: 'Strut Your Mutt: LA\'s Biggest Dog Walk', body: 'Best Friends Animal Society hosts this annual 2-mile charity walk with thousands of dogs, costume contests, and an adoption village. All breeds, all vibes.', icon: '\u{1F3C5}\u{1F436}' },
  { city: 'losangeles', type: 'tip', headline: 'LA Dog Parks Have Their Own Yelp Rankings', body: 'Sepulveda Basin, Laurel Canyon, Silverlake — LA takes dog parks as seriously as restaurants. Check the reviews before you go. Some have splash pads.', icon: '⭐\u{1F43E}' },
  { city: 'losangeles', type: 'spotlight', headline: 'The Farmer\'s Market Dogs of LA', body: 'Sunday morning at the Hollywood Farmer\'s Market is basically a dog parade. Vendors keep treats behind the counter. It\'s LA\'s most wholesome weekly tradition.', icon: '\u{1F955}\u{1F436}', placeName: 'Hollywood Farmers Market Los Angeles' },

  // ─── NEW YORK CITY (6 posts) ──────────────────────────────────
  { city: 'nyc', type: 'spotlight', headline: 'This Brooklyn Bar Lets Dogs Sit at the Counter', body: 'The Passenger in Williamsburg has stools designed for dogs to sit at the bar. They get their own menu of frozen treats. No ID required (for the dogs).', icon: '\u{1F37B}\u{1F436}', placeName: 'The Passenger bar Williamsburg Brooklyn' },
  { city: 'nyc', type: 'fun', headline: 'NYC Dogs Take Taxis Better Than Most Humans', body: 'It\'s illegal for NYC taxis to refuse a ride because of a dog. So your terrier has better transportation rights than you do during rush hour.', icon: '\u{1F695}\u{1F43E}' },
  { city: 'nyc', type: 'guide', headline: 'Dog-Friendly Brunch Guide: Manhattan Edition', body: 'Westville, The Smith, Jack\'s Wife Freda — these spots have heated patios, under-table bowls, and servers who greet your dog by name. Reservations for two (plus paws).', icon: '\u{1F373}\u{1F43E}', placeName: 'Jack\'s Wife Freda New York' },
  { city: 'nyc', type: 'event', headline: 'Tompkins Square Halloween Dog Parade', body: 'The largest dog Halloween costume parade in the world. 500+ dogs in costumes, thousands of spectators, and the most creative outfits you\'ve ever seen on a chihuahua.', icon: '\u{1F383}\u{1F436}' },
  { city: 'nyc', type: 'tip', headline: 'Off-Leash Before 9 AM in Every NYC Park', body: 'NYC\'s official off-leash policy: before 9 AM and after 9 PM in most parks. Central Park, Prospect Park, Fort Greene — early birds get the zoomies.', icon: '\u{1F305}\u{1F43E}' },
  { city: 'nyc', type: 'spotlight', headline: 'The Dog Bakeries of the Upper West Side', body: 'Three Dog Bakery and Barkery in the UWS bake fresh pupcakes, peanut butter biscuits, and birthday cakes daily. The line wraps around the block on Saturday mornings.', icon: '\u{1F382}\u{1F43E}', placeName: 'Three Dog Bakery New York' },

  // ─── SYDNEY (6 posts) ─────────────────────────────────────────
  { city: 'sydney', type: 'spotlight', headline: 'Sydney\'s Most Instagrammed Dog Beach', body: 'Sirius Cove in Mosman is where Sydney\'s most photogenic dogs gather at golden hour. Harbour Bridge backdrop, crystal water, off-leash bliss. Your feed will thank you.', icon: '\u{1F4F8}\u{1F436}', placeName: 'Sirius Cove Reserve Mosman Sydney' },
  { city: 'sydney', type: 'fun', headline: 'Aussie Dogs Have Better Beach Days Than You', body: 'Sydney has 12+ dedicated dog beaches. While you stress about sunscreen, your kelpie is catching waves, chasing seagulls, and living their absolute best life.', icon: '\u{1F3C4}\u{1F43E}' },
  { city: 'sydney', type: 'guide', headline: 'Coastal Walk With Your Dog: Bondi to Coogee', body: 'The iconic 6km Bondi to Coogee walk is dog-friendly before 10 AM. Start early for empty paths, ocean views, and rock pool swims for brave pups.', icon: '\u{1F30A}\u{1F43E}' },
  { city: 'sydney', type: 'event', headline: 'Million Paws Walk: Sydney Edition', body: 'RSPCA\'s annual charity walk brings thousands of dogs to Sydney Olympic Park. Fancy dress competition, longest-ears contest, and the best dog community vibe in Australia.', icon: '\u{1F3C6}\u{1F436}' },
  { city: 'sydney', type: 'tip', headline: 'Sydney Ferries Welcome Dogs On Board', body: 'Dogs travel free on Sydney Ferries (leashed on the lower deck). Take the Manly ferry with your pup for the most scenic commute in Australia.', icon: '⛴\u{1F43E}' },
  { city: 'sydney', type: 'spotlight', headline: 'The Grounds of Alexandria: Pup Paradise', body: 'This café-garden-market combo in Alexandria is a dog lovers\' dream. Pups get their own menu, there\'s a resident pig named Kevin, and weekend mornings are pure chaos.', icon: '\u{1F331}\u{1F436}', placeName: 'The Grounds of Alexandria Sydney' },

  // ─── TOKYO (6 posts) ──────────────────────────────────────────
  { city: 'tokyo', type: 'spotlight', headline: 'Dog Heart Café: Tea With 20 Rescue Dogs', body: 'This Harajuku café lets you spend an hour with resident rescue dogs over matcha. All dogs are adoptable. It\'s therapy and matchmaking in one visit.', icon: '\u{1F375}\u{1F436}', placeName: 'Dog Heart Cafe Harajuku Tokyo' },
  { city: 'tokyo', type: 'fun', headline: 'Tokyo Dogs Ride in Strollers and Nobody Blinks', body: 'Dog strollers are completely normal in Tokyo. High-end ones cost more than baby strollers. Your shiba inu deserves climate-controlled suspension and a cup holder.', icon: '\u{1F476}\u{1F43E}' },
  { city: 'tokyo', type: 'guide', headline: 'Shinjuku Gyoen to Meiji Shrine: A Dog Day in Tokyo', body: 'Start at Shinjuku Gyoen\'s garden paths (leashed), cross to Meiji Shrine forest, end at Yoyogi dog run. Three iconic Tokyo spots, one perfect dog day.', icon: '\u{1F5FE}\u{1F43E}' },
  { city: 'tokyo', type: 'event', headline: 'Inunohi: Japan\'s Day of the Dog', body: 'November 1 is Inunohi in Japan — shrines offer blessings for dogs, shops run pet sales, and families celebrate their four-legged members. The whole country goes dog-crazy.', icon: '⛩\u{1F436}' },
  { city: 'tokyo', type: 'tip', headline: 'Dog-Friendly Hotels in Shinjuku', body: 'Hotel Gracery, Keio Plaza, and several boutique ryokan in Shinjuku welcome small dogs. Some provide dog beds, food bowls, and even pet-sitting services while you explore.', icon: '\u{1F3E8}\u{1F43E}' },
  { city: 'tokyo', type: 'spotlight', headline: 'Komazawa Olympic Dog Park', body: 'Tokyo\'s largest dedicated dog park has separate areas for small and large dogs, agility equipment, and a café with a front-row view of the action. Weekend mornings are legendary.', icon: '\u{1F3DF}\u{1F436}', placeName: 'Komazawa Olympic Park Dog Run Tokyo' },
  { city: 'paris', type: 'spotlight', headline: 'Canal Saint-Martin: Paris\'s Chillest Dog Walk', body: 'The tree-lined canal banks are where Parisian dog owners gather at golden hour. Iron bridges, quiet water reflections, and your pup socializing with every passing bichon.', icon: '\u{1F309}\u{1F43E}', placeName: 'Canal Saint-Martin Paris' },
  { city: 'london', type: 'fun', headline: 'The Queen\'s Corgis Changed British Dog Culture', body: 'The Royal Corgis made the breed a national icon. Today London has more corgis per capita than any city on earth. You can\'t walk through Hyde Park without seeing one.', icon: '\u{1F451}\u{1F436}' },

  // ════════════════════════════════════════════════════════════════
  // WAVE 3 — Tips & Guides Heavy (for text_card visual variety)
  // ════════════════════════════════════════════════════════════════

  // ─── PARIS ────────────────────────────────────────────────────
  { city: 'paris', type: 'tip', headline: 'Avoid Dog Fines: Know the Leash Zones', body: 'Paris parks have specific leash vs off-leash sections marked by signs. The fine for off-leash in a leash zone? Up to €150. Look for the green "espace canin" signs.', icon: '⚠️🐾' },
  { city: 'paris', type: 'guide', headline: 'Dog-Friendly Shopping in Paris', body: 'Le Bon Marché, Galeries Lafayette, and most boutiques on Rue du Faubourg Saint-Honoré welcome well-behaved dogs. Your pup can judge French fashion in person.', icon: '🛍🐾' },
  { city: 'paris', type: 'tip', headline: 'Free Water Bowls at Every Paris Fountain', body: 'Paris has 1,200+ public drinking fountains (Wallace fountains) and most have a low basin designed specifically for dogs. Hydration sorted on every walk.', icon: '💧🐾' },

  // ─── GENEVA ───────────────────────────────────────────────────
  { city: 'geneva', type: 'tip', headline: 'Register Your Dog Within 10 Days', body: 'Moving to Geneva with a dog? Swiss law requires registration within 10 days of arrival. The annual dog tax is CHF 80-160 depending on the commune.', icon: '📋🐾' },
  { city: 'geneva', type: 'guide', headline: '3 Dog-Friendly Day Trips From Geneva', body: 'Yvoire medieval village (30 min), Annecy lakeside walk (45 min), Lavaux vineyard trails (1 hr). All welcome dogs and all have stunning Alpine views.', icon: '🚗🐾' },
  { city: 'geneva', type: 'fun', headline: 'Geneva Dogs Have Their Own Insurance', body: 'Swiss dog liability insurance is basically mandatory — and it covers everything from chewed shoes to escaped-dog incidents. Your pup is better insured than most freelancers.', icon: '📄🐾' },

  // ─── LONDON ───────────────────────────────────────────────────
  { city: 'london', type: 'tip', headline: 'Carry Your Dog on Escalators — It\'s the Law', body: 'TfL rules say dogs must be carried on escalators to protect their paws from getting caught. Small dog? Carry them. Big dog? Take the lift or stairs.', icon: '🚇🐾' },
  { city: 'london', type: 'guide', headline: 'Top 5 Dog-Friendly Pubs in London', body: 'The Chesham Arms (Hackney), The Scolt Head (Dalston), The Baring (Islington), The Flask (Hampstead), The Ship (Wandsworth). Dog menus, water bowls, and treats at all five.', icon: '🍺🐾' },
  { city: 'london', type: 'tip', headline: 'Book Dog-Friendly Hotels Early in London', body: 'Only about 40% of London hotels accept dogs, and they fill up fast. Kimpton, The Hoxton, and Premier Inn are reliably dog-friendly. Book at least 2 weeks ahead.', icon: '🏨🐾' },

  // ─── BARCELONA ────────────────────────────────────────────────
  { city: 'barcelona', type: 'tip', headline: 'Muzzle Required on Barcelona Metro', body: 'Dogs over 5kg must wear a muzzle on Barcelona public transit. Soft basket muzzles are fine — buy one at any pet shop on Carrer de Pelai before you ride.', icon: '🚇🐾' },
  { city: 'barcelona', type: 'guide', headline: 'Dog-Friendly Neighborhoods in Barcelona', body: 'Gràcia has the most off-leash parks. Barceloneta has beach access. El Born has pet-friendly cafés everywhere. Eixample has wide sidewalks. Pick your vibe.', icon: '🏘🐾' },
  { city: 'barcelona', type: 'fun', headline: 'Barcelona Has a Dog Mayor', body: 'The neighborhood of Poble Sec once elected a dog as its honorary mayor. Campaign promise: more fire hydrants. Won by a landslide of tail wags.', icon: '🗳🐾' },

  // ─── LOS ANGELES ──────────────────────────────────────────────
  { city: 'losangeles', type: 'tip', headline: 'Avoid Midday Hikes: Paw Burn is Real', body: 'LA pavement hits 150°F in summer sun. If you can\'t hold your hand on the ground for 7 seconds, it\'s too hot for paws. Stick to early morning or sunset hikes.', icon: '🌡🐾' },
  { city: 'losangeles', type: 'guide', headline: 'Dog-Friendly Patios: Silver Lake Edition', body: 'Sawyer, All Day Baby, Pine & Crane, Botanica — Silver Lake has the best dog-friendly patio scene in LA. Most have water bowls and shade structures built in.', icon: '☀️🐾' },
  { city: 'losangeles', type: 'tip', headline: 'LA Requires a Dog License by 4 Months', body: 'All dogs in LA must be licensed by 4 months old. It\'s $20/year for spayed/neutered dogs, $100 for unaltered. Penalties for no license can be steep.', icon: '📄🐾' },

  // ─── NEW YORK CITY ────────────────────────────────────────────
  { city: 'nyc', type: 'tip', headline: 'Alternate Side Parking = Prime Dog Walking', body: 'During alternate side parking hours, NYC streets are quieter and sidewalks emptier. Seasoned dog owners time their walks to these windows. Pro move.', icon: '🚗🐾' },
  { city: 'nyc', type: 'guide', headline: 'Best Dog Runs in Brooklyn — Ranked', body: 'Prospect Park (biggest), McCarren Park (most social), Hillside Dog Park (best views), Fort Greene Park (quietest mornings). Brooklyn takes dog runs seriously.', icon: '🏆🐾' },
  { city: 'nyc', type: 'fun', headline: 'NYC Has Professional Dog Nannies', body: 'Not walkers — nannies. They take your dog to playdates, enrichment classes, and even dog-friendly museums. Starting at $35/hour. Manhattan parenting has gone full circle.', icon: '👶🐾' },

  // ─── SYDNEY ───────────────────────────────────────────────────
  { city: 'sydney', type: 'tip', headline: 'Check Tick Season Before Bush Walks', body: 'Paralysis ticks are a serious risk in Sydney bushland from August to March. Tick prevention medication is essential before any walk north of the bridge.', icon: '🩺🐾' },
  { city: 'sydney', type: 'guide', headline: 'Sydney Harbour Dog Walk: The Full Route', body: 'Start at Bradleys Head, walk to Taronga Zoo wharf, ferry to Circular Quay, then along to the Opera House. 90 minutes of harbour views with your best mate.', icon: '🌊🐾' },
  { city: 'sydney', type: 'fun', headline: 'Sydney Cafés Do "Puppuccinos" Better', body: 'Forget Starbucks — Sydney baristas whip up proper puppuccinos with dog-safe oat milk foam and a bone-shaped biscuit on the side. Your pup has taste.', icon: '☕🐾' },

  // ─── TOKYO ────────────────────────────────────────────────────
  { city: 'tokyo', type: 'tip', headline: 'Dog Cafés vs Dog Runs: Know the Difference', body: 'Dog cafés charge ¥1,000-2,000/hour and provide resident dogs to play with. Dog runs are free outdoor parks for your own dog. Both are everywhere in Tokyo.', icon: '🏷🐾' },
  { city: 'tokyo', type: 'guide', headline: 'Dog-Friendly Shopping in Daikanyama', body: 'Daikanyama T-Site bookstore, the Sunday farmers market, and boutiques along Hachiman-dori all welcome dogs. It\'s Tokyo\'s most stylish neighborhood for a dog stroll.', icon: '🛍🐾' },
  { city: 'tokyo', type: 'fun', headline: 'Japanese Dogs Have Better Raincoats Than You', body: 'Tokyo pet stores sell designer raincoats, UV-blocking sunwear, and heated winter jackets for dogs. The pet fashion industry in Japan is a $2 billion market.', icon: '🧥🐾' },

  // ─── JULY 2026 REFILL (32 new facts) ─────────────────────────
  // PARIS
  { city: 'paris', type: 'tip', headline: 'Terrace Culture: Dogs Get a Seat', body: 'Most Parisian café terraces happily welcome dogs — many waiters bring a water bowl before you even ask. Indoors is at the owner\'s discretion, so terrace season is prime dog season.', icon: '☕🐾' },
  { city: 'paris', type: 'guide', headline: 'Bois de Vincennes: Paris\'s Biggest Dog Day Out', body: 'At nearly 1,000 hectares, the Bois de Vincennes is Paris\'s largest green space — wooded trails, lakes, and endless sniffing territory make it the city\'s best full-day dog outing.', icon: '🌳🐾' },
  { city: 'paris', type: 'tip', headline: 'Taking the TGV With Your Dog', body: 'Dogs ride French trains with their own pet ticket: small dogs travel in a carrier for a few euros, larger dogs pay a reduced fare and must be leashed and muzzled. Weekend in Provence, anyone?', icon: '🚄🐾' },
  { city: 'paris', type: 'fun', headline: 'The Poodle: France\'s Icon, Germany\'s Invention', body: 'The poodle is the unofficial dog of France — but it was originally bred in Germany as a water retriever. "Pudel" means "to splash." The French just made it fabulous.', icon: '🐩✨' },

  // GENEVA
  { city: 'geneva', type: 'tip', headline: 'Yes, Geneva Has a Dog Tax', body: 'Swiss cantons charge an annual dog tax, and Geneva is no exception — every dog must be registered with the canton. The upside: it funds some of Europe\'s best-kept parks and dog infrastructure.', icon: '💰🐾' },
  { city: 'geneva', type: 'guide', headline: 'Bois de la Bâtie: Geneva\'s Forest Escape', body: 'Perched above where the Rhône and Arve rivers meet, Bois de la Bâtie offers shaded forest paths and open lawns — a favorite escape for Geneva dogs just minutes from the city center.', icon: '🌲🐾' },
  { city: 'geneva', type: 'fun', headline: 'Barry: Switzerland\'s Greatest Hero Was a Dog', body: 'Barry the St. Bernard rescued more than 40 people in the Swiss Alps in the early 1800s. Two centuries later, the St. Bernard remains Switzerland\'s national dog and a symbol of alpine rescue.', icon: '🏔🐕' },
  { city: 'geneva', type: 'tip', headline: 'Fondue Is Not for Dogs', body: 'Sharing is caring — except with fondue. Cheese overload, garlic, and wine make it a no-go for pups. Pack dog treats for your restaurant nights so your co-pilot doesn\'t feel left out.', icon: '🫕🚫' },

  // LONDON
  { city: 'london', type: 'guide', headline: 'Hampstead Heath: 800 Acres of Dog Heaven', body: 'London\'s wildest green space lets dogs roam off-lead across most of its 800 acres — woodland trails, meadows, and swimming spots included. Arguably the best dog walk in any world capital.', icon: '🌳🐾' },
  { city: 'london', type: 'tip', headline: 'Royal Parks: Know Before You Go', body: 'All eight Royal Parks welcome dogs, but rules vary — Richmond and Bushy Park require leads near deer, and some wildlife areas are off-limits. Check signage and enjoy 5,000 acres of royal walkies.', icon: '👑🐾' },
  { city: 'london', type: 'fun', headline: 'The World\'s First Kennel Club Was Born Here', body: 'London founded The Kennel Club in 1873 — the world\'s first. Dog shows, breed standards, and pedigree records as we know them all trace back to a meeting in a Pall Mall apartment.', icon: '🏛🐕' },
  { city: 'london', type: 'spotlight', headline: 'Battersea: The World\'s Most Famous Rescue', body: 'Battersea Dogs & Cats Home has been rehoming London\'s strays since 1860 — over 3 million animals and counting. Visit, volunteer, or adopt a true Londoner.', icon: '🏠❤️', placeName: 'Battersea Dogs and Cats Home London' },

  // BARCELONA
  { city: 'barcelona', type: 'tip', headline: 'Riding the Barcelona Metro With Your Dog', body: 'Dogs are welcome on the Barcelona metro with a leash and muzzle — just avoid peak commuter hours when restrictions apply. One more reason Barcelona is Europe\'s most dog-practical city.', icon: '🚇🐾' },
  { city: 'barcelona', type: 'guide', headline: 'Llevant: Barcelona\'s Summer Dog Beach', body: 'Every summer, a section of Platja de Llevant becomes Barcelona\'s official dog beach — one of the few big-city beaches in Europe where dogs can swim in season. Arrive early for a good spot.', icon: '🏖🐕' },
  { city: 'barcelona', type: 'did-you-know', headline: 'In Spain, Pets Are Legally Family', body: 'Since 2022, Spanish law recognizes animals as sentient family members — courts can even decide shared custody of a dog in a divorce. Spain takes the "family member" thing literally.', icon: '⚖️🐾' },
  { city: 'barcelona', type: 'spotlight', headline: 'Montjuïc: Trails, Gardens and Harbour Views', body: 'The hillside paths of Montjuïc mix gardens, castle views, and Mediterranean panoramas — one of Barcelona\'s most underrated leashed dog walks, minutes from the city center.', icon: '🏰🐾', placeName: 'Parc de Montjuïc Barcelona' },

  // LOS ANGELES
  { city: 'losangeles', type: 'guide', headline: 'Lake Hollywood: The Easy Scenic Loop', body: 'The 3.2-mile paved loop around the Hollywood Reservoir is flat, shaded in stretches, and serves up postcard views of the Hollywood Sign — a perfect leashed walk for dogs of any fitness level.', icon: '🌄🐾' },
  { city: 'losangeles', type: 'tip', headline: 'The 7-Second Asphalt Test', body: 'LA sun turns pavement into a griddle. Press the back of your hand to the asphalt for 7 seconds — if it\'s too hot for you, it\'s too hot for paws. Hike early, hydrate often.', icon: '🌡🐾' },
  { city: 'losangeles', type: 'spotlight', headline: 'Angel City Brewery: Pups on the Patio and Beyond', body: 'Downtown LA\'s Angel City Brewery is famously dog-friendly — pups are welcome as you sample local craft beer. Water bowls provided; tail wags encouraged.', icon: '🍺🐾', placeName: 'Angel City Brewery Los Angeles' },
  { city: 'losangeles', type: 'fun', headline: 'Hollywood\'s First Superstar Was a Dog', body: 'Rin Tin Tin, a German Shepherd rescued from a WWI battlefield, became one of Hollywood\'s biggest box-office stars of the 1920s — reportedly saving Warner Bros. from bankruptcy.', icon: '🎬🐕' },

  // NYC
  { city: 'nyc', type: 'tip', headline: 'Subway Rule: If It Fits, It Rides', body: 'NYC subway rules say dogs must be in a container — which is why New Yorkers famously carry huskies in IKEA bags and duffels. If your dog fits in the bag, your dog rides the train.', icon: '🚇🐕' },
  { city: 'nyc', type: 'guide', headline: 'Hudson River Park: Dog Runs With Skyline Views', body: 'Hudson River Park runs 4 miles along Manhattan\'s west side with multiple dog runs along the way — river breezes, sunset views, and post-zoomies waterfront strolls included.', icon: '🌇🐾' },
  { city: 'nyc', type: 'spotlight', headline: 'Washington Square\'s Separate Small-Dog Run', body: 'Washington Square Park has a dedicated run just for small dogs — so the little ones get their zoomies without being bowled over. Big-dog run right next door.', icon: '🐕🤏', placeName: 'Washington Square Park New York' },
  { city: 'nyc', type: 'fun', headline: 'Balto Has Stood in Central Park Since 1925', body: 'The bronze statue of Balto — the sled dog who helped deliver lifesaving serum to Nome, Alaska — has watched over Central Park for a century. His nose is polished gold from millions of pats.', icon: '🗽🐕' },

  // SYDNEY
  { city: 'sydney', type: 'guide', headline: 'Sirius Cove: Mosman\'s Harbour Dog Beach', body: 'Sirius Cove Reserve is a calm harbourside beach where Sydney dogs paddle with a view across the water — check the posted off-leash hours and bring a towel for the ride home.', icon: '🌊🐕' },
  { city: 'sydney', type: 'tip', headline: 'Public Transport: Plan Ahead for Big Dogs', body: 'In Sydney, only assistance dogs ride trains; small pets in secure carriers may board buses, ferries and light rail at staff discretion. For big dogs, it\'s pet taxis or your own wheels.', icon: '🚆🐾' },
  { city: 'sydney', type: 'fun', headline: 'Australia\'s Dog Fence Stretches 5,600 km', body: 'The Dingo Fence — built to protect sheep country — runs about 5,600 km across Australia, making it one of the longest structures ever built. Australia does not do dogs by halves.', icon: '🦘🐕' },
  { city: 'sydney', type: 'did-you-know', headline: 'Nearly Half of Aussie Homes Have a Dog', body: 'Australia has one of the highest dog ownership rates in the world — close to half of all households share their home with a dog. In Sydney, the dog beach crowds prove it.', icon: '🏡🐕' },

  // TOKYO
  { city: 'tokyo', type: 'tip', headline: 'Small Dogs Ride Tokyo Trains — In a Case', body: 'JR and most Tokyo rail lines allow small dogs in enclosed carriers within strict size limits, usually for a small fee. Bigger dogs travel by car or pet taxi — this is a small-dog megacity.', icon: '🚃🐾' },
  { city: 'tokyo', type: 'guide', headline: 'Odaiba: A Full Dog Day by the Bay', body: 'Odaiba\'s waterfront promenades, seaside park lawns, and pet-welcoming outdoor malls make it Tokyo\'s easiest all-day dog outing — with Rainbow Bridge views for the photos.', icon: '🌉🐾' },
  { city: 'tokyo', type: 'fun', headline: 'Japan\'s Native Dogs Are National Monuments', body: 'Japan\'s six native breeds — including the Shiba Inu and Akita — are officially designated natural monuments, protected as living cultural treasures. The Shiba smirk is government-certified.', icon: '🇯🇵🐕' },
  { city: 'tokyo', type: 'did-you-know', headline: 'Japan Has More Pets Than Children', body: 'Registered cats and dogs in Japan outnumber children under 15 — a statistic that explains Tokyo\'s pet strollers, dog cafés, and department-store pet floors.', icon: '👶🐕' },
];

/**
 * Generate an Instagram caption for a content post
 * Supports multiple content types with dog-first, playful tone
 */
export function generateCaption(fact: ContentFact): string {
  const city = CITY_META[fact.city];
  if (!city) return '';

  // Type-specific intros — playful, dog-forward
  const intros: Record<string, string> = {
    'did-you-know': `${fact.icon} Did you know? ${fact.headline}`,
    'tip': `${fact.icon} Pro Pup Tip: ${fact.headline}`,
    'spotlight': `${fact.icon} ${fact.headline}`,
    'event': `${fact.icon} Mark your calendars! ${fact.headline}`,
    'guide': `${fact.icon} Your dog deserves this: ${fact.headline}`,
    'fun': `${fact.icon} ${fact.headline}`,
  };

  // Type-specific CTAs — optimized for engagement, saves, and shares
  const ctaVariants: Record<string, string[]> = {
    'did-you-know': [
      'Save this for your next trip! \u{1F43E} Drop a \u{1F43E} if you learned something new.',
      'Share this with someone planning a trip to ' + (CITY_META[fact.city]?.name || '') + ' \u{1F43E}',
      'Tag a dog parent who would LOVE this \u{1F447}',
    ],
    'tip': [
      'Tag a dog parent who needs to see this \u{1F43E}',
      'Save this \u{1F516} — you\'ll thank us later! What\'s your best local dog tip?',
      'Share this with your dog-walking group chat \u{1F4F2}\u{1F43E}',
    ],
    'spotlight': [
      'Know a hidden gem like this? Drop it in the comments \u{1F447}',
      'Save \u{1F516} + share with your adventure buddy! Have you been here?',
      'Tag someone who needs to visit this spot \u{1F43E}',
    ],
    'event': [
      'Tag your dog crew — who\'s going? \u{1F43E}\u{1F389}',
      'Save this \u{1F516} and share with a friend who\'d love this event!',
      'Will you be there? Drop a \u{1F43E} in the comments!',
    ],
    'guide': [
      'Save this \u{1F516} and share with your pack! Which spot is your fave?',
      'Bookmark this for your next visit! \u{1F43E} What would you add to the list?',
      'Share this with someone planning a dog-friendly trip \u{1F4F2}',
    ],
    'fun': [
      'Double tap if your pup agrees \u{1F43E} Tag a dog parent who gets this!',
      'Share this with someone who needs a laugh today \u{1F602}\u{1F43E}',
      'Is this your dog? Drop a \u{1F43E} if so!',
    ],
  };

  // Pick a CTA variant based on headline hash for consistency
  const hash = fact.headline.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variants = ctaVariants[fact.type] || ctaVariants['did-you-know'];
  const cta = variants[hash % variants.length];

  // Core hashtags + type-specific ones
  const baseHashtags = [
    '#PawCities',
    `#DogFriendly${city.name.replace(/\s/g, '')}`,
    `#${city.name.replace(/\s/g, '')}Dogs`,
    '#DogFriendly',
    '#DogsOfInstagram',
    '#DogLovers',
  ];

  const typeHashtags: Record<string, string[]> = {
    'did-you-know': ['#DogTravel', '#PetTravel', '#DogFriendlyTravel', '#TravelWithDogs', '#PetFriendly'],
    'tip': ['#DogTips', '#DogParent', '#PupTips', '#DogLife', '#DogOwnerTips'],
    'spotlight': ['#DogFriendlySpots', '#HiddenGem', '#DogAdventure', '#DogsWelcome', '#PetFriendlyPlaces'],
    'event': ['#DogEvent', '#DogMeetup', '#DogFriendlyEvents', '#DogsOfTheCity', '#PawtyTime'],
    'guide': ['#DogGuide', '#DogTravel', '#TravelWithDogs', '#DogBucketList', '#PetTravel'],
    'fun': ['#DogMom', '#DogDad', '#DogLife', '#PupLife', '#DogsBeingDogs'],
  };

  const hashtags = [...baseHashtags, ...(typeHashtags[fact.type] || typeHashtags['did-you-know'])].join(' ');

  return [
    intros[fact.type] || `${fact.icon} ${fact.headline}`,
    '',
    fact.body,
    '',
    `Explore dog-friendly ${city.name} at pawcities.com/${city.slug} \u{1F517}`,
    '',
    `Follow @thepawcities for daily dog-friendly tips across 8 cities \u{1F30D}`,
    '',
    cta,
    '',
    hashtags,
  ].join('\n');
}

// ─── Event Caption Generator ───────────────────────────────────────────────────

export interface EventCaptionInput {
  name: string;
  cityName: string;
  citySlug: string;       // CITY_META key (e.g. "nyc", "losangeles")
  venueName: string | null;
  dateDisplay: string;    // Pre-formatted date string (e.g. "Sat, Jun 14 at 2:00 PM")
  tags: string[];
  isFree: boolean;
  description: string | null;
}

/**
 * Generate an engaging Instagram caption for an event post.
 * Highlights the venue, date, and a clear CTA — designed to drive
 * saves, shares, and foot traffic for @thepawcities.
 */
export function generateEventCaption(event: EventCaptionInput): string {
  const city = CITY_META[event.citySlug];
  const cityName = city?.name || event.cityName;
  const cityEmoji = city?.emoji || '';
  const slug = city?.slug || event.citySlug;

  // Opening line — varies by event attributes for variety
  let opener: string;
  if (event.isFree) {
    opener = `${cityEmoji} FREE dog-friendly event in ${cityName}!`;
  } else {
    opener = `${cityEmoji} Dog-friendly event alert in ${cityName}!`;
  }

  // Event name as the hero line
  const heroLine = `🐾 ${event.name}`;

  // Date and venue details
  const details: string[] = [];
  if (event.dateDisplay) {
    details.push(`📅 ${event.dateDisplay}`);
  }
  if (event.venueName) {
    details.push(`📍 ${event.venueName}`);
  }

  // Short description snippet (first sentence or first 120 chars)
  let snippet = '';
  if (event.description) {
    const firstSentence = event.description.split(/[.!?]\s/)[0];
    snippet = firstSentence.length > 120
      ? firstSentence.slice(0, 117) + '...'
      : firstSentence + (firstSentence.endsWith('.') ? '' : '.');
  }

  // CTA — varied for engagement
  const ctaOptions = [
    'Save this \u{1F516} and tag your dog crew!',
    'Tag a friend who\'d bring their pup to this! \u{1F43E}',
    'Will you be there? Drop a \u{1F43E} in the comments!',
    'Share this with your pack! Who\'s going? \u{1F447}',
  ];
  const ctaHash = event.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const cta = ctaOptions[ctaHash % ctaOptions.length];

  // Link + follow CTA
  const link = `Discover more events at pawcities.com/${slug} \u{1F517}`;
  const followCta = 'Follow @thepawcities for daily dog-friendly events \u{1F30D}';

  // Hashtags — event-specific + city + base
  const hashtags: string[] = [
    '#PawCities',
    `#DogFriendly${cityName.replace(/\s/g, '')}`,
    `#${cityName.replace(/\s/g, '')}Dogs`,
    '#DogFriendlyEvents',
    '#DogsOfInstagram',
    '#DogEvent',
  ];

  // Add tag-based hashtags (up to 4)
  if (event.tags.length > 0) {
    for (const tag of event.tags.slice(0, 4)) {
      const clean = tag.trim().replace(/[- ]/g, '');
      if (clean) hashtags.push(`#${clean}`);
    }
  }

  hashtags.push('#DogFriendly', '#DogLovers', '#PetFriendly', '#DogLife');

  // Assemble caption
  const parts = [
    opener,
    '',
    heroLine,
    ...(details.length ? ['', ...details] : []),
    ...(snippet ? ['', snippet] : []),
    '',
    link,
    '',
    followCta,
    '',
    cta,
    '',
    hashtags.join(' '),
  ];

  return parts.join('\n');
}

// ─── Content Bank Selection ────────────────────────────────────────────────────

/**
 * Pick the next content to post based on what's already been posted.
 * Uses round-robin city rotation and avoids duplicate headlines.
 *
 * @param postedHeadlines - Set of headlines that have already been posted
 * @returns The next fact to post, or null if all content has been used
 */
// Track which visual style was last picked in this batch to enforce variety
let lastPickedStyle: string | null = null;

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

  // Visual style mapping for diversity
  const typeToStyle: Record<string, string> = {
    'did-you-know': 'mascot', 'fun': 'mascot',
    'spotlight': 'photo', 'event': 'photo',
    'tip': 'text_card', 'guide': 'text_card',
  };

  // Try each city in order of fewest posts
  for (const city of sortedCities) {
    const available = CONTENT_BANK.filter(
      f => f.city === city && !postedHeadlines.has(f.headline)
    );
    if (available.length > 0) {
      // Prefer a DIFFERENT visual style than the last pick for grid diversity
      if (lastPickedStyle && available.length > 1) {
        const different = available.filter(f => typeToStyle[f.type] !== lastPickedStyle);
        if (different.length > 0) {
          const pick = different[Math.floor(Math.random() * different.length)];
          lastPickedStyle = typeToStyle[pick.type] || 'mascot';
          return pick;
        }
      }
      // Fallback: random pick from available for variety
      const pick = available[Math.floor(Math.random() * available.length)];
      lastPickedStyle = typeToStyle[pick.type] || 'mascot';
      return pick;
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

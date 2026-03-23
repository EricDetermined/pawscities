import { useState, useRef, useCallback, useEffect } from "react";

// ─── Content Database ───────────────────────────────────────────────
const CITIES = {
  paris: { name: "Paris", country: "France", emoji: "🇫🇷", color: "#E8A87C" },
  geneva: { name: "Geneva", country: "Switzerland", emoji: "🇨🇭", color: "#85C1E9" },
  london: { name: "London", country: "United Kingdom", emoji: "🇬🇧", color: "#BB8FCE" },
  barcelona: { name: "Barcelona", country: "Spain", emoji: "🇪🇸", color: "#F1948A" },
  losangeles: { name: "Los Angeles", country: "United States", emoji: "🇺🇸", color: "#F9E79F" },
  nyc: { name: "New York City", country: "United States", emoji: "🇺🇸", color: "#AED6F1" },
  sydney: { name: "Sydney", country: "Australia", emoji: "🇦🇺", color: "#A9DFBF" },
  tokyo: { name: "Tokyo", country: "Japan", emoji: "🇯🇵", color: "#FADBD8" },
};

const CONTENT_BANK = [
  // ── PARIS ──
  { city: "paris", type: "did-you-know", headline: "1 Dog for Every 7 Parisians", body: "Paris has over 300,000 dogs — one of the highest dog-to-human ratios of any major city in Europe.", icon: "🐩" },
  { city: "paris", type: "did-you-know", headline: "Dogs Dine Indoors in Paris", body: "Unlike the US, France has no laws banning dogs from restaurants. Many Parisian cafés welcome dogs at the table and bring out water bowls.", icon: "🍷" },
  { city: "paris", type: "did-you-know", headline: "Dog Dining Since the 1800s", body: "Wealthy Parisians brought dogs to fancy restaurants in the 1800s. It became so common that restaurants began offering special dog dishes — bouillon with rice and liver.", icon: "📜" },
  { city: "paris", type: "tip", headline: "Metro Tip: Small Dogs Only", body: "Dogs must fit inside a carrier bag to travel on the Paris metro and buses. Larger dogs? You'll need a taxi or a long walk.", icon: "🚇" },
  { city: "paris", type: "did-you-know", headline: "France's #1 Breed: Chihuahua", body: "The Chihuahua is the most popular dog breed in France at 13.7%. Perfect for navigating narrow café terraces!", icon: "🐕" },
  { city: "paris", type: "tip", headline: "€68 Fine for Not Cleaning Up", body: "Paris enforces a €68 fine for owners who don't pick up after their dogs. Keep those bags handy!", icon: "💰" },

  // ── GENEVA ──
  { city: "geneva", type: "did-you-know", headline: "World's Strictest Dog Laws", body: "Switzerland is the ONLY European country requiring all dogs to be microchipped and registered by age 3 months.", icon: "📋" },
  { city: "geneva", type: "did-you-know", headline: "4-Hour Loneliness Rule", body: "Swiss law says dogs shouldn't be left alone for more than 4 hours. One of the strictest loneliness regulations in the world.", icon: "⏰" },
  { city: "geneva", type: "did-you-know", headline: "Shock Collars Are Illegal", body: "Switzerland banned shock collars and punishment-based training devices. One of few countries globally with this protection.", icon: "🚫" },
  { city: "geneva", type: "did-you-know", headline: "Dogs Ride Free on Swiss Trains", body: "Dogs in carriers travel FREE on Swiss trains, trams, and buses. On a leash? Half-fare. One of Europe's best transit deals for pups.", icon: "🚂" },
  { city: "geneva", type: "did-you-know", headline: "Large Dog License Test", body: "Owners of dogs over 25kg in Geneva must pass a behavior and training test with an authorized trainer. Responsible ownership by law.", icon: "📝" },

  // ── LONDON ──
  { city: "london", type: "did-you-know", headline: "164 Dog-Friendly Parks", body: "London boasts 164 dedicated dog-friendly parks — making it one of the most dog-welcoming cities in the world.", icon: "🌳" },
  { city: "london", type: "did-you-know", headline: "Dogs Ride the Tube Free", body: "Dogs travel free on London's Underground, buses, trams, and trains. But they must be carried on escalators to protect their paws!", icon: "🚇" },
  { city: "london", type: "did-you-know", headline: "Dog-Friendly Cinema Nights", body: "Picturehouse Cinemas hosts dog-friendly film screenings. The Rooftop Film Club even runs special 'Wooftop' events for dogs and their humans.", icon: "🎬" },
  { city: "london", type: "did-you-know", headline: "Doggie Roasts for £5", body: "The Devonshire in Balham serves a signature 'doggie roast' — chicken with carrots, cabbage, and low-salt gravy. Fine dining for your pup.", icon: "🍗" },
  { city: "london", type: "did-you-know", headline: "London is the UK's Cat City", body: "Surprise: London is the only region in the UK where cats outnumber dogs. Just 9% of Londoners own dogs vs. 14% with cats.", icon: "😮" },

  // ── BARCELONA ──
  { city: "barcelona", type: "did-you-know", headline: "More Dogs Than Children", body: "Barcelona has 172,971 dogs but only 165,482 children aged 0-12. Dogs officially outnumber kids in the city.", icon: "👶" },
  { city: "barcelona", type: "did-you-know", headline: "100+ Off-Leash Dog Areas", body: "Barcelona has over 100 designated off-leash areas across parks, plazas, and public spaces. Dog freedom is built into the city.", icon: "🐕" },
  { city: "barcelona", type: "did-you-know", headline: "Europe's First Dog Water Park", body: "Perros al Agua is Europe's first dog water park — large pools, water slides, jumping ramps, sand dunes, and even a restaurant.", icon: "🏊" },
  { city: "barcelona", type: "did-you-know", headline: "€1,500 Fine for Not Cleaning Up", body: "Barcelona doesn't mess around: a €1,500 fine for not picking up after your dog. That's 22x more than Paris!", icon: "💸" },
  { city: "barcelona", type: "did-you-know", headline: "Spain #1 in Dog Ownership", body: "Spain has the highest rate of dog ownership per capita in Europe — 71.48% of households own at least one dog.", icon: "🏆" },

  // ── LOS ANGELES ──
  { city: "losangeles", type: "did-you-know", headline: "Only 1 Off-Leash Dog Beach", body: "Despite 70 miles of coastline, LA County has only ONE official off-leash dog beach: Rosie's Dog Beach in Long Beach.", icon: "🏖️" },
  { city: "losangeles", type: "did-you-know", headline: "World's Largest Corgi Gathering", body: "LA hosts 'Corgi Beach Day' — the largest Corgi gathering in the world. Started with 15 dogs in 2012, now thousands attend. Yes, there's a 'Best Corgi Butt' contest.", icon: "🐕" },
  { city: "losangeles", type: "did-you-know", headline: "Dogs Surf in Competition", body: "Surf City Surf Dog in Huntington Beach is an annual competition where dogs catch real waves. Free to attend, includes pet adoptions.", icon: "🏄" },
  { city: "losangeles", type: "did-you-know", headline: "Runyon Canyon: 90 Acres Off-Leash", body: "Runyon Canyon features a 90-acre off-leash dog park with hiking trails and Hollywood Hills views. The ultimate celebrity dog spotting zone.", icon: "🏔️" },
  { city: "losangeles", type: "did-you-know", headline: "2.6 Million Dogs in LA", body: "Only 19.9% of LA households own dogs (vs. 39.1% nationally), but the city is home to 2.6 million dogs — more than double NYC.", icon: "📊" },

  // ── NEW YORK CITY ──
  { city: "nyc", type: "did-you-know", headline: "600,000 Dogs in NYC", body: "600,000 dogs call NYC home across all five boroughs. The pet industry generates $1.5 billion in annual economic activity in the city.", icon: "🏙️" },
  { city: "nyc", type: "did-you-know", headline: "75% Buy Their Dog a Puppacino", body: "75% of New Yorkers have treated their pet to a 'puppacino' at a café. In Mississippi, it's only 2%. NYC dogs live different.", icon: "☕" },
  { city: "nyc", type: "did-you-know", headline: "More on Dog Grooming Than Their Own", body: "55% of NYC dog owners spend more on their pet's grooming than their own personal grooming. Priorities.", icon: "💇" },
  { city: "nyc", type: "did-you-know", headline: "Central Park: 20 Off-Leash Zones", body: "Central Park has ~20 off-leash areas during early morning (6-9 AM) and evening (9 PM-1 AM). Urban freedom for NYC pups.", icon: "🌿" },
  { city: "nyc", type: "did-you-know", headline: "42% Throw Dog Birthday Parties", body: "42% of NYC dog owners throw birthday parties for their pets. Dog yoga classes and pet bakeries are standard neighborhood offerings.", icon: "🎂" },

  // ── SYDNEY ──
  { city: "sydney", type: "did-you-know", headline: "The 2-Dog Rule", body: "In NSW, the standard legal limit is just 2 dogs per household. You need a special permit for more.", icon: "✌️" },
  { city: "sydney", type: "did-you-know", headline: "43% of Centennial Park is Off-Leash", body: "About 43% of Sydney's massive Centennial Parklands is designated as off-leash territory. That's hundreds of acres of freedom.", icon: "🌳" },
  { city: "sydney", type: "did-you-know", headline: "Dog Beach Culture", body: "Sydney's Sirius Cove and Greenhills Beach offer dedicated off-leash beach time for dogs — a luxury most cities dream about.", icon: "🏖️" },
  { city: "sydney", type: "did-you-know", headline: "Escape-Proof Fences Required", body: "NSW law requires yard fences that dogs 'cannot jump, dig under or squeeze through.' One of the most specific fence laws globally.", icon: "🏠" },
  { city: "sydney", type: "did-you-know", headline: "Rental Rights for Dog Owners", body: "New NSW laws now protect tenants' rights to keep dogs in rental properties. Dogs are officially recognized as legitimate family members.", icon: "🏢" },

  // ── TOKYO ──
  { city: "tokyo", type: "did-you-know", headline: "Virtually Zero Dog Waste on Streets", body: "Tokyo's dog owners are so responsible about cleanup, you almost never see dog droppings on the streets. Cultural respect at its finest.", icon: "✨" },
  { city: "tokyo", type: "did-you-know", headline: "You Can 'Rent' a Dog", body: "Tokyo has dog cafés where you can rent a dog for 1-2 hours for walks and playtime. Born from apartment-living limitations, it's a uniquely Japanese innovation.", icon: "🐶" },
  { city: "tokyo", type: "did-you-know", headline: "Tiny Dogs Rule Tokyo", body: "Tokyo apartments are small, so Chihuahuas, Miniature Dachshunds, and Toy Poodles dominate. This created an entire 'toy dog' culture.", icon: "🏠" },
  { city: "tokyo", type: "did-you-know", headline: "Yoyogi Park's 3-Tier Dog Run", body: "Yoyogi Park divides its dog run by size: large, medium, and small. This prevents hierarchy issues — a model of thoughtful park design.", icon: "📐" },
  { city: "tokyo", type: "did-you-know", headline: "$9 Billion Pet Industry", body: "Japan's pet industry is worth 1.4 trillion yen (~$9B USD). In Tokyo, dogs are treated like royalty — with fashion, spas, and gourmet food.", icon: "💎" },
  { city: "tokyo", type: "did-you-know", headline: "Hachiko's Legacy Lives On", body: "Hachiko's statue at Shibuya Station remains one of Tokyo's most-visited spots. One dog's loyalty story, woven into Japan's cultural identity forever.", icon: "🗿" },
];

// ─── Post Templates ─────────────────────────────────────────────────
const POST_TEMPLATES = [
  { id: "did-you-know", name: "Did You Know?", slides: ["cover", "fact", "cta"] },
  { id: "top-3", name: "Top 3 Facts", slides: ["cover", "fact", "fact", "fact", "cta"] },
  { id: "city-vs-city", name: "City vs City", slides: ["cover", "versus", "cta"] },
  { id: "single-fact", name: "Single Fact Card", slides: ["fact-hero"] },
];

// ─── Slide Components ───────────────────────────────────────────────

function CoverSlide({ city, template, headline }) {
  const c = CITIES[city];
  return (
    <div className="w-full h-full flex flex-col justify-between p-8" style={{ background: `linear-gradient(135deg, #2D3436 0%, #636e72 100%)` }}>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F97316" }}>
          <span className="text-white text-lg font-bold">🐾</span>
        </div>
        <span className="text-white text-sm font-semibold tracking-widest uppercase">PawCities</span>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-3xl">{c.emoji}</span>
          <span className="text-white text-lg font-medium opacity-80">{c.name}, {c.country}</span>
        </div>
        <h1 className="text-4xl font-black text-white leading-tight" style={{ fontFamily: "system-ui" }}>
          {headline || (template === "did-you-know" ? "Did You Know?" : template === "top-3" ? `Top 3 Dog Facts About ${c.name}` : `Dog Lover's Guide to ${c.name}`)}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }}></div>
        <span className="text-white text-xs opacity-60">Swipe to explore →</span>
      </div>
    </div>
  );
}

function FactSlide({ fact, slideNum, totalSlides, city }) {
  const c = CITIES[city];
  return (
    <div className="w-full h-full flex flex-col p-8" style={{ background: `linear-gradient(180deg, ${c.color}22 0%, #FFFFFF 40%)` }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F97316" }}>
            <span className="text-white text-xs font-bold">🐾</span>
          </div>
          <span className="text-gray-600 text-xs font-semibold tracking-widest uppercase">PawCities</span>
        </div>
        <span className="text-gray-400 text-xs">{slideNum}/{totalSlides}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <span className="text-5xl mb-5">{fact.icon}</span>
        <h2 className="text-2xl font-extrabold text-gray-900 leading-snug mb-4">
          {fact.headline}
        </h2>
        <p className="text-base text-gray-600 leading-relaxed">
          {fact.body}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <span className="text-lg">{c.emoji}</span>
        <span className="text-gray-500 text-sm font-medium">{c.name}</span>
        <span className="text-gray-300 text-sm mx-1">•</span>
        <span className="text-gray-400 text-xs">pawcities.com</span>
      </div>
    </div>
  );
}

function FactHeroSlide({ fact, city }) {
  const c = CITIES[city];
  return (
    <div className="w-full h-full flex flex-col justify-between p-8" style={{ background: `linear-gradient(160deg, ${c.color} 0%, #FFFFFF 100%)` }}>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F97316" }}>
          <span className="text-white text-lg font-bold">🐾</span>
        </div>
        <span className="text-gray-700 text-sm font-semibold tracking-widest uppercase">PawCities</span>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <span className="text-6xl mb-5">{fact.icon}</span>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white" style={{ backgroundColor: "#F97316" }}>
            Did you know?
          </span>
          <span className="text-lg">{c.emoji}</span>
          <span className="text-sm text-gray-500">{c.name}</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 leading-tight mb-4">
          {fact.headline}
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          {fact.body}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm">pawcities.com</span>
        <span className="text-gray-400 text-sm">Save & Share 🐾</span>
      </div>
    </div>
  );
}

function VersusSlide({ factA, factB, cityA, cityB }) {
  const cA = CITIES[cityA];
  const cB = CITIES[cityB];
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col justify-center p-6" style={{ background: `linear-gradient(135deg, ${cA.color}44 0%, ${cA.color}22 100%)` }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{cA.emoji}</span>
          <span className="font-bold text-gray-800">{cA.name}</span>
        </div>
        <span className="text-2xl mb-1">{factA.icon}</span>
        <h3 className="text-lg font-extrabold text-gray-900">{factA.headline}</h3>
        <p className="text-sm text-gray-600 mt-1">{factA.body}</p>
      </div>
      <div className="h-12 flex items-center justify-center" style={{ backgroundColor: "#F97316" }}>
        <span className="text-white font-black text-lg">VS</span>
      </div>
      <div className="flex-1 flex flex-col justify-center p-6" style={{ background: `linear-gradient(135deg, ${cB.color}44 0%, ${cB.color}22 100%)` }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{cB.emoji}</span>
          <span className="font-bold text-gray-800">{cB.name}</span>
        </div>
        <span className="text-2xl mb-1">{factB.icon}</span>
        <h3 className="text-lg font-extrabold text-gray-900">{factB.headline}</h3>
        <p className="text-sm text-gray-600 mt-1">{factB.body}</p>
      </div>
    </div>
  );
}

function CTASlide({ city }) {
  const c = CITIES[city];
  return (
    <div className="w-full h-full flex flex-col justify-between p-8" style={{ background: `linear-gradient(135deg, #F97316 0%, #FB923C 50%, #FDBA74 100%)` }}>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white bg-opacity-20">
          <span className="text-white text-lg font-bold">🐾</span>
        </div>
        <span className="text-white text-sm font-semibold tracking-widest uppercase opacity-90">PawCities</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        <h2 className="text-3xl font-black text-white leading-tight mb-4">
          Explore Dog-Friendly {c.name}
        </h2>
        <p className="text-white text-lg opacity-90 mb-6">
          Find parks, restaurants, cafés, hotels & more that welcome your pup.
        </p>
        <div className="bg-white rounded-full px-8 py-3 shadow-lg">
          <span className="font-bold text-gray-800">pawcities.com</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-white text-sm opacity-80">Follow @ThePawCities for more 🐾</span>
      </div>
    </div>
  );
}

// ─── Caption Generator ──────────────────────────────────────────────
function generateCaption(city, facts, template) {
  const c = CITIES[city];
  const hashtags = `\n\n#PawCities #DogFriendly${c.name.replace(/\s/g,"")} #${c.name.replace(/\s/g,"")}Dogs #DogTravel #DogFriendly #DogsOfInstagram #PetTravel #DogLovers #TravelWithDogs`;

  if (template === "did-you-know" || template === "single-fact") {
    const f = facts[0];
    return `${f.icon} Did you know? ${f.headline}\n\n${f.body}\n\nDiscover more dog-friendly spots in ${c.name} at pawcities.com (link in bio)\n\nSave this for your next trip! 🐾${hashtags}`;
  }
  if (template === "top-3") {
    const lines = facts.slice(0, 3).map((f, i) => `${i + 1}. ${f.icon} ${f.headline}`).join("\n");
    return `Top 3 dog facts about ${c.name} ${c.emoji} that'll surprise you:\n\n${lines}\n\nSwipe through for the details! Which one surprised you most? Tell us in the comments 👇\n\nFind dog-friendly places in ${c.name} → pawcities.com${hashtags}`;
  }
  return `Explore dog-friendly ${c.name} at pawcities.com 🐾${hashtags}`;
}

// ─── Main App ───────────────────────────────────────────────────────
export default function SocialPostGenerator() {
  const [selectedCity, setSelectedCity] = useState("paris");
  const [selectedTemplate, setSelectedTemplate] = useState("did-you-know");
  const [selectedFacts, setSelectedFacts] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [compareCity, setCompareCity] = useState("london");
  const [customHeadline, setCustomHeadline] = useState("");
  const [showCaption, setShowCaption] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState([]);

  const cityFacts = CONTENT_BANK.filter(f => f.city === selectedCity);
  const compareFacts = CONTENT_BANK.filter(f => f.city === compareCity);

  useEffect(() => {
    setSelectedFacts(cityFacts.slice(0, 3));
    setCurrentSlide(0);
  }, [selectedCity]);

  const template = POST_TEMPLATES.find(t => t.id === selectedTemplate);

  const toggleFact = (fact) => {
    setSelectedFacts(prev => {
      const exists = prev.find(f => f.headline === fact.headline);
      if (exists) return prev.filter(f => f.headline !== fact.headline);
      if (prev.length >= 3) return [...prev.slice(1), fact];
      return [...prev, fact];
    });
  };

  const totalSlides = template.slides.length;

  const renderSlide = (slideType, idx) => {
    const containerStyle = { width: 400, height: 500, borderRadius: 12, overflow: "hidden", flexShrink: 0 };
    const fact = selectedFacts[Math.min(idx - 1, selectedFacts.length - 1)] || selectedFacts[0] || cityFacts[0];

    switch (slideType) {
      case "cover":
        return <div key={idx} style={containerStyle}><CoverSlide city={selectedCity} template={selectedTemplate} headline={customHeadline} /></div>;
      case "fact":
        return <div key={idx} style={containerStyle}><FactSlide fact={selectedFacts[idx - 1] || fact} slideNum={idx} totalSlides={totalSlides - 1} city={selectedCity} /></div>;
      case "fact-hero":
        return <div key={idx} style={containerStyle}><FactHeroSlide fact={fact} city={selectedCity} /></div>;
      case "versus":
        return <div key={idx} style={containerStyle}><VersusSlide factA={selectedFacts[0] || cityFacts[0]} factB={compareFacts[0]} cityA={selectedCity} cityB={compareCity} /></div>;
      case "cta":
        return <div key={idx} style={containerStyle}><CTASlide city={selectedCity} /></div>;
      default:
        return null;
    }
  };

  const addToQueue = () => {
    const post = {
      id: Date.now(),
      city: selectedCity,
      template: selectedTemplate,
      facts: [...selectedFacts],
      headline: customHeadline,
      compareCity,
      caption: generateCaption(selectedCity, selectedFacts, selectedTemplate),
    };
    setGeneratedPosts(prev => [...prev, post]);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-50 border-b" style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E7EB" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F97316" }}>
              <span className="text-white font-bold">🐾</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">PawCities Social Post Generator</h1>
              <p className="text-xs text-gray-500">Create Instagram carousels & story cards</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{CONTENT_BANK.length} facts in library</span>
            <span className="text-xs px-2 py-1 rounded-full font-medium text-white" style={{ backgroundColor: "#F97316" }}>
              {generatedPosts.length} in queue
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* Left Panel: Controls */}
        <div className="w-80 flex-shrink-0 space-y-5">
          {/* City Selector */}
          <div className="bg-white rounded-xl p-4 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">City</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CITIES).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCity(key)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCity === key
                      ? "text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  style={selectedCity === key ? { backgroundColor: "#F97316" } : {}}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Template Selector */}
          <div className="bg-white rounded-xl p-4 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Post Template</label>
            <div className="space-y-2">
              {POST_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t.id); setCurrentSlide(0); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedTemplate === t.id ? "text-white" : "text-gray-700 hover:bg-gray-50"
                  }`}
                  style={selectedTemplate === t.id ? { backgroundColor: "#2D3436" } : {}}
                >
                  {t.name}
                  <span className="text-xs opacity-60 ml-2">({t.slides.length} slide{t.slides.length > 1 ? "s" : ""})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Versus City (only for city-vs-city) */}
          {selectedTemplate === "city-vs-city" && (
            <div className="bg-white rounded-xl p-4 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Compare With</label>
              <select
                value={compareCity}
                onChange={e => setCompareCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
              >
                {Object.entries(CITIES).filter(([k]) => k !== selectedCity).map(([key, c]) => (
                  <option key={key} value={key}>{c.emoji} {c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Headline */}
          <div className="bg-white rounded-xl p-4 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Custom Cover Headline (optional)</label>
            <input
              type="text"
              value={customHeadline}
              onChange={e => setCustomHeadline(e.target.value)}
              placeholder="Leave blank for auto-generated"
              className="w-full px-3 py-2 rounded-lg border text-sm"
            />
          </div>

          {/* Fact Picker */}
          <div className="bg-white rounded-xl p-4 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Select Facts ({selectedFacts.length}/3)
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cityFacts.map((fact, i) => {
                const isSelected = selectedFacts.find(f => f.headline === fact.headline);
                return (
                  <button
                    key={i}
                    onClick={() => toggleFact(fact)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all border ${
                      isSelected ? "border-orange-300 bg-orange-50" : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <span className="mr-1">{fact.icon}</span>
                    <span className="font-semibold">{fact.headline}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={addToQueue}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 shadow-sm"
            style={{ backgroundColor: "#F97316" }}
          >
            Add to Post Queue
          </button>
        </div>

        {/* Right Panel: Preview */}
        <div className="flex-1 space-y-5">
          {/* Slide Preview */}
          <div className="bg-white rounded-xl p-6 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Preview</h2>
              <div className="flex items-center gap-2">
                {template.slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{ backgroundColor: i === currentSlide ? "#F97316" : "#D1D5DB" }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div style={{ width: 400, height: 500, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
                {renderSlide(template.slides[currentSlide], currentSlide)}
              </div>
            </div>
            <div className="flex justify-center mt-4 gap-2">
              <button
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                onClick={() => setCurrentSlide(Math.min(totalSlides - 1, currentSlide + 1))}
                disabled={currentSlide === totalSlides - 1}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Caption */}
          <div className="bg-white rounded-xl p-6 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Generated Caption</h2>
              <button
                onClick={() => setShowCaption(!showCaption)}
                className="text-xs text-orange-500 font-medium"
              >
                {showCaption ? "Hide" : "Show"}
              </button>
            </div>
            {showCaption && (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 font-sans leading-relaxed">
                {generateCaption(selectedCity, selectedFacts, selectedTemplate)}
              </pre>
            )}
          </div>

          {/* Post Queue */}
          {generatedPosts.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
              <h2 className="text-sm font-bold text-gray-900 mb-3">Post Queue ({generatedPosts.length})</h2>
              <div className="space-y-3">
                {generatedPosts.map((post, i) => (
                  <div key={post.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-6">#{i + 1}</span>
                      <span className="text-lg">{CITIES[post.city].emoji}</span>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{CITIES[post.city].name}</span>
                        <span className="text-xs text-gray-500 ml-2">{POST_TEMPLATES.find(t => t.id === post.template)?.name}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setGeneratedPosts(prev => prev.filter(p => p.id !== post.id))}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Library Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm border" style={{ borderColor: "#E5E7EB" }}>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Content Library</h2>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(CITIES).map(([key, c]) => {
                const count = CONTENT_BANK.filter(f => f.city === key).length;
                return (
                  <div key={key} className="text-center p-3 rounded-lg bg-gray-50">
                    <span className="text-2xl">{c.emoji}</span>
                    <div className="text-xs font-medium text-gray-800 mt-1">{c.name}</div>
                    <div className="text-xs text-gray-500">{count} facts</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-center">
              <span className="text-xs text-gray-400">Total: {CONTENT_BANK.length} researched facts across {Object.keys(CITIES).length} cities</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from "react";

// ─── Brand Config ──────────────────────────────────────────────────────────
const CITIES = [
  { id: "newyork",    label: "New York City", flag: "🇺🇸", hashtag: "#DogsOfNYC #DogFriendlyNYC #NYCDog" },
  { id: "losangeles", label: "Los Angeles",   flag: "🇺🇸", hashtag: "#DogsOfLA #DogFriendlyLA #LADog" },
  { id: "london",     label: "London",        flag: "🇬🇧", hashtag: "#LondonDog #DogsOfLondon #DogFriendlyLondon" },
  { id: "paris",      label: "Paris",         flag: "🇫🇷", hashtag: "#ParisDog #DogsOfParis #DogFriendlyParis" },
  { id: "barcelona",  label: "Barcelona",     flag: "🇪🇸", hashtag: "#BarcelonaDog #DogsOfBarcelona #DogFriendlyBarcelona" },
  { id: "geneva",     label: "Geneva",        flag: "🇨🇭", hashtag: "#GenevaDog #DogsOfGeneva #SwissDogs" },
  { id: "sydney",     label: "Sydney",        flag: "🇦🇺", hashtag: "#SydneyDogs #DogsOfSydney #DogFriendlySydney" },
  { id: "tokyo",      label: "Tokyo",         flag: "🇯🇵", hashtag: "#TokyoDog #DogsOfTokyo #DogFriendlyTokyo" },
];

const THEMES = [
  {
    id: "luxury",
    label: "🥂 Luxury Living",
    tagline: "Some dogs are living better than us",
    emoji: "🥂",
    color: "#1a1a2e",
    accent: "#c9a84c",
    cta: "Is your dog living like royalty? 👑",
    poll: { q: "Would your dog stay here?", a: "Obviously 🐾", b: "We can't afford it 😭" },
    hashtags: "#LuxuryDogs #DogHotel #PamperingMyPup #DogLife #SpoiledDog",
  },
  {
    id: "cafe",
    label: "☕ Café of the Day",
    tagline: "Your pup's next coffee date",
    emoji: "☕",
    color: "#2c1a0e",
    accent: "#ea580c",
    cta: "Would you bring your dog here? ☕",
    poll: { q: "Coffee with your dog?", a: "Every morning 🐾", b: "My dog prefers tea 🍵" },
    hashtags: "#DogFriendlyCafe #CoffeeWithDogs #DogCafe #PetFriendly #CafeDog",
  },
  {
    id: "outdoor",
    label: "🌿 Park & Outdoor",
    tagline: "Where every pup deserves to roam",
    emoji: "🌿",
    color: "#1a2e1a",
    accent: "#4ade80",
    cta: "Have you been here with your pup? 🌿",
    poll: { q: "Off-leash or on-leash today?", a: "FREE RUN 🐾", b: "Leash life for us" },
    hashtags: "#DogPark #OffLeash #DogBeach #DogAdventures #OutdoorDogs",
  },
  {
    id: "funny",
    label: "😂 Living the Life",
    tagline: "My dog eats better than I do",
    emoji: "😂",
    color: "#1a0e2e",
    accent: "#a855f7",
    cta: "Slide to rate this level of spoiled 👇",
    slider: "How spoiled is this pup? 🐾",
    hashtags: "#SpoiledDog #DogParents #DogMom #DogDad #DogsThatLunch",
  },
  {
    id: "gem",
    label: "📍 Hidden Gem",
    tagline: "Dog-friendly spot you need to know about",
    emoji: "📍",
    color: "#0e1a2e",
    accent: "#38bdf8",
    cta: "Know a hidden gem like this? Drop it below 👇",
    question: "Know a dog-friendly spot we should add? 📍",
    hashtags: "#HiddenGem #DogFriendly #SecretSpot #DogFriendlyPlaces #DogTravel",
  },
];

const GLOBAL_HASHTAGS = "#PawCities #DogsOfInstagram #DogTravel #TravelWithDog #PetFriendly #DogFriendly #DogLovers";

// ─── Story Frame Components ────────────────────────────────────────────────

function PawLogo({ size = 18, color = "#ea580c" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <ellipse cx="12" cy="17" rx="5" ry="4" />
      <ellipse cx="6.5" cy="12" rx="2.5" ry="3" />
      <ellipse cx="17.5" cy="12" rx="2.5" ry="3" />
      <ellipse cx="9" cy="8.5" rx="2" ry="2.5" />
      <ellipse cx="15" cy="8.5" rx="2" ry="2.5" />
    </svg>
  );
}

function BrandHeader({ theme, small }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 6, padding: small ? "8px 0 4px" : "12px 0 6px",
    }}>
      <PawLogo size={small ? 14 : 18} color={theme.accent} />
      <span style={{
        fontFamily: "'Helvetica Neue', sans-serif",
        fontWeight: 800, letterSpacing: 2,
        fontSize: small ? 10 : 13,
        color: theme.accent,
        textTransform: "uppercase",
      }}>PawCities</span>
      <PawLogo size={small ? 14 : 18} color={theme.accent} />
    </div>
  );
}

// Frame 1: Location + Vibe opener
function Frame1({ theme, city, placeName, vibe, themeLabel }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: `linear-gradient(160deg, ${theme.color} 0%, #0a0a1a 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between",
      padding: "20px 16px",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />

      <BrandHeader theme={theme} />

      <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
        {/* Theme badge */}
        <div style={{
          display: "inline-block", background: theme.accent + "22",
          border: `1px solid ${theme.accent}44`,
          borderRadius: 20, padding: "4px 14px",
          color: theme.accent, fontSize: 11, fontWeight: 700,
          letterSpacing: 1, textTransform: "uppercase",
        }}>
          {themeLabel}
        </div>

        {/* City */}
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, letterSpacing: 2 }}>
          {city.flag} {city.label.toUpperCase()}
        </div>

        {/* Place name */}
        <div style={{
          color: "white", fontSize: 26, fontWeight: 900,
          lineHeight: 1.2, padding: "0 8px",
        }}>
          {placeName || "Place Name Here"}
        </div>

        {/* Vibe line */}
        <div style={{
          color: theme.accent, fontSize: 15, fontWeight: 600,
          fontStyle: "italic", padding: "0 12px",
        }}>
          "{vibe || theme.tagline}"
        </div>
      </div>

      {/* Bottom CTA pill */}
      <div style={{
        background: theme.accent, borderRadius: 20,
        padding: "8px 20px", color: "white",
        fontSize: 11, fontWeight: 800, letterSpacing: 1,
        textTransform: "uppercase",
      }}>
        Swipe up → pawcities.com
      </div>
    </div>
  );
}

// Frame 2: The content / image frame
function Frame2({ theme, city, placeName, imageUrl, creatorHandle, caption }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#0d0d0d",
      display: "flex", flexDirection: "column",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        background: theme.color,
        padding: "8px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <BrandHeader theme={theme} small />
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>
          {city.flag} {city.label}
        </div>
      </div>

      {/* Image area */}
      <div style={{
        flex: 1, background: "#1a1a1a", position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <div style={{ fontSize: 11 }}>Your screenshot goes here</div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>Paste image URL above</div>
          </div>
        )}
        {/* Creator credit overlay */}
        {creatorHandle && (
          <div style={{
            position: "absolute", bottom: 8, left: 8,
            background: "rgba(0,0,0,0.7)", borderRadius: 8,
            padding: "3px 8px", color: "white",
            fontSize: 9, fontWeight: 700,
          }}>
            📸 via {creatorHandle}
          </div>
        )}
      </div>

      {/* Caption bar */}
      <div style={{
        background: theme.color, padding: "10px 14px",
      }}>
        <div style={{ color: "white", fontSize: 11, lineHeight: 1.4, fontWeight: 500 }}>
          {caption || `${placeName} — tap the link in bio to explore 🐾`}
        </div>
      </div>
    </div>
  );
}

// Frame 3: CTA / engagement frame
function Frame3({ theme, city, placeName, cta, engagement }) {
  const isSlider = engagement === "slider";
  const isPoll = engagement === "poll";
  const isQuestion = engagement === "question";

  return (
    <div style={{
      width: "100%", height: "100%",
      background: `linear-gradient(180deg, ${theme.color} 0%, #000 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between",
      padding: "20px 16px",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
    }}>
      <BrandHeader theme={theme} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, width: "100%" }}>
        {/* CTA text */}
        <div style={{
          color: "white", fontSize: 20, fontWeight: 900,
          textAlign: "center", lineHeight: 1.3, padding: "0 8px",
        }}>
          {cta}
        </div>

        {/* Engagement sticker mock */}
        {isPoll && theme.poll && (
          <div style={{
            background: "white", borderRadius: 16, padding: "14px 16px",
            width: "90%", boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1a1a1a", marginBottom: 10, textAlign: "center" }}>
              {theme.poll.q}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: theme.accent, borderRadius: 10, padding: "8px 0", textAlign: "center", fontSize: 10, fontWeight: 800, color: "white" }}>
                {theme.poll.a}
              </div>
              <div style={{ flex: 1, background: "#f0f0f0", borderRadius: 10, padding: "8px 0", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#333" }}>
                {theme.poll.b}
              </div>
            </div>
          </div>
        )}

        {isSlider && theme.slider && (
          <div style={{
            background: "white", borderRadius: 16, padding: "14px 16px",
            width: "90%", boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1a1a1a", marginBottom: 10, textAlign: "center" }}>
              {theme.slider}
            </div>
            <div style={{ background: "#f0f0f0", borderRadius: 20, height: 8, position: "relative" }}>
              <div style={{ position: "absolute", left: "60%", top: -6, fontSize: 20 }}>🐾</div>
              <div style={{ width: "62%", height: "100%", background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}aa)`, borderRadius: 20 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#999" }}>
              <span>Not at all</span><span>Absolutely royal 👑</span>
            </div>
          </div>
        )}

        {isQuestion && theme.question && (
          <div style={{
            background: "white", borderRadius: 16, padding: "14px 16px",
            width: "90%", boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1a1a1a", marginBottom: 8, textAlign: "center" }}>
              {theme.question}
            </div>
            <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "#999", fontStyle: "italic" }}>
              Type your answer...
            </div>
          </div>
        )}

        {/* Should we add it? */}
        <div style={{
          color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center",
          marginTop: 4,
        }}>
          Should we add this to PawCities? 👀<br />
          <span style={{ color: theme.accent, fontWeight: 700 }}>DM us or tag #PawCities</span>
        </div>
      </div>

      <div style={{
        background: theme.accent, borderRadius: 20,
        padding: "8px 20px", color: "white",
        fontSize: 11, fontWeight: 800, letterSpacing: 1,
        textTransform: "uppercase",
      }}>
        {city.flag} Explore {city.label} → pawcities.com
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────

export default function PawCitiesStoryBuilder() {
  const [cityId, setCityId] = useState("newyork");
  const [themeId, setThemeId] = useState("luxury");
  const [placeName, setPlaceName] = useState("");
  const [vibe, setVibe] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [creatorHandle, setCreatorHandle] = useState("");
  const [caption, setCaption] = useState("");
  const [engagement, setEngagement] = useState("poll");
  const [activeFrame, setActiveFrame] = useState(0);
  const [copied, setCopied] = useState(false);

  const city = CITIES.find(c => c.id === cityId) || CITIES[0];
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];

  // Auto-select best engagement for theme
  const effectiveEngagement = theme.id === "funny" ? "slider"
    : theme.id === "gem" ? "question"
    : "poll";

  // Generate caption
  const generatedCaption = `${city.flag} ${theme.emoji} ${vibe || theme.tagline}${placeName ? ` — ${placeName}` : ""}, ${city.label}.\n\n${theme.id === "luxury" ? "Some dogs live better than us and we are completely fine with it 😂🐾" : theme.id === "cafe" ? "Coffee dates with your pup hit different when the café actually welcomes them 🐾☕" : theme.id === "outdoor" ? "Every dog deserves a place to roam free. This is one of them 🌿🐾" : theme.id === "funny" ? "My dog's lifestyle > my lifestyle and I'm not even mad about it 😂🐾" : "Found a hidden gem that dogs (and their people) will love 📍🐾"}\n\n${creatorHandle ? `📸 via ${creatorHandle}\n\n` : ""}📍 Explore dog-friendly ${city.label} → link in bio\n\n${theme.hashtags}\n${city.hashtag}\n${GLOBAL_HASHTAGS}`;

  const copyCaption = () => {
    navigator.clipboard.writeText(generatedCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const FRAMES = [
    { label: "Frame 1: Opener", desc: "Location + Theme" },
    { label: "Frame 2: Content", desc: "Image + Credit" },
    { label: "Frame 3: CTA", desc: "Engagement" },
  ];

  return (
    <div style={{
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      background: "#0a0a0f",
      minHeight: "100vh",
      color: "white",
      padding: "0 0 40px",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, #1a0a00, #0a0a1a)",
        borderBottom: "1px solid #ea580c33",
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <PawLogo size={22} color="#ea580c" />
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 1, color: "#ea580c" }}>PAWCITIES STORY BUILDER</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>Daily repost system — 3-frame branded stories</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 60px)" }}>

        {/* ─── Left Panel: Controls ─────────── */}
        <div style={{
          width: 280, minWidth: 280,
          background: "#111118",
          borderRight: "1px solid #ffffff0f",
          padding: "20px 16px",
          display: "flex", flexDirection: "column", gap: 20,
          overflowY: "auto",
        }}>

          {/* City */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              📍 City
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CITIES.map(c => (
                <button key={c.id} onClick={() => setCityId(c.id)} style={{
                  padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700,
                  background: cityId === c.id ? "#ea580c" : "#1e1e2e",
                  color: cityId === c.id ? "white" : "rgba(255,255,255,0.5)",
                  transition: "all 0.15s",
                }}>
                  {c.flag} {c.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              🎨 Theme Day
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => setThemeId(t.id)} style={{
                  padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, textAlign: "left",
                  background: themeId === t.id ? `${t.accent}22` : "#1e1e2e",
                  color: themeId === t.id ? t.accent : "rgba(255,255,255,0.5)",
                  borderLeft: themeId === t.id ? `3px solid ${t.accent}` : "3px solid transparent",
                  transition: "all 0.15s",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Place details */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              🏠 Post Details
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Place / Business Name", key: "placeName", val: placeName, set: setPlaceName, placeholder: "e.g. The Plaza Hotel" },
                { label: "Your Vibe Line (optional)", key: "vibe", val: vibe, set: setVibe, placeholder: theme.tagline },
                { label: "Image URL (optional)", key: "imageUrl", val: imageUrl, set: setImageUrl, placeholder: "https://..." },
                { label: "Creator Handle", key: "creatorHandle", val: creatorHandle, set: setCreatorHandle, placeholder: "@creator" },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 3, fontWeight: 600, letterSpacing: 0.5 }}>{f.label}</div>
                  <input
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    style={{
                      width: "100%", background: "#0d0d1a", border: "1px solid #ffffff15",
                      borderRadius: 8, padding: "7px 10px", color: "white", fontSize: 11,
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Workflow tip */}
          <div style={{
            background: "#ea580c11", border: "1px solid #ea580c33",
            borderRadius: 10, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", marginBottom: 4 }}>Daily Workflow</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              1. Screenshot the post<br />
              2. Fill in details here<br />
              3. Preview all 3 frames<br />
              4. Copy caption below<br />
              5. Post frames → paste caption
            </div>
          </div>
        </div>

        {/* ─── Center: Preview ──────────────── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", padding: "24px 20px", gap: 16,
          background: "#0a0a0f",
        }}>

          {/* Frame tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            {FRAMES.map((f, i) => (
              <button key={i} onClick={() => setActiveFrame(i)} style={{
                padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700,
                background: activeFrame === i ? "#ea580c" : "#1e1e2e",
                color: activeFrame === i ? "white" : "rgba(255,255,255,0.4)",
                transition: "all 0.15s",
              }}>
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 1 }}>
            {FRAMES[activeFrame].desc} · 1080×1920 (9:16)
          </div>

          {/* Story frame preview (9:16) */}
          <div style={{
            width: 270, height: 480,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.8)",
            position: "relative",
          }}>
            {activeFrame === 0 && (
              <Frame1 theme={theme} city={city} placeName={placeName} vibe={vibe} themeLabel={theme.label} />
            )}
            {activeFrame === 1 && (
              <Frame2 theme={theme} city={city} placeName={placeName} imageUrl={imageUrl} creatorHandle={creatorHandle} caption={caption} />
            )}
            {activeFrame === 2 && (
              <Frame3 theme={theme} city={city} placeName={placeName} cta={theme.cta} engagement={effectiveEngagement} />
            )}
          </div>

          {/* All 3 frames mini row */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} onClick={() => setActiveFrame(i)} style={{
                width: 72, height: 128, borderRadius: 8,
                overflow: "hidden", cursor: "pointer",
                opacity: activeFrame === i ? 1 : 0.4,
                border: activeFrame === i ? `2px solid ${theme.accent}` : "2px solid transparent",
                transition: "all 0.15s",
                transform: activeFrame === i ? "scale(1.05)" : "scale(1)",
              }}>
                {i === 0 && <Frame1 theme={theme} city={city} placeName={placeName} vibe={vibe} themeLabel={theme.label} />}
                {i === 1 && <Frame2 theme={theme} city={city} placeName={placeName} imageUrl={imageUrl} creatorHandle={creatorHandle} caption={caption} />}
                {i === 2 && <Frame3 theme={theme} city={city} placeName={placeName} cta={theme.cta} engagement={effectiveEngagement} />}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Right Panel: Caption ─────────── */}
        <div style={{
          width: 300, minWidth: 300,
          background: "#111118",
          borderLeft: "1px solid #ffffff0f",
          padding: "20px 16px",
          display: "flex", flexDirection: "column", gap: 16,
          overflowY: "auto",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", letterSpacing: 1, textTransform: "uppercase" }}>
            📋 Generated Caption
          </div>

          <div style={{
            background: "#0d0d1a", border: "1px solid #ffffff10",
            borderRadius: 10, padding: "12px", fontSize: 11,
            color: "rgba(255,255,255,0.7)", lineHeight: 1.7,
            whiteSpace: "pre-wrap", minHeight: 200,
          }}>
            {generatedCaption}
          </div>

          <button onClick={copyCaption} style={{
            padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
            background: copied ? "#22c55e" : "#ea580c",
            color: "white", fontSize: 12, fontWeight: 800, letterSpacing: 1,
            transition: "all 0.2s",
          }}>
            {copied ? "✓ Copied!" : "Copy Caption + Hashtags"}
          </button>

          {/* Engagement sticker recommendation */}
          <div style={{
            background: "#1e1e2e", borderRadius: 10, padding: "12px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.accent, marginBottom: 8, letterSpacing: 1 }}>
              💬 STORY STICKER (Frame 3)
            </div>
            {effectiveEngagement === "poll" && theme.poll && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                <strong style={{ color: "white" }}>Poll:</strong><br />
                "{theme.poll.q}"<br />
                A: {theme.poll.a}<br />
                B: {theme.poll.b}
              </div>
            )}
            {effectiveEngagement === "slider" && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                <strong style={{ color: "white" }}>Slider:</strong><br />
                "{theme.slider}"<br />
                Use the 🐾 emoji slider
              </div>
            )}
            {effectiveEngagement === "question" && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                <strong style={{ color: "white" }}>Question box:</strong><br />
                "{theme.question}"
              </div>
            )}
          </div>

          {/* Daily mix guide */}
          <div style={{
            background: "#0d1a0d", border: "1px solid #4ade8033",
            borderRadius: 10, padding: "12px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", marginBottom: 8, letterSpacing: 1 }}>
              📅 DAILY MIX (3–5 stories)
            </div>
            {[
              ["1×", "🥂 Luxury / Plaza-style"],
              ["1×", "☕ Local café"],
              ["1×", "🌿 Nature / outdoor"],
              ["1×", "😂 Funny / relatable"],
              ["opt", "📍 Hidden gem"],
            ].map(([count, label]) => (
              <div key={label} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                <span style={{ color: "#4ade80", fontWeight: 700, width: 28 }}>{count}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* DM template */}
          <div style={{
            background: "#1a0a0e", border: "1px solid #ea580c22",
            borderRadius: 10, padding: "12px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", marginBottom: 8, letterSpacing: 1 }}>
              📨 CREATOR DM TEMPLATE
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, fontStyle: "italic" }}>
              "Hey {creatorHandle || "@creator"}! Loved this post from {city.label}. I run @ThePawCities — a free guide to dog-friendly spots worldwide. Would love to feature {placeName || "this spot"} in our story with full credit 🐾 Open to it?"
            </div>
            <button onClick={() => {
              const dm = `Hey ${creatorHandle || "@creator"}! Loved this post from ${city.label}. I run @ThePawCities — a free guide to dog-friendly spots worldwide. Would love to feature ${placeName || "this spot"} in our story with full credit 🐾 Open to it?`;
              navigator.clipboard.writeText(dm);
            }} style={{
              marginTop: 8, padding: "6px 12px", borderRadius: 8, border: "none",
              cursor: "pointer", background: "#ea580c22", color: "#ea580c",
              fontSize: 10, fontWeight: 700, width: "100%",
            }}>
              Copy DM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

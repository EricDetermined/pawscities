import { useState } from "react";

const DoublePaw = ({ size = 28, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 80 50" fill={color}>
    <g transform="translate(0,5) scale(0.55) rotate(-15 32 32)">
      <ellipse cx="32" cy="42" rx="14" ry="12" />
      <ellipse cx="14" cy="22" rx="7" ry="9" transform="rotate(-15 14 22)" />
      <ellipse cx="50" cy="22" rx="7" ry="9" transform="rotate(15 50 22)" />
      <ellipse cx="22" cy="16" rx="6" ry="8" transform="rotate(-5 22 16)" />
      <ellipse cx="42" cy="16" rx="6" ry="8" transform="rotate(5 42 16)" />
    </g>
    <g transform="translate(30,0) scale(0.65) rotate(10 32 32)">
      <ellipse cx="32" cy="42" rx="14" ry="12" />
      <ellipse cx="14" cy="22" rx="7" ry="9" transform="rotate(-15 14 22)" />
      <ellipse cx="50" cy="22" rx="7" ry="9" transform="rotate(15 50 22)" />
      <ellipse cx="22" cy="16" rx="6" ry="8" transform="rotate(-5 22 16)" />
      <ellipse cx="42" cy="16" rx="6" ry="8" transform="rotate(5 42 16)" />
    </g>
  </svg>
);

const CategoryPill = ({ icon, label }) => (
  <span style={{
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(6px)",
    border: "1px solid rgba(255,255,255,0.3)",
    padding: "7px 18px",
    borderRadius: 24,
    fontSize: 13,
    fontWeight: 500,
    color: "white",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  }}>
    {icon} {label}
  </span>
);

const pills = [
  { icon: "🌳", label: "Parks" },
  { icon: "🍽️", label: "Restaurants" },
  { icon: "☕", label: "Cafes" },
  { icon: "🏨", label: "Hotels" },
  { icon: "🏖️", label: "Beaches" },
  { icon: "🏥", label: "Vets" },
];

const NavBar = ({ dark = false, transparent = false }) => (
  <div style={{
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    padding: "14px 28px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: transparent ? "rgba(0,0,0,0.15)" : (dark ? "#1a1a2e" : "rgba(255,255,255,0.95)"),
    backdropFilter: transparent ? "blur(8px)" : "none",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <DoublePaw size={26} color={dark || transparent ? "white" : "#f97316"} />
      <span style={{ fontWeight: 700, fontSize: 16, color: dark || transparent ? "white" : "#111827" }}>
        Paw<span style={{ color: "#f97316" }}>Cities</span>
      </span>
    </div>
    <div style={{ display: "flex", gap: 20, fontSize: 13, alignItems: "center", color: dark || transparent ? "rgba(255,255,255,0.9)" : "#374151" }}>
      <span>Home</span>
      <span>For Business</span>
      <span style={{ background: "#f97316", color: "white", padding: "6px 16px", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Sign Up</span>
    </div>
  </div>
);

const HeroContent = ({ titleSize = 44, subtitleSize = 16, align = "center" }) => (
  <div style={{ textAlign: align, maxWidth: align === "left" ? 560 : 600, margin: align === "center" ? "0 auto" : 0 }}>
    <h1 style={{
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: titleSize, fontWeight: 700, lineHeight: 1.1,
      color: "white", marginBottom: 14,
      textShadow: "0 2px 16px rgba(0,0,0,0.35)",
    }}>
      Find Dog-Friendly Places
    </h1>
    <p style={{
      fontSize: subtitleSize, color: "rgba(255,255,255,0.92)", marginBottom: 28,
      textShadow: "0 1px 8px rgba(0,0,0,0.25)", lineHeight: 1.5,
    }}>
      Discover the best restaurants, cafes, parks, and more that welcome your furry friend in cities around the world.
    </p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}>
      {pills.map(p => <CategoryPill key={p.label} {...p} />)}
    </div>
  </div>
);

const heroVariants = [
  {
    id: "golden-cafe",
    title: "1 — Dog at Café (Recommended)",
    desc: "Warm, inviting — a golden retriever at an outdoor café captures the brand perfectly",
    img: "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=1400&q=85",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.55) 100%)",
    pos: "center 30%",
    align: "center",
  },
  {
    id: "happy-dog-park",
    title: "2 — Happy Dog in City Park",
    desc: "Energetic, joyful — a dog enjoying a city park with greenery and urban backdrop",
    img: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1400&q=85",
    overlay: "linear-gradient(135deg, rgba(26,26,46,0.6) 0%, rgba(0,0,0,0.25) 50%, rgba(26,26,46,0.55) 100%)",
    pos: "center 25%",
    align: "center",
  },
  {
    id: "city-walk",
    title: "3 — Dog Walking in European City",
    desc: "Aspirational travel feel — a dog with its owner on a charming city street",
    img: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1400&q=85",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.6) 100%)",
    pos: "center 40%",
    align: "left",
  },
  {
    id: "warm-orange-blend",
    title: "4 — Orange Brand + Photo Blend",
    desc: "Keeps the warm orange identity while adding depth with a background image",
    img: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1400&q=85",
    overlay: "linear-gradient(135deg, rgba(234,88,12,0.82) 0%, rgba(249,115,22,0.6) 50%, rgba(251,146,60,0.8) 100%)",
    pos: "center 35%",
    align: "center",
  },
  {
    id: "dogs-beach",
    title: "5 — Dogs at the Beach",
    desc: "Fun, playful vibe — two dogs running on a beach with golden light",
    img: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1400&q=85",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(15,52,96,0.6) 100%)",
    pos: "center 45%",
    align: "center",
  },
  {
    id: "dark-premium",
    title: "6 — Dark Premium (No Photo)",
    desc: "Sleek, modern feel — dark gradient with orange accents, no background image",
    img: null,
    overlay: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    pos: "center",
    align: "center",
  },
  {
    id: "split-layout",
    title: "7 — Split: Content Left + Dog Right",
    desc: "Content on one side, beautiful dog image on the other — modern SaaS feel",
    img: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1400&q=85",
    overlay: null,
    pos: "center",
    align: "left",
    isSplit: true,
  },
  {
    id: "cinematic",
    title: "8 — Cinematic Dark with Accent Glow",
    desc: "Dramatic lighting with an orange accent glow — premium and memorable",
    img: "https://images.unsplash.com/photo-1534361960057-19889db9621e?w=1400&q=85",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 35%, rgba(249,115,22,0.15) 70%, rgba(0,0,0,0.7) 100%)",
    pos: "center 30%",
    align: "center",
  },
];

export default function HeroOptions() {
  const [expandedId, setExpandedId] = useState("golden-cafe");

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      maxWidth: 960,
      margin: "0 auto",
      padding: "32px 20px",
      background: "#f8f9fa",
      minHeight: "100vh",
    }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
          PawCities — Hero Banner Options
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          Click any option to expand it. Pick your favorite for the homepage.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {heroVariants.map((v) => {
          const isExpanded = expandedId === v.id;

          return (
            <div key={v.id} style={{
              borderRadius: 16,
              overflow: "hidden",
              border: isExpanded ? "3px solid #f97316" : "2px solid #e5e7eb",
              boxShadow: isExpanded ? "0 4px 20px rgba(249,115,22,0.2)" : "0 1px 4px rgba(0,0,0,0.06)",
              transition: "all 0.2s ease",
              cursor: "pointer",
              background: "white",
            }}
              onClick={() => setExpandedId(v.id)}
            >
              {/* Label bar */}
              <div style={{
                padding: "14px 20px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: isExpanded ? "#fff7ed" : "white",
                borderBottom: isExpanded ? "1px solid #fed7aa" : "none",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isExpanded ? "#ea580c" : "#111827" }}>{v.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{v.desc}</div>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isExpanded ? "#f97316" : "#e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isExpanded ? "white" : "#9ca3af", fontSize: 14, fontWeight: 700,
                }}>
                  {isExpanded ? "▼" : "▶"}
                </div>
              </div>

              {/* Expanded hero preview */}
              {isExpanded && (
                v.isSplit ? (
                  // Split layout
                  <div style={{
                    display: "flex", minHeight: 360,
                  }}>
                    <div style={{
                      flex: 1,
                      background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                      padding: "60px 36px 36px",
                      display: "flex", flexDirection: "column", justifyContent: "center",
                    }}>
                      <HeroContent align="left" titleSize={36} subtitleSize={14} />
                    </div>
                    <div style={{
                      flex: 1,
                      background: `url("${v.img}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center 25%",
                      position: "relative",
                    }}>
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(90deg, #16213e 0%, transparent 30%)",
                      }} />
                    </div>
                  </div>
                ) : (
                  // Full-width hero
                  <div style={{
                    position: "relative",
                    minHeight: 380,
                    background: v.img
                      ? `${v.overlay}, url("${v.img}")`
                      : v.overlay,
                    backgroundSize: "cover",
                    backgroundPosition: v.pos,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: v.align === "left" ? "flex-start" : "center",
                    justifyContent: "center",
                    padding: v.align === "left" ? "70px 40px 40px" : "70px 32px 40px",
                  }}>
                    <NavBar transparent />
                    <HeroContent align={v.align} />
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Quick comparison */}
      <div style={{ marginTop: 40, textAlign: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 16 }}>
          Quick Comparison — All Options at a Glance
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {heroVariants.map((v) => (
            <div
              key={v.id + "-thumb"}
              onClick={() => { setExpandedId(v.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              style={{
                borderRadius: 10, overflow: "hidden", cursor: "pointer",
                border: expandedId === v.id ? "2px solid #f97316" : "2px solid transparent",
                transition: "border 0.2s",
              }}
            >
              <div style={{
                height: 80,
                background: v.isSplit
                  ? "linear-gradient(90deg, #1a1a2e 50%, #9ca3af 50%)"
                  : (v.img
                    ? `${v.overlay}, url("${v.img}&w=300&q=40")`
                    : v.overlay),
                backgroundSize: "cover",
                backgroundPosition: v.pos,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <DoublePaw size={20} color="white" />
              </div>
              <div style={{
                padding: "6px 8px",
                background: expandedId === v.id ? "#fff7ed" : "white",
                fontSize: 10, fontWeight: 600,
                color: expandedId === v.id ? "#ea580c" : "#374151",
              }}>
                Option {v.id === "golden-cafe" ? "1" : v.id === "happy-dog-park" ? "2" : v.id === "city-walk" ? "3" : v.id === "warm-orange-blend" ? "4" : v.id === "dogs-beach" ? "5" : v.id === "dark-premium" ? "6" : v.id === "split-layout" ? "7" : "8"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
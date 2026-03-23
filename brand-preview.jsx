import { useState } from "react";

const PawIcon = ({ size = 24, color = "currentColor", style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill={color} style={style}>
    {/* Main pad */}
    <ellipse cx="32" cy="42" rx="14" ry="12" />
    {/* Top left toe */}
    <ellipse cx="14" cy="22" rx="7" ry="9" transform="rotate(-15 14 22)" />
    {/* Top right toe */}
    <ellipse cx="50" cy="22" rx="7" ry="9" transform="rotate(15 50 22)" />
    {/* Inner left toe */}
    <ellipse cx="22" cy="16" rx="6" ry="8" transform="rotate(-5 22 16)" />
    {/* Inner right toe */}
    <ellipse cx="42" cy="16" rx="6" ry="8" transform="rotate(5 42 16)" />
  </svg>
);

const DoublePawIcon = ({ size = 48, color = "currentColor", gap = -8 }) => (
  <span style={{ display: "inline-flex", alignItems: "center" }}>
    <PawIcon size={size * 0.7} color={color} style={{ transform: "rotate(-15deg)", marginRight: gap }} />
    <PawIcon size={size * 0.85} color={color} style={{ transform: "rotate(10deg)" }} />
  </span>
);

// Logo Variation 1: Classic side-by-side
const Logo1 = ({ size = "md" }) => {
  const sizes = { sm: { icon: 32, text: 20 }, md: { icon: 48, text: 28 }, lg: { icon: 64, text: 40 } };
  const s = sizes[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <DoublePawIcon size={s.icon} color="#f97316" />
      <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: s.text, color: "#1a1a2e", letterSpacing: "-0.02em" }}>
        Paw<span style={{ color: "#f97316" }}>Cities</span>
      </span>
    </div>
  );
};

// Logo Variation 2: Stacked with circle badge
const Logo2 = ({ size = "md" }) => {
  const sizes = { sm: { r: 28, text: 14 }, md: { r: 44, text: 20 }, lg: { r: 60, text: 28 } };
  const s = sizes[size];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: s.r * 2, height: s.r * 2, borderRadius: "50%",
        background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 14px rgba(249, 115, 22, 0.35)"
      }}>
        <DoublePawIcon size={s.r * 1.1} color="white" />
      </div>
      <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: s.text, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        PawCities
      </span>
    </div>
  );
};

// Logo Variation 3: Modern with line accent
const Logo3 = ({ size = "md" }) => {
  const sizes = { sm: { icon: 28, text: 18 }, md: { icon: 40, text: 26 }, lg: { icon: 56, text: 36 } };
  const s = sizes[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        background: "linear-gradient(135deg, #f97316, #f59e0b)",
        borderRadius: 12, padding: "8px 10px",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <DoublePawIcon size={s.icon} color="white" gap={-4} />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: s.text, color: "#1a1a2e", lineHeight: 1, letterSpacing: "-0.03em" }}>
          PawCities
        </span>
        <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 400, fontSize: s.text * 0.38, color: "#9ca3af", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 2 }}>
          Dog-Friendly Places Worldwide
        </span>
      </div>
    </div>
  );
};

// Logo Variation 4: Minimal wordmark
const Logo4 = ({ size = "md" }) => {
  const sizes = { sm: { icon: 22, text: 18 }, md: { icon: 32, text: 26 }, lg: { icon: 44, text: 36 } };
  const s = sizes[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <PawIcon size={s.icon} color="#f97316" style={{ transform: "rotate(-10deg)" }} />
      <PawIcon size={s.icon * 0.85} color="#fb923c" style={{ transform: "rotate(12deg)", marginLeft: -8 }} />
      <span style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif", fontWeight: 700, fontSize: s.text, color: "#111827", marginLeft: 4 }}>
        paw<span style={{ color: "#f97316" }}>cities</span>
      </span>
    </div>
  );
};

// Hero Banner Mockup
const HeroBanner = ({ variant = "photo" }) => {
  const photoStyle = {
    background: `linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.5) 100%), url("https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=1200&q=80")`,
    backgroundSize: "cover",
    backgroundPosition: "center 35%",
  };

  const gradientStyle = {
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
  };

  const warmStyle = {
    background: `linear-gradient(135deg, rgba(234, 88, 12, 0.85) 0%, rgba(249, 115, 22, 0.7) 50%, rgba(251, 146, 60, 0.85) 100%), url("https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&q=80")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  const styles = { photo: photoStyle, dark: gradientStyle, warm: warmStyle };

  return (
    <div style={{
      ...styles[variant],
      borderRadius: 16,
      padding: "48px 32px",
      color: "white",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
      minHeight: 320,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Nav preview */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "16px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <DoublePawIcon size={28} color="white" />
          <span style={{ fontWeight: 700, fontSize: 16 }}>PawCities</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, opacity: 0.9 }}>
          <span>Home</span>
          <span>For Business</span>
          <span style={{ background: "#f97316", padding: "4px 12px", borderRadius: 6, fontWeight: 600 }}>Sign Up</span>
        </div>
      </div>

      <h1 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 42, fontWeight: 700,
        marginBottom: 12, lineHeight: 1.1,
        textShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}>
        Find Dog-Friendly Places
      </h1>
      <p style={{
        fontSize: 16, opacity: 0.92, maxWidth: 480, marginBottom: 24,
        textShadow: "0 1px 6px rgba(0,0,0,0.2)",
      }}>
        Discover the best restaurants, cafes, parks, and more that welcome your furry friend in cities around the world.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { icon: "🌳", label: "Parks" },
          { icon: "🍽️", label: "Restaurants" },
          { icon: "☕", label: "Cafes" },
          { icon: "🏨", label: "Hotels" },
          { icon: "🏖️", label: "Beaches" },
          { icon: "🏥", label: "Vets" },
        ].map(({ icon, label }) => (
          <span key={label} style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.25)",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 500,
          }}>
            {icon} {label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Color Palette
const ColorSwatch = ({ color, name, hex }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{
      width: 64, height: 64, borderRadius: 12,
      background: color,
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      border: "2px solid rgba(0,0,0,0.05)",
    }} />
    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: "#374151" }}>{name}</div>
    <div style={{ fontSize: 10, color: "#9ca3af" }}>{hex}</div>
  </div>
);

export default function BrandPreview() {
  const [heroVariant, setHeroVariant] = useState("photo");

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      maxWidth: 900,
      margin: "0 auto",
      padding: "32px 24px",
      background: "#fafafa",
      minHeight: "100vh",
    }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          PawCities Brand Preview
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Logo variations, hero banners & color palette</p>
      </div>

      {/* Logo Variations */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 20, borderBottom: "2px solid #e5e7eb", paddingBottom: 8 }}>
          Logo Variations
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {[
            { name: "A — Classic", desc: "Side-by-side, split color wordmark", Component: Logo1 },
            { name: "B — Badge", desc: "Stacked with orange circle icon", Component: Logo2 },
            { name: "C — Modern", desc: "Rounded icon + tagline", Component: Logo3 },
            { name: "D — Minimal", desc: "Lowercase, clean & techy", Component: Logo4 },
          ].map(({ name, desc, Component }) => (
            <div key={name} style={{
              background: "white", borderRadius: 16, padding: 28,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: "1px solid #e5e7eb",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            }}>
              <Component size="lg" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>{name}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{desc}</div>
              </div>
              {/* Dark background preview */}
              <div style={{
                background: "#1a1a2e", borderRadius: 10, padding: "16px 24px",
                width: "100%", display: "flex", justifyContent: "center",
              }}>
                <div style={{ filter: "brightness(1.1)" }}>
                  <Component size="sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hero Banner Variations */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 12, borderBottom: "2px solid #e5e7eb", paddingBottom: 8 }}>
          Hero Banner Options
        </h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { id: "photo", label: "Dog Photo Hero", desc: "Warm, emotional — recommended" },
            { id: "warm", label: "Orange + Photo Blend", desc: "Keeps brand color, adds depth" },
            { id: "dark", label: "Dark Gradient", desc: "Premium, minimal feel" },
          ].map(({ id, label, desc }) => (
            <button
              key={id}
              onClick={() => setHeroVariant(id)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: heroVariant === id ? "2px solid #f97316" : "2px solid #e5e7eb",
                background: heroVariant === id ? "#fff7ed" : "white",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 12, color: heroVariant === id ? "#ea580c" : "#374151" }}>{label}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{desc}</div>
            </button>
          ))}
        </div>
        <HeroBanner variant={heroVariant} />
      </section>

      {/* Color Palette */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 20, borderBottom: "2px solid #e5e7eb", paddingBottom: 8 }}>
          Brand Color Palette
        </h2>
        <div style={{
          background: "white", borderRadius: 16, padding: 28,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid #e5e7eb",
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Primary</div>
            <div style={{ display: "flex", gap: 16 }}>
              <ColorSwatch color="#f97316" name="Orange 500" hex="#f97316" />
              <ColorSwatch color="#ea580c" name="Orange 600" hex="#ea580c" />
              <ColorSwatch color="#fb923c" name="Orange 400" hex="#fb923c" />
              <ColorSwatch color="#fff7ed" name="Orange 50" hex="#fff7ed" />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Neutrals</div>
            <div style={{ display: "flex", gap: 16 }}>
              <ColorSwatch color="#1a1a2e" name="Navy" hex="#1a1a2e" />
              <ColorSwatch color="#111827" name="Gray 900" hex="#111827" />
              <ColorSwatch color="#6b7280" name="Gray 500" hex="#6b7280" />
              <ColorSwatch color="#f9fafb" name="Gray 50" hex="#f9fafb" />
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Accents</div>
            <div style={{ display: "flex", gap: 16 }}>
              <ColorSwatch color="#22c55e" name="Green" hex="#22c55e" />
              <ColorSwatch color="#3b82f6" name="Blue" hex="#3b82f6" />
              <ColorSwatch color="#eab308" name="Gold" hex="#eab308" />
              <ColorSwatch color="#ef4444" name="Red" hex="#ef4444" />
            </div>
          </div>
        </div>
      </section>

      {/* Social Media Preview */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 20, borderBottom: "2px solid #e5e7eb", paddingBottom: 8 }}>
          Social Media Profile Preview
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {/* Instagram-style */}
          <div style={{
            background: "white", borderRadius: 16, overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              height: 80, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <DoublePawIcon size={40} color="white" />
            </div>
            <div style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>PawCities</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Dog-Friendly Places Worldwide</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>Instagram / TikTok</div>
            </div>
          </div>
          {/* Twitter/X-style */}
          <div style={{
            background: "white", borderRadius: 16, overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{
              background: "#1a1a2e",
              height: 80, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <DoublePawIcon size={32} color="#f97316" />
              <span style={{ color: "white", fontWeight: 700, fontSize: 18 }}>PawCities</span>
            </div>
            <div style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>@pawcities</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Find dog-friendly spots in 8 cities</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>X / Twitter</div>
            </div>
          </div>
          {/* Facebook-style */}
          <div style={{
            background: "white", borderRadius: 16, overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{
              background: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url("https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=400&q=60")`,
              backgroundSize: "cover", backgroundPosition: "center",
              height: 80, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                background: "white", borderRadius: "50%", width: 48, height: 48,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <DoublePawIcon size={28} color="#f97316" />
              </div>
            </div>
            <div style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Paw Cities</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Travel & Lifestyle</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>Facebook</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
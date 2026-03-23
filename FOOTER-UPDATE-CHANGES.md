# Footer Logo Update — Changes to Apply on GitHub

Two files need updating to replace the old 🐾 emoji footer logo with the new SVG Logo component.

---

## File 1: `src/app/page.tsx` (Homepage)

### Change A — Add import (line 3)
Add this import after the existing imports:
```
import { Logo } from '@/components/Logo';
```

### Change B — Replace footer logo section
**FIND** (the old emoji footer):
```tsx
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-white">Paw Cities</span>
            </div>
```

**REPLACE WITH**:
```tsx
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Logo variant="horizontal" size="sm" />
            </Link>
```

Also add nav links after the Logo link:
```tsx
            <div className="flex items-center gap-6 text-sm">
              <Link href="/for-business" className="hover:text-white transition-colors">For Business</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
```

---

## File 2: `src/app/[slug]/CityPageClient.tsx` (City Pages)

### Change A — Add import (after the PremiumCard import)
```
import { Logo } from '@/components/Logo';
```

### Change B — Replace footer section
**FIND** (old emoji footer at the bottom of the file):
```tsx
      <footer className="bg-gray-900 text-gray-300 py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="font-display text-xl font-bold text-white">Paw Cities</span>
          </div>
          <p className="text-sm text-gray-500">© 2026 Paw Cities. Made with love for dogs and their humans.</p>
        </div>
      </footer>
```

**REPLACE WITH**:
```tsx
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Logo variant="horizontal" size="sm" />
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/for-business" className="hover:text-white transition-colors">For Business</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
            <p className="text-sm text-gray-500">© 2026 Paw Cities. Made with love for dogs and their humans.</p>
          </div>
        </div>
      </footer>
```

---

## No changes needed for:
- `src/app/for-business/page.tsx` — Already has no footer (uses global layout, which currently doesn't have a footer)
- `src/app/layout.tsx` — Metadata already uses "Paw Cities" (two words) ✅
- `src/components/Logo.tsx` — Already correct ✅

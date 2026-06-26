# Sarah's Foundation — Humanitarian Fundraising Experience

A premium, Awwwards-level landing page for **Sarah's Foundation**, built from the
brand blueprint: _Providing Hope · Creating Home · Creating Lives_.

> "A movement that transforms lives by connecting compassionate people with
> children, families, and communities that need hope most."

## Tech stack

| Concern      | Choice                                   |
| ------------ | ---------------------------------------- |
| Framework    | Next.js 15 (App Router)                  |
| Language     | TypeScript                               |
| Styling      | styled-components v6 (SSR registry)      |
| Animation    | Framer Motion                            |
| 3D (future)  | three.js + React Three Fiber (scaffolded)|
| Fonts        | Playfair Display + Inter (`next/font`)   |
| Deployment   | Vercel-ready                             |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

## Project structure

```
src/
  app/
    layout.tsx          # fonts, metadata, providers
    page.tsx            # section composition
  lib/
    registry.tsx        # styled-components SSR registry
    providers.tsx       # ThemeProvider + GlobalStyles
  styles/
    theme.ts            # design tokens (colors, type, spacing, motion)
    GlobalStyles.tsx    # reset + base styles + reduced-motion
    styled.d.ts         # theme typing for styled-components
  data/
    content.ts          # ALL editorial copy & data (edit here, not in JSX)
  components/
    ui/                 # Button, Container, Reveal, StatCounter, Logo, ...
    layout/             # Navbar, Footer, StickyDonate
    motion/             # Sunrise (CSS/SVG cinematic hero scene)
    three/              # HopeScene — React Three Fiber drop-in scaffold
    sections/           # Hero, ImpactCounter, OurStory, AreasOfImpact,
                        # ImpactMap, FeaturedStories, OrphanageHub,
                        # SponsorChild, Transparency, Testimonials, FinalCTA
```

## Design system

Tokens live in [`src/styles/theme.ts`](src/styles/theme.ts) and come straight
from the blueprint:

- **Hope Gold** `#F7B733` · **Sunrise Orange** `#F28C28` ·
  **Foundation Green** `#3D8B37` · **Deep Trust Blue** `#103D7A`
- 8px spacing scale, fluid `clamp()` type scale, pill buttons, soft layered
  shadows, "Modern Humanitarian Luxury" feel.

All copy is centralised in [`src/data/content.ts`](src/data/content.ts) so the
marketing team can update the site without touching components.

## Motion & accessibility

- Scroll reveals, count-up stats, sunrise animation, micro-interactions on CTAs.
- Every animation honours `prefers-reduced-motion`.
- Semantic HTML, focus-visible outlines, ARIA labels, thumb-friendly (48px+)
  targets, mobile-first layout, lazy/`next/font` loading.

## 3D roadmap (lightweight-first)

The first build uses CSS + SVG + Framer Motion for performance. React Three
Fiber is scaffolded in [`src/components/three/HopeScene.tsx`](src/components/three/HopeScene.tsx)
so an interactive globe / hope-rings scene can drop into the hero later without
re-architecting. Enable it by dynamically importing `HopeScene` into the hero.

## Deploy

Push to GitHub and import into Vercel — zero config. styled-components SSR is
already wired via the App Router registry.
```bash
# or from the CLI
npx vercel
```

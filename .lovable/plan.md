
# Hero Section — Using Your Illustration

Great hand-drawn artwork! It's a row of 8 quirky dog (and one rabbit 🐰) faces with the handwritten label "DOG WALKING & BASIC TRAINING". I'll feature it as the centerpiece of the Yo Dawg hero.

## Layout
Full-width hero on the landing page, centered, generous vertical padding, warm off-white background tinted with a soft Sunset Blaze gradient wash (peach → pink → lavender) behind the artwork so the black ink illustration pops.

```text
┌──────────────────────────────────────────────────┐
│  [top nav: Yo Dawg logo · Services · Sitters ·   │
│                            Log in · Sign up]     │
│                                                  │
│        ✨ Trusted by 2,000+ pet parents          │
│                                                  │
│            YO DAWG.        ← Abril Fatface,      │
│                              huge, orange→pink   │
│                              gradient            │
│                                                  │
│   Walks, sits, boards & trains — for every       │
│   kind of good boy (and girl).   ← Cabin sub    │
│                                                  │
│   [ Book a sitter → ]   [ Become a sitter ]      │
│                                                  │
│   ┌────────────────────────────────────────┐    │
│   │     [your 8-dog illustration]          │    │
│   │     "DOG WALKING & BASIC TRAINING"     │    │
│   └────────────────────────────────────────┘    │
│                                                  │
│   ★ 4.9 avg · 🐾 12k walks · 🏠 800 sitters     │
└──────────────────────────────────────────────────┘
```

## Details
- **Headline:** "Yo Dawg." in massive Abril Fatface with a Sunset Blaze gradient (`#ff6b35 → #e84393`).
- **Sub-headline:** Cabin, muted foreground, max ~2 lines.
- **CTAs:** Primary orange "Book a sitter" + outline "Become a sitter".
- **Illustration card:** rounded-3xl, soft shadow, slight rotation (-1°) for hand-made feel, gentle hover lift. Image lives full-bleed inside the card.
- **Background flourish:** soft radial gradient blob behind the card; tiny paw-print SVGs sprinkled around for personality.
- **Trust bar:** small chip above headline + stats row below the card.
- **Responsive:** stacks vertically on mobile; illustration scales to full width with reduced padding.

## Technical implementation
1. Copy `parsed-documents://…/page_1.jpg` into `src/assets/hero-dogs.jpg` and import it in the hero component.
2. Add Abril Fatface + Cabin via `<link>` in `index.html` and register them as `font-display` and `font-body` in `tailwind.config.ts`.
3. Extend the Tailwind/`index.css` design tokens with the **Sunset Blaze** palette (HSL): `--primary` orange, `--accent` pink, `--secondary` purple, plus a `--gradient-sunset` token used by the headline and CTA hover states.
4. Create `src/components/HeroSection.tsx` containing nav, headline, CTAs, illustration card, and trust strip — all using design-system tokens (no hard-coded colors).
5. Replace the placeholder in `src/pages/Index.tsx` with `<HeroSection />` (rest of the landing sections come later).

This sets up the design system + hero in one go so every future section inherits the Sunset Blaze + Abril/Cabin look.

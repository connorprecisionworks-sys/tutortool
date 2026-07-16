# Slate — Brand Guidelines

Everything needed to apply the Slate identity to the website and app.
Slate is the back office for tutors — it handles the money side (rates,
sessions, invoices, getting paid) so tutors can focus on teaching.

---

## Logo

The logo is the folded "S" mark. It comes three ways:

- **Mark only** — the S by itself. Use for favicons, app icons, tight spaces.
- **App icon** — the S centered on a rounded square. Use for the browser
  favicon, PWA / mobile app icon, social avatars.
- **Horizontal lockup** — mark + "SLATE" + the line "Back office for tutors."
  Use in the site header, marketing pages, email signatures.

Each comes in an **on-light** version (dark ink, for light backgrounds) and an
**on-dark** version (white ink, for dark backgrounds). SVG is the source —
use SVG on the web wherever possible; PNGs are provided for anywhere SVG
isn't practical.

**Clear space:** keep empty space around the logo at least equal to the height
of the S mark. **Minimum size:** don't render the lockup below ~120px wide, or
the mark below ~24px.

**Don't:** recolor the mark to off-brand colors, stretch or skew it, add
shadows/outlines, or place the on-light version on a busy/dark photo (use the
on-dark version instead).

---

## Colors

| Name        | Hex       | Use                                             |
|-------------|-----------|-------------------------------------------------|
| Near-black  | `#161616` | Primary dark background; ink on light           |
| Dark gray   | `#202020` | Secondary surfaces / cards on dark              |
| Charcoal    | `#2A2A2A` | Borders, dividers, raised surfaces on dark      |
| Slate blue  | `#5F728C` | **Primary brand accent** — buttons, links, mark |
| Light slate | `#A8B8CC` | Secondary text on dark, muted accents           |
| Off-white   | `#F7F7F7` | Primary light background; ink on dark           |

Slate blue (`#5F728C`) is the signature accent — use it for primary actions,
links, and highlights. Keep everything else in the grayscale range so the blue
carries the brand.

---

## Typography

- **Headings:** Inter Tight — Bold / Semibold.
- **Body:** Inter — Regular / Medium.

Both fonts are in the `/fonts` folder as variable TTFs, and both are free under
the SIL Open Font License (license files included). They're also on Google
Fonts, so on the web you can either self-host the files here or load:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Inter+Tight:wght@600;700&display=swap" rel="stylesheet">
```

```css
h1, h2, h3, .display { font-family: 'Inter Tight', sans-serif; font-weight: 700; }
body, p, .ui         { font-family: 'Inter', sans-serif; font-weight: 400; }
```

The "SLATE" wordmark in the logo is Inter Tight, uppercase, with wide letter
spacing. The tagline "BACK OFFICE FOR TUTORS" is Inter, uppercase, tracked even
wider, in slate blue (or light slate on dark backgrounds).

---

## Voice & messaging

- **Positioning line:** Back office for tutors.
- **Slogan:** Run your business. Focus on what matters.
- **What we do:** We handle the money side so you can focus on teaching.
- **Voice:** warm but crisp — a sharp assistant, not a bank. Professional,
  effortless, trustworthy.

---

## Note on the assets

The mark files were rebuilt as clean vectors from the original brand sheet
(`reference-brand-sheet.png`, included for reference). If you have the original
master/vector art for the S, prefer that — otherwise these are production-ready.

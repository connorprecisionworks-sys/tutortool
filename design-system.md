# TutorTool — Design System (ChatGPT-style monochrome)

Locked look: black and white, minimal, premium. Reads like the ChatGPT app, not a vibecoded SaaS. One typeface, hairline borders, black as the only accent, lots of whitespace, real dark mode. No color, no gradients, no drop shadows doing decoration.

## Principles

- Monochrome. Black text on white. The only "brand color" is near-black, used for primary buttons (black fill, white text, like ChatGPT's send button).
- Structure comes from whitespace and hairline borders, not shadows or fills.
- One sans typeface everywhere (Inter as the free stand-in for ChatGPT's Söhne). Optional serif display face only for a marketing page, never in the app.
- Calm and quiet. Nothing shouts. Status is shown with weight and a small dot, not loud color badges.
- Every state designed: empty, loading, error, success. No dead ends.

## Tokens (CSS variables, drive everything via Tailwind theme)

Light:
- `--bg`: #ffffff (app background / main content)
- `--surface`: #ffffff (cards, over hairline borders)
- `--surface-sunken`: #f9f9f9 (sidebar, table header, hover rows)
- `--border`: #e5e5e5 (hairline)
- `--border-strong`: #d0d0d0
- `--text`: #0d0d0d (primary)
- `--text-secondary`: #6e6e80
- `--text-tertiary`: #8e8ea0 (placeholder, captions)
- `--accent`: #0d0d0d (primary button fill)
- `--accent-text`: #ffffff (text on accent)
- `--hover`: #f2f2f3 (ghost button / row hover)
- `--focus-ring`: #0d0d0d at 15% for rings

Dark (ChatGPT dark):
- `--bg`: #212121
- `--surface`: #2f2f2f
- `--surface-sunken`: #1a1a1a
- `--border`: #4d4d4d
- `--border-strong`: #5f5f5f
- `--text`: #ececec
- `--text-secondary`: #b4b4b4
- `--text-tertiary`: #8e8e8e
- `--accent`: #ffffff (button flips to white fill)
- `--accent-text`: #0d0d0d
- `--hover`: #3a3a3a

## Type

- Family: Inter (or system sans fallback). One family.
- Scale: page title 24/600, section 18/600, body 14-15/400, caption 13/400, table 14/400.
- Numbers (money) tabular-nums. Money always shown as $X,XXX.XX.
- Line-height generous (1.5 body). Letter-spacing default.

## Layout

- Left sidebar nav, fixed, `--surface-sunken`, hairline right border. Items: Dashboard, Clients, Sessions, Invoices, Settings. Active item = subtle `--hover` fill + `--text`, inactive = `--text-secondary`. Collapsible on mobile (hamburger).
- Main content: max-width ~1100px, centered, generous padding (32px desktop, 16px mobile).
- Top of content: page title + one primary action button on the right.

## Components

- **Buttons.** Primary: `--accent` fill, `--accent-text`, rounded-lg (10px), medium weight, no shadow. Secondary/ghost: transparent, `--text`, hairline border, `--hover` on hover. Small height (~36-40px). Icon buttons square, ghost.
- **Cards / panels.** `--surface`, 1px `--border`, rounded-xl (14px), no shadow. Padding 20-24px.
- **Inputs.** White/`--surface`, 1px `--border`, rounded-lg, focus = `--border-strong` + subtle ring. Inline-editable fields where the scope calls for it (rates, session values).
- **Tables.** Header row `--surface-sunken`, hairline row separators, row hover `--hover`. Right-align money, tabular-nums. Clickable rows go to detail.
- **Status.** Small dot + label, weight for emphasis, grayscale by default: Draft (hollow dot), Sent (gray dot), Paid (filled black dot / filled white in dark), Overdue (black dot + bold label). Keep it monochrome; use fill and weight, not red/green, to stay on-brand. (If a single functional accent is ever needed for Overdue, that is the one allowed exception, decide later.)
- **Empty states.** Centered, one line of plain-English guidance + the primary action (e.g. "No clients yet. Add your first student to start billing.").
- **Toasts / confirms.** Minimal, `--surface`, hairline border, bottom-center.

## Motion

- Subtle only. 150ms ease on hover/focus, fade+rise on panel/modal open. No bounce, no long animations.

## Do not

- No colored gradients, no glassmorphism, no heavy shadows, no multiple accent colors, no more than one typeface in the app, no emoji in the UI.

In plain English: this is the paint-and-layout rulebook so the app looks clean and expensive like ChatGPT, black and white with lots of breathing room, and so both light and dark mode match. It keeps whoever builds it from making it look busy or cheap.

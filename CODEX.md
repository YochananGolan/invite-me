# CODEX — Meet-M project context

## Stack
- Next.js Pages Router, React 18, Tailwind CSS 3, Supabase (auth + DB), Hebrew RTL (`dir="rtl"`)

## Design tokens
- **Landing bg**: `bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)]`
- **Workspace bg** (same dark tone): same gradient above on `#pricing` div in `pages/index.js`
- **Glass card**: `bg-white/[0.055] backdrop-blur-xl border border-white/15 rounded-lg`
- **Step bar**: `bg-gradient-to-b from-[#1a1d4a]/95 to-[#12143a]/95 backdrop-blur-2xl border-y border-white/[0.12]`
- **Primary CTA**: `bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)]`
- **Text primary**: `text-slate-100` — **never** `text-gray-900` on dark backgrounds

## Key files
| File | Role |
|------|------|
| `pages/index.js` | Homepage — NavBar, HeroSection, StepButtons workspace, modals |
| `components/HeroSection.js` | Hero text column + 3D card preview (3 cards: InviteCard, StatsCard, MessagesCard) |
| `components/StepButtons.js` | Full event-creation wizard + step bar (sticky bottom) |
| `components/NavBar.js` | Top nav |
| `components/Modal.js` | Generic modal primitive |
| `components/Drawer.js` | Generic drawer primitive |
| `components/AuthModal.js` | Auth flow |

## Step bar
Uses `position: sticky; bottom: 0` (CSS only). **No JS scroll listener, no sentinel ref, no stepBarSettled state.**
Full-bleed via `mx-[calc(50%-50vw)] w-screen`.

## Hero preview cards
3 cards only at desktop 3D stage: **InviteCard** (260px), **StatsCard** (240px), **MessagesCard** (240px).
GuestsCard and AnalyticsCard are defined but NOT rendered.
Mobile: same 3 cards in flat grid.

## DO NOT
- Add `bg-slate-50` / `text-gray-900` anywhere in the workspace area
- Add a fixed/absolute step bar with JS scroll listener (use sticky)
- Add a 4th or 5th card to the hero preview stage
- Add icon buttons (WhatsApp circle, upload circle) to the InviteCard bottom row
- Use `overflow-hidden` on the hero section outer div — it clips 3D card perspectives
- Render GuestsCard or AnalyticsCard in the desktop 3D stage

## WIP / in-progress
- All modal/drawer redesigns done (Modal.js, Drawer.js)
- Workspace dark theme applied (index.js L140, StepButtons Tranzila div)
- Hero 3-card collage with 3D tilts implemented

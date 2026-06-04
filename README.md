# my-rfp-timeline

A personal companion site for **Rock for People 2026** (10–14 June, Hradec Králové). Scrapes the official line-up from [rockforpeople.cz](https://rockforpeople.cz/en/harmonogram/), renders a punk-poster timeline of all 5 days × 8 stages, lets you pick the sets you want to catch, warns on time clashes, and exports your picks as an `.ics` file for Google Calendar.

Built with Astro 5 + Preact + Tailwind 4. The site is **fully static**; solo picks live in `localStorage` with JSON backup/restore. Optional **group sync** uses Supabase Postgres + Realtime (no custom server).


## Scripts

```bash
pnpm run dev      # local dev at http://localhost:4321/
pnpm run scrape   # refresh src/data/lineup.json from rockforpeople.cz
pnpm run build    # static output in dist/, deploy anywhere
pnpm run check    # type-check
npx tsx scripts/verify.ts   # smoke tests
```

Re-run `npm run scrape` whenever the festival updates the schedule, then rebuild.

## Group picks (Supabase, optional)

Without Supabase env vars, the app works as before (solo + JSON backup only).

1. Create a [Supabase](https://supabase.com) project.
2. Apply the migrations in order (pick one):
   - **Dashboard:** SQL Editor → paste and run each file in [`supabase/migrations/`](supabase/migrations/) (oldest timestamp first).
   - **CLI** (from repo root, after `supabase login` and `supabase link`): `supabase db push`
3. Copy **Project URL** and **anon public** key from Project Settings → API.
4. Copy [`.env.example`](.env.example) to `.env` and fill in `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
5. Restart `npm run dev` or set the same variables on your static host (Cloudflare Pages, Netlify, etc.) before `npm run build`.

The anon key is meant to be public in the browser; access is limited by Row Level Security on `festival_rooms`. Room codes are short random strings — fine for friends, not for secrets.

In a group room, each person picks a display name (or uses **Random name**). Set cards show who picked what (e.g. `Alice · Bob`). Conflicts are computed across everyone’s picks. Export and JSON backup still contain **your** picks only.

### Manual test checklist

- [ ] Two browsers/tabs open the same invite link (`?room=CODE`); toggling a set on one updates the other.
- [ ] Tab A “Alice”, tab B “Bob” — both pick the same set → both names on the card.
- [ ] Alice unpicks → Bob’s name remains on that set.
- [ ] Random name → stored and visible to others after pick.
- [ ] Refresh keeps the shared list and your name (Postgres + session + localStorage).
- [ ] **Leave group** returns to solo mode; picks remain on the device and save to `localStorage` again.
- [ ] Joining with local picks uploads them under your name (confirm dialog).
- [ ] Import/clear in a room updates your picks only; others’ picks stay.

## Disclaimer

This is an **unofficial fan-made project**. It is **not affiliated with, endorsed by, sponsored by, or in any way officially connected to Rock for People**, its organisers, or any of the artists listed. The schedule data is read from the publicly available [rockforpeople.cz](https://rockforpeople.cz) website for personal, non-commercial use only. All festival, stage, artist, and band names belong to their respective rights holders. No permission has been requested or granted by the festival or any of its associated parties. If you represent Rock for People or any rights holder and have concerns, please open an issue and the project will be adjusted or taken down.

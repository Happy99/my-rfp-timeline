# my-rfp-timeline

A personal companion site for **Rock for People 2026** (10–14 June, Hradec Králové). Scrapes the official line-up from [rockforpeople.cz](https://rockforpeople.cz/en/harmonogram/), renders a punk-poster timeline of all 5 days × 8 stages, lets you pick the sets you want to catch, warns on time clashes, and exports your picks as an `.ics` file for Google Calendar.

Built with Astro 5 + Preact + Tailwind 4. Fully static, no backend — selections live in `localStorage` with JSON backup/restore.

## Scripts

```bash
npm run dev      # local dev at http://localhost:4321/
npm run scrape   # refresh src/data/lineup.json from rockforpeople.cz
npm run build    # static output in dist/, deploy anywhere
npm run check    # type-check
npx tsx scripts/verify.ts   # smoke tests
```

Re-run `npm run scrape` whenever the festival updates the schedule, then rebuild.

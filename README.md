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

## Disclaimer

This is an **unofficial fan-made project**. It is **not affiliated with, endorsed by, sponsored by, or in any way officially connected to Rock for People**, its organisers, or any of the artists listed. The schedule data is read from the publicly available [rockforpeople.cz](https://rockforpeople.cz) website for personal, non-commercial use only. All festival, stage, artist, and band names belong to their respective rights holders. No permission has been requested or granted by the festival or any of its associated parties. If you represent Rock for People or any rights holder and have concerns, please open an issue and the project will be adjusted or taken down.


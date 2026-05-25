import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { LineupSchema, type Day, type Lineup, type Set as FestSet } from '../src/data/schema.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/lineup.json');

const SCHEDULE_URL = 'https://rockforpeople.cz/en/harmonogram/';
const LINEUP_URL = 'https://rockforpeople.cz/en/lineup/';

// A festival night extends from afternoon until ~sleep time. Sets that start
// before this hour are considered the night-tail of the *previous* festival
// day, regardless of which calendar date they technically fall on.
const FESTIVAL_NIGHT_ENDS_AT_HOUR = 10;

const KNOWN_STAGES = [
  'Mastercard Stage',
  'Rock for People Stage',
  'E2 Stage',
  'Petr Svoboda Stage',
  'ČT art Stage',
  'Reflex Stage',
  'EcoFlow Stage',
  'Karaoke Stage',
];

const DAYS_2026: Array<{ weekday: string; day: number; date: string; shortLabel: string }> = [
  { weekday: 'Wednesday', day: 10, date: '2026-06-10', shortLabel: 'Wed 10.6.' },
  { weekday: 'Thursday', day: 11, date: '2026-06-11', shortLabel: 'Thu 11.6.' },
  { weekday: 'Friday', day: 12, date: '2026-06-12', shortLabel: 'Fri 12.6.' },
  { weekday: 'Saturday', day: 13, date: '2026-06-13', shortLabel: 'Sat 13.6.' },
  { weekday: 'Sunday', day: 14, date: '2026-06-14', shortLabel: 'Sun 14.6.' },
];

const dayDataRe = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)-(\d{1,2})-6$/i;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 my-rfp-timeline-scraper/0.1',
      'Accept-Language': 'en,cs;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

function slugFromUrl(href: string): string | null {
  const m = href.match(/\/(?:lineup|art-program)\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]!) : null;
}

type EnrichRow = { slug: string; image: string | null; country: string | null };

function buildEnrichmentIndex(html: string): Map<string, EnrichRow> {
  const $ = cheerio.load(html);
  const index = new Map<string, EnrichRow>();
  $('a[href*="/lineup/"]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href');
    if (!href) return;
    const slug = slugFromUrl(href);
    if (!slug) return;
    if (index.has(slug)) return;

    const img = a.find('img').first().attr('src') ?? null;
    const h3text = a.find('h3').first().text().trim();
    let country: string | null = null;
    if (h3text) {
      // e.g. "Limp Bizkit US" — last token of all-caps 2-3 letters
      const m = h3text.match(/\b([A-Z]{2,3})\s*$/);
      if (m) country = m[1]!;
    }
    index.set(slug, { slug, image: img, country });
  });
  return index;
}

function makeSetId(date: string, stageId: string, slug: string, start: string): string {
  return `${date}-${stageId}-${slug}-${start.replace(':', '')}`;
}

function buildStageNameIndex($: cheerio.CheerioAPI): Map<string, string> {
  const map = new Map<string, string>();
  $('[data-stage]').each((_, el) => {
    const id = $(el).attr('data-stage');
    if (!id || id === 'all' || map.has(id)) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text && text.length < 60) map.set(id, text);
  });
  return map;
}

function timeStringFromAttr(v: string | undefined): string | null {
  if (!v) return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

type RawEntry = {
  sourceDate: string;
  stageId: string;
  stageName: string;
  start: string;
  end: string;
  artist: string;
  slug: string;
  href: string;
  crossesMidnight: boolean;
};

function scrapeSchedule(html: string, enrich: Map<string, EnrichRow>): Day[] {
  const $ = cheerio.load(html);
  const stageNames = buildStageNameIndex($);
  const rawEntries: RawEntry[] = [];

  $('.timetable__day').each((_, dayEl) => {
    const dayAttr = $(dayEl).attr('data-day');
    if (!dayAttr) return;
    const m = dayAttr.match(dayDataRe);
    if (!m) return;
    const weekday = m[1]!.toLowerCase();
    const dayNum = parseInt(m[2]!, 10);
    const info = DAYS_2026.find((d) => d.weekday.toLowerCase() === weekday && d.day === dayNum);
    if (!info) return;

    $(dayEl)
      .find('.timetable__stagetime')
      .each((_, stageEl) => {
        const stageId = $(stageEl).attr('data-stage');
        if (!stageId) return;
        const stageName = stageNames.get(stageId);
        if (!stageName) return;

        $(stageEl)
          .find('.timetable__entry')
          .each((_, entryEl) => {
            const $entry = $(entryEl);
            const dataType = $entry.attr('data-type');
            if (dataType !== 'lineup' && dataType !== 'program') return;
            const start = timeStringFromAttr($entry.attr('data-start-time'));
            const end = timeStringFromAttr($entry.attr('data-end-time'));
            if (!start || !end) return;

            const $a = $entry
              .find('a[href*="/lineup/"], a[href*="/art-program/"]')
              .first();
            const href = $a.attr('href');
            if (!href) return;
            const slug = slugFromUrl(href);
            if (!slug) return;

            const artist =
              $a.find('.name').first().text().trim() ||
              $a
                .clone()
                .find('.time')
                .remove()
                .end()
                .text()
                .replace(/\s+/g, ' ')
                .trim();
            if (!artist) return;

            const startH = parseInt(start.slice(0, 2), 10);
            const endH = parseInt(end.slice(0, 2), 10);
            const crossesMidnight = endH < startH;
            rawEntries.push({
              sourceDate: info.date,
              stageId,
              stageName,
              start,
              end,
              artist,
              slug,
              href,
              crossesMidnight,
            });
          });
      });
  });

  // Bucket sets exactly where the source puts them. A set with start < the
  // festival-night cutoff and no midnight-cross gets startCalendarOffsetDays=1
  // because the source's day-bucket represents the *festival night*, so a
  // 00:45 set under Thu actually plays at 00:45 on calendar Friday.
  const dayBuckets = new Map<string, Map<string, { name: string; sets: FestSet[] }>>();

  for (const e of rawEntries) {
    const startH = parseInt(e.start.slice(0, 2), 10);
    const isLateNight = !e.crossesMidnight && startH < FESTIVAL_NIGHT_ENDS_AT_HOUR;
    const bucketDate = e.sourceDate;
    const startCalendarOffsetDays: 0 | 1 = isLateNight ? 1 : 0;

    let stagesMap = dayBuckets.get(bucketDate);
    if (!stagesMap) {
      stagesMap = new Map();
      dayBuckets.set(bucketDate, stagesMap);
    }
    let stageBucket = stagesMap.get(e.stageId);
    if (!stageBucket) {
      stageBucket = { name: e.stageName, sets: [] };
      stagesMap.set(e.stageId, stageBucket);
    }
    const enrichment = enrich.get(e.slug);
    stageBucket.sets.push({
      id: makeSetId(bucketDate, e.stageId, e.slug, e.start),
      slug: e.slug,
      artist: e.artist,
      country: enrichment?.country ?? null,
      image: enrichment?.image ?? null,
      url: new URL(e.href, LINEUP_URL).toString(),
      start: e.start,
      end: e.end,
      crossesMidnight: e.crossesMidnight,
      startCalendarOffsetDays,
    });
  }

  return DAYS_2026.filter((d) => dayBuckets.has(d.date)).map((d) => {
    const stagesMap = dayBuckets.get(d.date)!;
    const orderedStages = KNOWN_STAGES.map((stageName) => {
      const entry = [...stagesMap.values()].find((s) => s.name === stageName);
      return entry ? entry : null;
    }).filter((s): s is { name: string; sets: FestSet[] } => Boolean(s));
    for (const s of orderedStages) {
      s.sets.sort((a, b) => festivalDayOrderKey(a).localeCompare(festivalDayOrderKey(b)));
    }
    return {
      date: d.date,
      label: `${d.weekday} ${d.day}.6.`,
      shortLabel: d.shortLabel,
      stages: orderedStages,
    };
  });
}

function festivalDayOrderKey(s: FestSet): string {
  // Sort within a festival day so afternoon (12:00+) comes before early-morning
  // continuations (00:00-09:59 on the next calendar day).
  return `${s.startCalendarOffsetDays}-${s.start}`;
}


async function main() {
  console.log(`▶ fetching ${SCHEDULE_URL}`);
  const scheduleHtml = await fetchHtml(SCHEDULE_URL);
  console.log(`▶ fetching ${LINEUP_URL}`);
  const lineupHtml = await fetchHtml(LINEUP_URL);

  const enrichment = buildEnrichmentIndex(lineupHtml);
  console.log(`  enrichment rows: ${enrichment.size}`);

  const days = scrapeSchedule(scheduleHtml, enrichment);
  const setsCount = days.reduce((n, d) => n + d.stages.reduce((m, s) => m + s.sets.length, 0), 0);
  console.log(`  parsed ${days.length} days, ${setsCount} sets`);

  const result: Lineup = {
    festival: 'Rock for People',
    year: 2026,
    location: 'Hradec Králové, CZ',
    sourceUrl: SCHEDULE_URL,
    scrapedAt: new Date().toISOString(),
    stages: KNOWN_STAGES,
    days,
  };

  const validated = LineupSchema.parse(result);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(validated, null, 2) + '\n', 'utf8');
  console.log(`✓ wrote ${OUT}`);

  if (setsCount < 30) {
    console.warn(`⚠ only ${setsCount} sets parsed — schedule may not be published yet, or HTML changed.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

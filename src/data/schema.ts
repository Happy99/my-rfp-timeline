import { z } from 'zod';

export const SetSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  artist: z.string().min(1),
  country: z.string().nullable(),
  image: z.string().url().nullable(),
  url: z.string().url(),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  crossesMidnight: z.boolean(),
  // 1 when the set's calendar date is the day AFTER its festival-night bucket
  // (e.g. a 00:45 set displayed under Wed actually plays on Thu calendar).
  startCalendarOffsetDays: z.union([z.literal(0), z.literal(1)]),
});
export type Set = z.infer<typeof SetSchema>;

export const StageSchema = z.object({
  name: z.string().min(1),
  sets: z.array(SetSchema),
});
export type Stage = z.infer<typeof StageSchema>;

export const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  stages: z.array(StageSchema),
});
export type Day = z.infer<typeof DaySchema>;

export const LineupSchema = z.object({
  festival: z.string(),
  year: z.number().int(),
  location: z.string(),
  sourceUrl: z.string().url(),
  scrapedAt: z.string(),
  days: z.array(DaySchema).min(1),
  stages: z.array(z.string().min(1)).min(1),
});
export type Lineup = z.infer<typeof LineupSchema>;

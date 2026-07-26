export function nowIso(): string {
  return new Date().toISOString();
}

export function isWithinLookback(isoDate: string | undefined, lookbackHours: number): boolean {
  if (!isoDate) return true;
  const time = Date.parse(isoDate);
  if (!Number.isFinite(time)) return true;
  return Date.now() - time <= lookbackHours * 60 * 60 * 1000;
}

export function parseRelativePublishedAt(text: string, now = new Date()): string | undefined {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;

  const today = /\b(today|сьогодні|сегодня)\b/.test(normalized);
  if (today) return now.toISOString();

  const yesterday = /\b(yesterday|вчора|вчера)\b/.test(normalized);
  if (yesterday) return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const match = normalized.match(/(\d+)\s*(minute|minutes|min|хв|мин|hour|hours|hr|hrs|год|годин|час|часа|день|дня|days|day)/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2] || "";
  if (!Number.isFinite(amount)) return undefined;

  if (/minute|minutes|min|хв|мин/.test(unit)) {
    return new Date(now.getTime() - amount * 60 * 1000).toISOString();
  }
  if (/hour|hours|hr|hrs|год|годин|час|часа/.test(unit)) {
    return new Date(now.getTime() - amount * 60 * 60 * 1000).toISOString();
  }
  if (/day|days|день|дня/.test(unit)) {
    return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000).toISOString();
  }

  return undefined;
}

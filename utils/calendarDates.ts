export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export interface MonthCell {
  key: string;
  day: number;
  inMonth: boolean;
}

/** `new Date(bad).toISOString()` throws RangeError (unlike toLocaleDateString, which just prints "Invalid Date") - guard every ISO-string conversion against a malformed/corrupted date key. */
function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function addDays(dateKey: string, delta: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!isValidDate(date)) return getLocalDateKey();
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function dateKeyOf(date: Date): string {
  if (!isValidDate(date)) return getLocalDateKey();
  return date.toISOString().slice(0, 10);
}

// Unlike dateKeyOf (which works in UTC — correct for the synthetic Date.UTC(...)
// cells built for the calendar grid below), this reads the device's LOCAL
// calendar day. Using toISOString() for "what day is it right now" converts to
// UTC first, so anyone east of UTC sees "today" roll over hours before their
// actual local midnight — a meal logged just after local midnight gets filed
// under yesterday's key until UTC catches up.
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: MonthCell[] = [];
  for (let i = startWeekday; i > 0; i -= 1) {
    const date = new Date(Date.UTC(year, month, 1 - i));
    cells.push({ key: dateKeyOf(date), day: date.getUTCDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: dateKeyOf(new Date(Date.UTC(year, month, day))), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const date = addDays(last.key, 1);
    cells.push({ key: date, day: new Date(`${date}T00:00:00Z`).getUTCDate(), inMonth: false });
  }
  return cells;
}

export function monthYearOf(dateKey: string): { year: number; month: number } {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const fallback = isValidDate(d) ? d : new Date(`${getLocalDateKey()}T00:00:00Z`);
  return { year: fallback.getUTCFullYear(), month: fallback.getUTCMonth() };
}

export function formatDateShort(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const fallback = isValidDate(d) ? d : new Date(`${getLocalDateKey()}T00:00:00Z`);
  return fallback.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

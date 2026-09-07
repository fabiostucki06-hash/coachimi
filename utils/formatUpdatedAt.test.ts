import { formatUpdatedAt } from './formatUpdatedAt';

describe('formatUpdatedAt', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T14:30:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports edits from the last minute as just now', () => {
    expect(formatUpdatedAt(new Date('2026-01-15T14:29:45').toISOString())).toBe('gerade eben');
  });

  it('reports edits under an hour ago in minutes', () => {
    expect(formatUpdatedAt(new Date('2026-01-15T14:25:00').toISOString())).toBe('vor 5 Min.');
  });

  it('reports older same-day edits with a time', () => {
    expect(formatUpdatedAt(new Date('2026-01-15T09:00:00').toISOString())).toBe('heute um 09:00 Uhr');
  });

  it('reports yesterday explicitly', () => {
    expect(formatUpdatedAt(new Date('2026-01-14T18:00:00').toISOString())).toBe('gestern um 18:00 Uhr');
  });

  it('falls back to a date for older edits', () => {
    expect(formatUpdatedAt(new Date('2026-01-10T18:00:00').toISOString())).toBe('am 10.01. um 18:00 Uhr');
  });
});

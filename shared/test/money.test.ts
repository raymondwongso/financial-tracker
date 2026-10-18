import { describe, expect, it } from 'vitest';
import {
  currentMonth,
  formatMoney,
  fractionDigits,
  monthBounds,
  monthRange,
  toMajor,
  toMinor,
} from '../src';

describe('money helpers', () => {
  it('knows minor-unit digits per currency', () => {
    expect(fractionDigits('USD')).toBe(2);
    expect(fractionDigits('JPY')).toBe(0);
  });

  it('converts major to minor units without float drift', () => {
    expect(toMinor(12.5, 'USD')).toBe(1250);
    expect(toMinor(0.1 + 0.2, 'USD')).toBe(30);
    expect(toMinor(1500, 'JPY')).toBe(1500);
  });

  it('converts minor to major units', () => {
    expect(toMajor(1250, 'USD')).toBe(12.5);
    expect(toMajor(1500, 'JPY')).toBe(1500);
  });

  it('formats money for display', () => {
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
    expect(formatMoney(-500, 'USD')).toBe('-$5.00');
  });

  it('uses local currency symbols instead of ISO codes', () => {
    const plain = (s: string) => s.replace(/\u00a0/g, ' ');
    expect(plain(formatMoney(1500000, 'IDR'))).toBe('Rp 1,500,000');
    expect(formatMoney(999, 'EUR')).toBe('€9.99');
    expect(formatMoney(1500, 'JPY')).toBe('¥1,500');
    expect(formatMoney(2050, 'GBP')).toBe('£20.50');
  });

  it('adds an explicit plus sign when signed', () => {
    expect(formatMoney(25000, 'USD', { signed: true })).toBe('+$250.00');
    expect(formatMoney(-1250, 'USD', { signed: true })).toBe('-$12.50');
    expect(formatMoney(0, 'USD', { signed: true })).toBe('$0.00');
  });
});

describe('month helpers', () => {
  it('computes a half-open month range', () => {
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-03-01' });
  });

  it('rolls over at year end', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });

  it('formats the current month in UTC', () => {
    expect(currentMonth(new Date('2026-10-18T12:00:00Z'))).toBe('2026-10');
  });
});

describe('monthBounds', () => {
  it('returns inclusive first and last day, including leap years', () => {
    expect(monthBounds('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

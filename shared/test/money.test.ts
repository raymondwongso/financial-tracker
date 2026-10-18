import { describe, expect, it } from 'vitest';
import { currentMonth, formatMoney, fractionDigits, monthRange, toMajor, toMinor } from '../src';

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

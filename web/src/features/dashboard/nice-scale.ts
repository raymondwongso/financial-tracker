export interface Scale {
  max: number;
  step: number;
}

/** Axis 0..max with 4-5 gridlines at "nice" steps (1, 2, 2.5, 5, 10 × 10^n). */
export function niceScale(maxValue: number): Scale {
  if (maxValue <= 0) return { max: 1_000_000, step: 250_000 };
  const rough = maxValue / 4;
  const p = 10 ** Math.floor(Math.log10(rough));
  const f = rough / p;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  const step = nf * p;
  return { max: Math.ceil(maxValue / step) * step, step };
}

"use client";

import { useState } from "react";
import type { InvestmentAccount, InvestmentPricePoint } from "@financialtracker/shared";
import { Modal } from "@/components/ui/modal";
import { formatDate, formatDateShort, formatPrice } from "@/lib/format";
import { useInvestmentPriceHistory } from "../hooks";
import { formatTicks, priceScale } from "../price-scale";

const W = 640;
const H = 300;
const M = { top: 16, right: 20, bottom: 34, left: 84 };

const TIP_W = 124;
const TIP_H = 44;

/** Exact price and date next to the hovered point; flips below / clamps sideways near the edges. */
function Tooltip({ point }: { point: { date: string; price: number; cx: number; cy: number } }) {
  const x = Math.min(Math.max(point.cx - TIP_W / 2, M.left), W - M.right - TIP_W);
  const y = point.cy - TIP_H - 12 < M.top ? point.cy + 14 : point.cy - TIP_H - 12;
  return (
    <g data-testid="price-tooltip" pointerEvents="none">
      <rect x={x} y={y} width={TIP_W} height={TIP_H} className="fill-surface stroke-ink" strokeWidth={2} />
      <text x={x + 10} y={y + 17} className="fill-muted text-[11px]">{formatDate(point.date)}</text>
      <text x={x + 10} y={y + 35} className="fill-ink text-[14px] font-bold">{formatPrice(point.price)}</text>
    </g>
  );
}

function PriceChart({ points, avgCost, unit }: { points: InvestmentPricePoint[]; avgCost: number | null; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const times = points.map((p) => Date.parse(p.date));
  const t0 = times[0]!;
  const t1 = times[times.length - 1]!;
  const scale = priceScale([...points.map((p) => p.price), ...(avgCost === null ? [] : [avgCost])]);
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;
  const x = (t: number) => M.left + (t1 === t0 ? pw / 2 : ((t - t0) / (t1 - t0)) * pw);
  const y = (v: number) => M.top + ph - ((v - scale.min) / (scale.max - scale.min)) * ph;
  const tickLabels = formatTicks(scale.ticks);
  const coords = points.map((p, i) => ({ ...p, cx: x(times[i]!), cy: y(p.price) }));
  const shown = coords[hover ?? coords.length - 1]!;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.cx - px) < Math.abs(coords[best]!.cx - px)) best = i;
    });
    setHover(best);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-baseline gap-x-3" aria-live="polite">
        <span className="text-2xl font-extrabold">{formatPrice(shown.price)}</span>
        <span className="text-sm text-muted">per {unit} · {formatDate(shown.date)}</span>
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Price history, ${points.length} ${points.length === 1 ? "entry" : "entries"}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {scale.ticks.map((t, i) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="stroke-grid" strokeWidth={1} />
            <text x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted text-[11px]">
              {tickLabels[i]}
            </text>
          </g>
        ))}
        {avgCost !== null && (
          <g>
            <line x1={M.left} x2={W - M.right} y1={y(avgCost)} y2={y(avgCost)} className="stroke-muted" strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={W - M.right} y={y(avgCost) - 6} textAnchor="end" className="fill-muted text-[11px] font-semibold">
              Avg buy price {formatPrice(avgCost)}
            </text>
          </g>
        )}
        <text x={M.left} y={H - 10} textAnchor="start" className="fill-muted text-[11px]">{formatDateShort(points[0]!.date)}</text>
        {points.length > 1 && (
          <text x={W - M.right} y={H - 10} textAnchor="end" className="fill-muted text-[11px]">{formatDateShort(points[points.length - 1]!.date)}</text>
        )}
        {hover !== null && <line x1={shown.cx} x2={shown.cx} y1={M.top} y2={M.top + ph} className="stroke-ink" strokeWidth={1} />}
        {points.length > 1 && (
          <polyline fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={coords.map((c) => `${c.cx},${c.cy}`).join(" ")} />
        )}
        {coords.map((c, i) => (
          <circle key={c.date} cx={c.cx} cy={c.cy} r={i === (hover ?? coords.length - 1) ? 6 : 4} className="fill-primary stroke-bg" strokeWidth={2} />
        ))}
        {/* Larger invisible targets so a point is easy to hover (and tap on touch screens). */}
        {coords.map((c, i) => (
          <circle
            key={`hit-${c.date}`}
            data-testid={`point-${c.date}`}
            cx={c.cx}
            cy={c.cy}
            r={14}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(i)}
          />
        ))}
        {hover !== null && <Tooltip point={shown} />}
      </svg>
      {/* The wrapper (not the table) is sr-only: table captions escape sr-only clipping and show on screen. */}
      <div className="sr-only">
        <table aria-label="Price history data">
          <thead><tr><th>Date</th><th>Price</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}><td>{formatDate(p.date)}</td><td>{formatPrice(p.price)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PriceHistoryModal({ account, onClose }: { account: InvestmentAccount; onClose: () => void }) {
  const { data: points, error, isLoading } = useInvestmentPriceHistory(account.id);
  return (
    <Modal title={`Price history · ${account.symbol}`} subtitle={account.name} onClose={onClose} wide>
      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p role="alert" className="text-expense-text">{error.message}</p>}
      {points?.length === 0 && <p className="text-muted">No price history yet. Use Update price to add one.</p>}
      {points && points.length > 0 && (
        <PriceChart points={points} avgCost={account.quantity > 0 ? account.avgCost : null} unit={account.unit} />
      )}
    </Modal>
  );
}

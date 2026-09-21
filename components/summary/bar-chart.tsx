'use client';

import { formatTZS } from '@/lib/money';
import type { DayPoint } from '@/lib/calc/summary';

/**
 * Sales-per-day bars as plain divs. A chart library would be the single
 * heaviest thing on this screen, for a picture that is just "which days were
 * good". Today is highlighted; every bar carries its value for screen readers.
 */
export function BarChart({ points, today }: { points: readonly DayPoint[]; today: string }) {
  const max = Math.max(1, ...points.map((p) => p.total));
  const dense = points.length > 10;

  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]" role="list">
        {points.map((point) => {
          const height = point.total > 0 ? Math.max(4, (point.total / max) * 100) : 0;
          return (
            <div
              key={point.day}
              role="listitem"
              aria-label={`${point.day}: ${formatTZS(point.total)}`}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div
                className={point.day === today ? 'rounded-t-[3px] bg-brand' : 'rounded-t-[3px] bg-brand/35'}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] border-t border-line pt-1">
        {points.map((point, index) => (
          <span key={point.day} className="tnum min-w-0 flex-1 text-center text-[10px] text-ink-faint">
            {!dense || index % 5 === 0 || index === points.length - 1 ? Number(point.day.slice(8)) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

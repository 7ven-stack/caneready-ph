import React, { useMemo, useState } from 'react';
import { getCanonicalStatusBucket } from '../utils/caneCalculations';

const STATUS_CATEGORIES = [
  {
    key: 'Harvest Due',
    label: 'Harvest Due (≤ 7D)',
    shortLabel: 'Due ≤7d',
    dotClass: 'bg-emerald-500',
    barClass: 'bg-emerald-500 hover:bg-emerald-600',
    accentBorder: 'border-emerald-500/80 dark:border-emerald-500',
    activeBg: 'bg-emerald-50/50 dark:bg-emerald-950/30',
    badgeClass:
      'bg-emerald-100/80 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
    numColor: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    key: 'Upcoming',
    label: 'Upcoming (8–30D)',
    shortLabel: 'Upcoming',
    dotClass: 'bg-amber-500',
    barClass: 'bg-amber-500 hover:bg-amber-600',
    accentBorder: 'border-amber-500/80 dark:border-amber-500',
    activeBg: 'bg-amber-50/50 dark:bg-amber-950/30',
    badgeClass:
      'bg-amber-100/80 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
    numColor: 'text-amber-700 dark:text-amber-400',
  },
  {
    key: 'Planned Later',
    label: 'Planned Later (> 30D)',
    shortLabel: 'Planned Later',
    dotClass: 'bg-sky-500',
    barClass: 'bg-sky-500 hover:bg-sky-600',
    accentBorder: 'border-sky-500/80 dark:border-sky-500',
    activeBg: 'bg-sky-50/50 dark:bg-sky-950/30',
    badgeClass:
      'bg-sky-100/80 dark:bg-sky-950 text-sky-800 dark:text-sky-300',
    numColor: 'text-sky-700 dark:text-sky-400',
  },
  {
    key: 'No Date Set',
    label: 'No Date Set',
    shortLabel: 'Unscheduled',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
    barClass: 'bg-slate-400 dark:bg-slate-500 hover:bg-slate-500',
    accentBorder: 'border-slate-500 dark:border-slate-400',
    activeBg: 'bg-slate-100/70 dark:bg-slate-800/60',
    badgeClass:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    numColor: 'text-slate-800 dark:text-slate-200',
  },
];

export default function KpiStrip({
  lots = [],
  statusFilter = 'ALL',
  onSelectStatus,
  isLoading = false,
}) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const metrics = useMemo(() => {
    const totalLots = lots.length;
    const totalHa = Number(
      lots.reduce((sum, l) => sum + (Number(l.areaHa) || 0), 0).toFixed(2)
    );
    const totalTons = Math.round(
      lots.reduce((sum, l) => sum + (Number(l.estimatedTons) || 0), 0)
    );

    const byStatus = STATUS_CATEGORIES.map((cat) => {
      const matched = lots.filter(
        (l) => getCanonicalStatusBucket(l) === cat.key
      );
      const ha = Number(
        matched.reduce((sum, l) => sum + (Number(l.areaHa) || 0), 0).toFixed(2)
      );
      const tons = Math.round(
        matched.reduce((sum, l) => sum + (Number(l.estimatedTons) || 0), 0)
      );
      const pct = totalHa > 0 ? (ha / totalHa) * 100 : 0;

      return {
        ...cat,
        count: matched.length,
        ha,
        tons,
        pct,
      };
    });

    return {
      totalLots,
      totalHa,
      totalTons,
      byStatus,
    };
  }, [lots]);

  const hoveredSegment = useMemo(
    () => metrics.byStatus.find((s) => s.key === hoveredKey) || null,
    [metrics.byStatus, hoveredKey]
  );

  const handleCardClick = (key) => {
    if (!onSelectStatus) return;
    if (key === 'ALL') {
      onSelectStatus('ALL');
    } else {
      onSelectStatus(statusFilter === key ? 'ALL' : key);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3 shadow-2xs space-y-2.5 select-none">
      {/* Top 5 Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Card 1: ALL PLANTER LOTS */}
        {(() => {
          const isActive = statusFilter === 'ALL';
          return (
            <button
              type="button"
              onClick={() => handleCardClick('ALL')}
              className={
                'relative text-left rounded-xl p-3 border transition-all overflow-hidden flex flex-col justify-between cursor-pointer ' +
                (isActive
                  ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-emerald-500/70 shadow-xs'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800 text-slate-900 dark:text-white border-slate-200/80 dark:border-slate-700/80')
              }
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span
                  className={
                    'text-[10px] font-bold uppercase tracking-wider truncate ' +
                    (isActive
                      ? 'text-slate-300'
                      : 'text-slate-500 dark:text-slate-400')
                  }
                >
                  All Planter Lots
                </span>
                <span
                  className={
                    'text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ' +
                    (isActive
                      ? 'bg-white/15 text-white'
                      : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300')
                  }
                >
                  100%
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between gap-2 w-full tabular-nums">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold tracking-tight leading-none">
                    {isLoading ? '—' : metrics.totalLots}
                  </span>
                  <span
                    className={
                      'text-[11px] font-medium ' +
                      (isActive ? 'text-slate-300' : 'text-slate-400')
                    }
                  >
                    lots
                  </span>
                </div>

                <div className="text-right">
                  <div
                    className={
                      'text-xs font-bold leading-tight ' +
                      (isActive
                        ? 'text-emerald-300'
                        : 'text-slate-700 dark:text-slate-200')
                    }
                  >
                    {metrics.totalHa.toFixed(2)} ha
                  </div>
                  <div
                    className={
                      'text-[10px] leading-tight mt-0.5 ' +
                      (isActive ? 'text-slate-400' : 'text-slate-400')
                    }
                  >
                    ~{metrics.totalTons.toLocaleString()} MT
                  </div>
                </div>
              </div>
            </button>
          );
        })()}

        {/* Cards 2–5: Status Breakdown Cards */}
        {metrics.byStatus.map((stat) => {
          const isActive = statusFilter === stat.key;
          const isZero = stat.count === 0;

          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => handleCardClick(stat.key)}
              onMouseEnter={() => setHoveredKey(stat.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={
                'relative text-left rounded-xl p-3 border transition-all overflow-hidden flex flex-col justify-between cursor-pointer ' +
                (isActive
                  ? `${stat.activeBg} ${stat.accentBorder} ring-2 ring-emerald-500/15 shadow-2xs`
                  : isZero
                  ? 'bg-slate-50/40 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/70 opacity-60 hover:opacity-90'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-slate-200/80 dark:border-slate-800')
              }
            >
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={'w-2 h-2 rounded-full shrink-0 ' + stat.dotClass}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
                    {stat.label}
                  </span>
                </div>

                <span
                  className={
                    'text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded shrink-0 tabular-nums ' +
                    stat.badgeClass
                  }
                >
                  {stat.pct > 0 && stat.pct < 1
                    ? '<1%'
                    : `${Math.round(stat.pct)}%`}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between gap-2 w-full tabular-nums">
                <div className="flex items-baseline gap-1">
                  <span
                    className={
                      'text-2xl font-extrabold tracking-tight leading-none ' +
                      (isZero
                        ? 'text-slate-400 dark:text-slate-600'
                        : stat.numColor)
                    }
                  >
                    {isLoading ? '—' : stat.count}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {stat.count === 1 ? 'lot' : 'lots'}
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">
                    {stat.ha.toFixed(2)} ha
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                    ~{stat.tons.toLocaleString()} MT
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Hectarage Mix & Tonnage Distribution Bar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Total Field Hectarage Mix:
          </span>
          <div className="inline-flex items-center divide-x divide-slate-200 dark:divide-slate-700 rounded-md bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[11px] tabular-nums">
            <span className="px-2 py-0.5 font-bold text-slate-900 dark:text-white">
              {metrics.totalHa.toFixed(2)} ha
            </span>
            <span className="px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-300">
              {metrics.totalTons.toLocaleString()} MT
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-[200px] h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex p-0.5 gap-0.5 border border-slate-200/60 dark:border-slate-700/60">
          {metrics.byStatus.map((stat) => {
            if (stat.ha <= 0) return null;
            const isSelected = statusFilter === stat.key;
            return (
              <button
                key={stat.key}
                type="button"
                onClick={() => handleCardClick(stat.key)}
                onMouseEnter={() => setHoveredKey(stat.key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{ width: `${Math.max(stat.pct, 2)}%` }}
                title={`${stat.label}: ${stat.count} lot(s) • ${stat.ha.toFixed(2)} ha • ~${stat.tons.toLocaleString()} MT (${stat.pct.toFixed(1)}%)`}
                className={
                  'h-full first:rounded-l-full last:rounded-r-full transition-all cursor-pointer ' +
                  stat.barClass +
                  (isSelected ? ' ring-1 ring-offset-1 ring-slate-900' : '')
                }
              />
            );
          })}
        </div>

        <div className="shrink-0 min-w-[230px] flex items-center justify-end text-[11px] tabular-nums">
          {hoveredSegment ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-800 text-white font-medium animate-drawer-item">
              <span
                className={'w-2 h-2 rounded-full ' + hoveredSegment.dotClass}
              />
              <span className="font-bold">{hoveredSegment.shortLabel}:</span>
              <span>{hoveredSegment.count} lots</span>
              <span>•</span>
              <span className="text-emerald-300 font-bold">
                {hoveredSegment.ha.toFixed(2)} ha
              </span>
              <span>•</span>
              <span className="text-slate-300">
                ~{hoveredSegment.tons.toLocaleString()} MT
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              {metrics.byStatus.map((stat) => (
                <button
                  key={stat.key}
                  type="button"
                  onClick={() => handleCardClick(stat.key)}
                  onMouseEnter={() => setHoveredKey(stat.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <span
                    className={'w-2 h-2 rounded-full ' + stat.dotClass}
                  />
                  <span className="font-medium">{stat.shortLabel}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    ({Math.round(stat.pct)}%)
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

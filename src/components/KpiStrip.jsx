import React, { useState } from 'react';
import { CalendarCheck2, Clock, CalendarDays, HelpCircle, Layers } from 'lucide-react';

export default function KpiStrip({
  lots = [],
  statusFilter = 'ALL',
  onSelectStatus,
  isLoading = false,
}) {
  const [mixMetric, setMixMetric] = useState('ha');

  const sumHa = (arr) =>
    Number(arr.reduce((sum, l) => sum + (Number(l.areaHa) || 0), 0).toFixed(2));
  const sumTons = (arr) =>
    Math.round(arr.reduce((sum, l) => sum + (Number(l.estimatedTons) || 0), 0));

  const totalHa = sumHa(lots);
  const totalTons = sumTons(lots);

  const dueLots = lots.filter((l) => l.status === 'Harvest Due');
  const upcomingLots = lots.filter((l) => l.status === 'Upcoming (30d)');
  const laterLots = lots.filter((l) => l.status === 'Planned Later');
  const unscheduledLots = lots.filter((l) => l.status === 'No Date Set');

  const metricPct = (arr) => {
    if (mixMetric === 'tons') {
      return totalTons > 0
        ? Number(((sumTons(arr) / totalTons) * 100).toFixed(1))
        : 0;
    }
    return totalHa > 0 ? Number(((sumHa(arr) / totalHa) * 100).toFixed(1)) : 0;
  };

  const formatTooltip = (label, arr) => {
    const ha = sumHa(arr);
    const mt = sumTons(arr);
    const pct = metricPct(arr);
    return `${label}: ${arr.length} lot${arr.length === 1 ? '' : 's'} • ${ha} ha • ${mt.toLocaleString()} MT (${pct}%)`;
  };

  const chips = [
    {
      id: 'ALL',
      label: 'All Planter Lots',
      count: lots.length,
      ha: totalHa,
      mt: totalTons,
      icon: Layers,
      activeClass: 'border-slate-900 bg-slate-900 text-white shadow-xs',
      idleClass: 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100',
      iconClass: 'text-slate-600',
    },
    {
      id: 'Harvest Due',
      label: 'Harvest Due (≤ 7d)',
      count: dueLots.length,
      ha: sumHa(dueLots),
      mt: sumTons(dueLots),
      icon: CalendarCheck2,
      activeClass: 'border-emerald-700 bg-emerald-700 text-white shadow-xs',
      idleClass:
        dueLots.length > 0
          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/70'
          : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65',
      iconClass: dueLots.length > 0 ? 'text-emerald-600' : 'text-slate-400',
    },
    {
      id: 'Upcoming (30d)',
      label: 'Upcoming (8–30d)',
      count: upcomingLots.length,
      ha: sumHa(upcomingLots),
      mt: sumTons(upcomingLots),
      icon: Clock,
      activeClass: 'border-amber-600 bg-amber-600 text-white shadow-xs',
      idleClass:
        upcomingLots.length > 0
          ? 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70'
          : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65',
      iconClass: upcomingLots.length > 0 ? 'text-amber-600' : 'text-slate-400',
    },
    {
      id: 'Planned Later',
      label: 'Planned Later (> 30d)',
      count: laterLots.length,
      ha: sumHa(laterLots),
      mt: sumTons(laterLots),
      icon: CalendarDays,
      activeClass: 'border-sky-700 bg-sky-700 text-white shadow-xs',
      idleClass:
        laterLots.length > 0
          ? 'border-sky-200 bg-sky-50/70 text-sky-900 hover:bg-sky-100/70'
          : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65',
      iconClass: laterLots.length > 0 ? 'text-sky-600' : 'text-slate-400',
    },
    {
      id: 'No Date Set',
      label: 'No Date Set',
      count: unscheduledLots.length,
      ha: sumHa(unscheduledLots),
      mt: sumTons(unscheduledLots),
      icon: HelpCircle,
      activeClass: 'border-slate-800 bg-slate-800 text-white shadow-xs',
      idleClass:
        unscheduledLots.length > 0
          ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65',
      iconClass: 'text-slate-400',
    },
  ];

  const segments = [
    { id: 'Harvest Due', label: 'Harvest Due', arr: dueLots, color: 'bg-emerald-500' },
    { id: 'Upcoming (30d)', label: 'Upcoming (8–30d)', arr: upcomingLots, color: 'bg-amber-400' },
    { id: 'Planned Later', label: 'Planned Later', arr: laterLots, color: 'bg-sky-500' },
    { id: 'No Date Set', label: 'No Date Set', arr: unscheduledLots, color: 'bg-slate-400' },
  ];

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 shadow-2xs space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {chips.map((chip) => {
          const Icon = chip.icon;
          const isActive = statusFilter === chip.id;
          const isZero = chip.count === 0 && chip.id !== 'ALL';

          return (
            <button
              key={chip.id}
              type="button"
              onClick={() =>
                onSelectStatus(isActive && chip.id !== 'ALL' ? 'ALL' : chip.id)
              }
              title={formatTooltip(
                chip.label,
                chip.id === 'ALL'
                  ? lots
                  : lots.filter((l) => l.status === chip.id)
              )}
              className={
                'relative text-left rounded-lg px-3 py-2.5 border transition-all flex flex-col justify-between overflow-hidden ' +
                (isActive ? chip.activeClass : chip.idleClass)
              }
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider truncate">
                  {chip.label}
                </span>
                <Icon
                  className={
                    'w-3.5 h-3.5 shrink-0 ' + (isActive ? 'text-white' : chip.iconClass)
                  }
                />
              </div>

              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span
                  className={
                    'text-xl font-black tracking-tight ' +
                    (isZero && !isActive ? 'text-slate-400 font-semibold' : '')
                  }
                >
                  {isLoading && lots.length === 0 ? '—' : chip.count}
                </span>
                <span
                  className={
                    'text-[11px] font-medium truncate ' +
                    (isActive ? 'text-white/85' : 'text-slate-500')
                  }
                >
                  {mixMetric === 'ha'
                    ? `${chip.ha} ha`
                    : `${chip.mt.toLocaleString()} MT`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hectare / Tonnage Proportional Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            Total Field Hectarage Mix:
          </span>
          <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setMixMetric('ha')}
              className={
                'px-2 py-0.5 rounded font-semibold transition-all ' +
                (mixMetric === 'ha'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400')
              }
            >
              {totalHa} ha
            </button>
            <button
              type="button"
              onClick={() => setMixMetric('tons')}
              className={
                'px-2 py-0.5 rounded font-semibold transition-all ' +
                (mixMetric === 'tons'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400')
              }
            >
              {totalTons.toLocaleString()} MT
            </button>
          </div>
        </div>

        <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
          {lots.length === 0 ? (
            <div className="w-full h-full bg-slate-200 dark:bg-slate-800" />
          ) : (
            segments.map((seg) => {
              const widthPct = metricPct(seg.arr);
              if (widthPct <= 0) return null;
              return (
                <div
                  key={seg.id}
                  style={{ width: widthPct + '%' }}
                  title={formatTooltip(seg.label, seg.arr)}
                  onClick={() =>
                    onSelectStatus(statusFilter === seg.id ? 'ALL' : seg.id)
                  }
                  className={
                    seg.color +
                    ' h-full transition-all duration-300 cursor-pointer hover:opacity-90'
                  }
                />
              );
            })
          )}
        </div>

        <span className="text-[11px] text-slate-500 shrink-0 hidden md:inline">
          Hover bar for lots • ha • MT
        </span>
      </div>
    </section>
  );
}

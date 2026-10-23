import React, { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Layers, CircleDot } from 'lucide-react';

export default function KpiStrip({
  lots = [],
  statusFilter = 'ALL',
  onSelectStatus,
  isLoading = false,
  error = null,
}) {
  const [mixMetric, setMixMetric] = useState('ha');

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-semibold">
        Unable to compute district KPI summary: {error}
      </div>
    );
  }

  const sumHa = (arr) =>
    Number(arr.reduce((sum, l) => sum + (Number(l.areaHa) || 0), 0).toFixed(2));
  const sumTons = (arr) =>
    Math.round(arr.reduce((sum, l) => sum + (Number(l.estimatedTons) || 0), 0));

  const totalHa = sumHa(lots);
  const totalTons = sumTons(lots);

  const okLots = lots.filter((l) => l.status === 'OK to Harvest');
  const approachingLots = lots.filter((l) => l.status === 'Approaching');
  const riskLots = lots.filter((l) => l.status === 'Over-mature Risk');
  const immatureLots = lots.filter((l) => l.status === 'Immature');

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

  // 2a. Zero counts are muted; red appears ONLY when Over-mature count > 0
  const hasUrgent = riskLots.length > 0;

  const chips = [
    {
      id: 'ALL',
      label: 'All Lots',
      count: lots.length,
      ha: totalHa,
      mt: totalTons,
      icon: Layers,
      barColor: 'bg-slate-700',
      activeClass: 'border-slate-900 bg-slate-900 text-white shadow-xs',
      idleClass: 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100',
      iconClass: 'text-slate-600',
    },
    {
      id: 'OK to Harvest',
      label: 'OK to Harvest',
      count: okLots.length,
      ha: sumHa(okLots),
      mt: sumTons(okLots),
      icon: CheckCircle2,
      barColor: 'bg-emerald-500',
      activeClass: 'border-emerald-700 bg-emerald-700 text-white shadow-xs',
      idleClass:
        okLots.length > 0
          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/70'
          : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65',
      iconClass: okLots.length > 0 ? 'text-emerald-600' : 'text-slate-400',
    },
    {
      id: 'Approaching',
      label: 'Approaching',
      count: approachingLots.length,
      ha: sumHa(approachingLots),
      mt: sumTons(approachingLots),
      icon: Clock,
      barColor: 'bg-amber-400',
      activeClass: 'border-amber-600 bg-amber-600 text-white shadow-xs',
      idleClass:
        approachingLots.length > 0
          ? 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70'
          : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65',
      iconClass: approachingLots.length > 0 ? 'text-amber-600' : 'text-slate-400',
    },
    {
      id: 'Over-mature Risk',
      label: 'Over-mature',
      count: riskLots.length,
      ha: sumHa(riskLots),
      mt: sumTons(riskLots),
      icon: AlertTriangle,
      barColor: hasUrgent ? 'bg-rose-500' : 'bg-slate-300',
      activeClass: hasUrgent
        ? 'border-rose-700 bg-rose-700 text-white shadow-xs'
        : 'border-slate-700 bg-slate-700 text-white',
      idleClass: hasUrgent
        ? 'border-rose-200 bg-rose-50/80 text-rose-900 hover:bg-rose-100/70'
        : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65',
      iconClass: hasUrgent ? 'text-rose-600' : 'text-slate-400',
    },
    {
      id: 'Immature',
      label: 'Immature / Unsampled',
      count: immatureLots.length,
      ha: sumHa(immatureLots),
      mt: sumTons(immatureLots),
      icon: CircleDot,
      barColor: 'bg-slate-400',
      activeClass: 'border-slate-800 bg-slate-800 text-white shadow-xs',
      idleClass:
        immatureLots.length > 0
          ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65',
      iconClass: 'text-slate-400',
    },
  ];

  const segments = [
    { id: 'OK to Harvest', label: 'OK to Harvest', arr: okLots, color: 'bg-emerald-500' },
    { id: 'Approaching', label: 'Approaching', arr: approachingLots, color: 'bg-amber-400' },
    ...(hasUrgent
      ? [{ id: 'Over-mature Risk', label: 'Over-mature Risk', arr: riskLots, color: 'bg-rose-500' }]
      : []),
    { id: 'Immature', label: 'Immature / Unsampled', arr: immatureLots, color: 'bg-slate-400' },
  ];

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 shadow-2xs space-y-3">
      {/* Compact Interactive KPI & Filter Chip Strip */}
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
              title={formatTooltip(chip.label, chip.id === 'ALL' ? lots : lots.filter((l) => l.status === chip.id))}
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

      {/* Integrated Hectare / Tonnage Proportional Mix Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            Readiness Mix:
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

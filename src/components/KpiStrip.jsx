import React, { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Layers } from 'lucide-react';

export default function KpiStrip({ lots, statusFilter, onSelectStatus }) {
  const [mixMetric, setMixMetric] = useState('ha'); // 'ha' | 'tons'

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

  const okHa = sumHa(okLots);
  const okTons = sumTons(okLots);

  const countPct = (arr) =>
    lots.length > 0 ? Math.round((arr.length / lots.length) * 100) : 0;

  const metricPct = (arr) => {
    if (mixMetric === 'tons') {
      return totalTons > 0
        ? Number(((sumTons(arr) / totalTons) * 100).toFixed(1))
        : 0;
    }
    return totalHa > 0 ? Number(((sumHa(arr) / totalHa) * 100).toFixed(1)) : 0;
  };

  const formatSegmentTooltip = (label, arr) => {
    const ha = sumHa(arr);
    const mt = sumTons(arr);
    const pct = metricPct(arr);
    return `${label}: ${arr.length} lot${arr.length === 1 ? '' : 's'} • ${ha} ha • ${mt.toLocaleString()} MT (${pct}%)`;
  };

  const cards = [
    {
      id: 'ALL',
      title: 'Monitored Lots',
      value: lots.length,
      unit: 'Total Lots',
      sub: `${totalHa} ha • ${totalTons.toLocaleString()} MT`,
      pctLabel: '100%',
      icon: Layers,
      accent: 'text-slate-700 bg-slate-100',
      activeBorder: 'border-slate-900 ring-2 ring-slate-900/10 bg-white',
      topBar: 'bg-slate-800',
    },
    {
      id: 'OK to Harvest',
      title: 'OK to Harvest',
      value: okLots.length,
      unit: 'Ready',
      sub: `${okHa} ha • ${okTons.toLocaleString()} MT`,
      pctLabel: `${countPct(okLots)}%`,
      icon: CheckCircle2,
      accent: 'text-emerald-700 bg-emerald-50',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-600/15 bg-emerald-50/10',
      topBar: 'bg-emerald-600',
    },
    {
      id: 'Approaching',
      title: 'Approaching',
      value: approachingLots.length,
      unit: 'Near Maturity',
      sub: `${sumHa(approachingLots)} ha • ${sumTons(approachingLots).toLocaleString()} MT`,
      pctLabel: `${countPct(approachingLots)}%`,
      icon: Clock,
      accent: 'text-amber-700 bg-amber-50',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/10',
      topBar: 'bg-amber-500',
    },
    {
      id: 'Over-mature Risk',
      title: 'Over-Mature Risk',
      value: riskLots.length,
      unit: 'Urgent Cut',
      sub: `${sumHa(riskLots)} ha • ${sumTons(riskLots).toLocaleString()} MT`,
      pctLabel: `${countPct(riskLots)}%`,
      icon: AlertTriangle,
      accent: 'text-rose-700 bg-rose-50',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/15 bg-rose-50/10',
      topBar: 'bg-rose-600',
    },
  ];

  const segments = [
    {
      id: 'OK to Harvest',
      label: 'Ready',
      arr: okLots,
      color: 'bg-emerald-500',
      dot: 'bg-emerald-500',
    },
    {
      id: 'Approaching',
      label: 'Approaching',
      arr: approachingLots,
      color: 'bg-amber-400',
      dot: 'bg-amber-400',
    },
    {
      id: 'Over-mature Risk',
      label: 'Urgent',
      arr: riskLots,
      color: 'bg-rose-500',
      dot: 'bg-rose-500',
    },
    {
      id: 'Immature',
      label: 'Immature / Unsampled',
      arr: immatureLots,
      color: 'bg-slate-400',
      dot: 'bg-slate-400',
    },
  ];

  return (
    <section className="space-y-2.5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isActive = statusFilter === card.id;

          return (
            <button
              key={card.id}
              onClick={() =>
                onSelectStatus(isActive && card.id !== 'ALL' ? 'ALL' : card.id)
              }
              className={
                'group relative text-left rounded-xl p-3.5 border transition-all overflow-hidden ' +
                (isActive
                  ? card.activeBorder + ' shadow-xs'
                  : 'bg-white border-slate-200/90 hover:border-slate-300')
              }
            >
              <div className={'absolute top-0 left-0 right-0 h-1 ' + card.topBar} />

              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                  {card.title}
                </span>
                <span className={'p-1.5 rounded-lg shrink-0 ' + card.accent}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  {card.value}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {card.unit}
                </span>
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="truncate">{card.sub}</span>
                <span className="font-semibold text-slate-600 shrink-0">
                  {card.pctLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 1d. District Readiness Mix Bar sized by Hectares or Est. Tonnage with rich tooltips */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-4 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-700">District Readiness Mix:</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-[11px]">
            <button
              type="button"
              onClick={() => setMixMetric('ha')}
              className={
                'px-2 py-0.5 rounded-md font-semibold transition-all ' +
                (mixMetric === 'ha'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900')
              }
            >
              By Hectares ({totalHa} ha)
            </button>
            <button
              type="button"
              onClick={() => setMixMetric('tons')}
              className={
                'px-2 py-0.5 rounded-md font-semibold transition-all ' +
                (mixMetric === 'tons'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900')
              }
            >
              By Est. Tonnage ({totalTons.toLocaleString()} MT)
            </button>
          </div>
        </div>

        <div className="flex-1 max-w-md w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
          {segments.map((seg) => {
            const widthPct = metricPct(seg.arr);
            if (widthPct <= 0) return null;
            return (
              <div
                key={seg.id}
                style={{ width: widthPct + '%' }}
                title={formatSegmentTooltip(seg.label, seg.arr)}
                className={seg.color + ' h-full transition-all duration-300 cursor-help'}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-medium">
          {segments.map((seg) => (
            <span
              key={seg.id}
              title={formatSegmentTooltip(seg.label, seg.arr)}
              className="inline-flex items-center gap-1 cursor-help"
            >
              <span className={'w-2 h-2 rounded-full ' + seg.dot} />
              <span>
                {seg.label}:{' '}
                <strong className="text-slate-800">
                  {mixMetric === 'ha'
                    ? `${sumHa(seg.arr)} ha`
                    : `${sumTons(seg.arr).toLocaleString()} MT`}
                </strong>{' '}
                ({seg.arr.length})
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

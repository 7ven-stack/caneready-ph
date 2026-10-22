import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Layers } from 'lucide-react';

export default function KpiStrip({ lots, statusFilter, onSelectStatus }) {
  const totalHa = lots.reduce((sum, l) => sum + Number(l.areaHa), 0).toFixed(1);
  const totalTons = lots.reduce((sum, l) => sum + l.estimatedTons, 0);
  const okLots = lots.filter((l) => l.status === 'OK to Harvest');
  const okTons = okLots.reduce((sum, l) => sum + l.estimatedTons, 0);
  const okHa = okLots.reduce((sum, l) => sum + Number(l.areaHa), 0).toFixed(1);
  const approachingLots = lots.filter((l) => l.status === 'Approaching');
  const riskLots = lots.filter((l) => l.status === 'Over-mature Risk');
  const immatureLots = lots.filter((l) => l.status === 'Immature');

  const countPct = (arr) => (lots.length > 0 ? Math.round((arr.length / lots.length) * 100) : 0);

  const cards = [
    {
      id: 'ALL',
      title: 'Monitored Lots',
      value: lots.length,
      unit: 'Total Lots',
      sub: totalHa + ' ha • ' + totalTons.toLocaleString() + ' MT Est.',
      badge: '100% Estate',
      icon: Layers,
      accent: 'text-slate-700 bg-slate-100 border-slate-200',
      activeBorder: 'border-slate-900 ring-2 ring-slate-900/10 bg-white',
      topBar: 'bg-slate-800',
    },
    {
      id: 'OK to Harvest',
      title: 'OK to Harvest',
      value: okLots.length,
      unit: 'Lots Ready',
      sub: okHa + ' ha • ' + okTons.toLocaleString() + ' MT Ready',
      badge: countPct(okLots) + '% of Lots',
      icon: CheckCircle2,
      accent: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-600/15 bg-emerald-50/20',
      topBar: 'bg-emerald-600',
    },
    {
      id: 'Approaching',
      title: 'Approaching',
      value: approachingLots.length,
      unit: 'Near Maturity',
      sub: 'Re-test Brix in 7–10 days',
      badge: countPct(approachingLots) + '% of Lots',
      icon: Clock,
      accent: 'text-amber-700 bg-amber-50 border-amber-200',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/20',
      topBar: 'bg-amber-500',
    },
    {
      id: 'Over-mature Risk',
      title: 'Over-Mature Risk',
      value: riskLots.length,
      unit: 'Urgent Cut',
      sub: 'Inversion risk (Ratio > 1.08)',
      badge: countPct(riskLots) + '% Urgent',
      icon: AlertTriangle,
      accent: 'text-rose-700 bg-rose-50 border-rose-200',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/15 bg-rose-50/20',
      topBar: 'bg-rose-600',
    },
  ];

  return (
    <section className="space-y-3">
      {/* Responsive 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                'group relative text-left rounded-xl p-3.5 sm:p-4 border transition-all overflow-hidden ' +
                (isActive
                  ? card.activeBorder + ' shadow-sm'
                  : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs')
              }
            >
              <div className={'absolute top-0 left-0 right-0 h-1 ' + card.topBar} />

              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
                  {card.title}
                </span>
                <span className={'p-1.5 sm:p-2 rounded-lg border shrink-0 ' + card.accent}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {card.value}
                </span>
                <span className="text-xs font-semibold text-slate-500 truncate">
                  {card.unit}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                <p className="text-[11px] text-slate-500 truncate">{card.sub}</p>
                <span className="hidden sm:inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                  {card.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* District Proportional Maturity Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-700">District Harvest Readiness Mix:</span>
          <span className="text-slate-500">{totalHa} Total Hectares</span>
        </div>

        <div className="flex-1 max-w-md w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
          <div
            style={{ width: countPct(okLots) + '%' }}
            className="bg-emerald-500 h-full transition-all"
            title={'OK to Harvest: ' + okLots.length}
          />
          <div
            style={{ width: countPct(approachingLots) + '%' }}
            className="bg-amber-400 h-full transition-all"
            title={'Approaching: ' + approachingLots.length}
          />
          <div
            style={{ width: countPct(riskLots) + '%' }}
            className="bg-rose-500 h-full transition-all"
            title={'Over-mature Risk: ' + riskLots.length}
          />
          <div
            style={{ width: countPct(immatureLots) + '%' }}
            className="bg-slate-400 h-full transition-all"
            title={'Immature: ' + immatureLots.length}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Ready ({okLots.length})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Approaching ({approachingLots.length})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Urgent ({riskLots.length})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Immature ({immatureLots.length})
          </span>
        </div>
      </div>
    </section>
  );
}

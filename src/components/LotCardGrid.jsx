import React from 'react';
import {
  MapPin,
  User,
  Calendar,
  Truck,
  Sprout,
  Scale,
  Layers,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Clock,
} from 'lucide-react';
import { getStatusStyles } from '../utils/caneCalculations';

export default function LotCardGrid({
  lots = [],
  onSelectLot,
  onQuickLogBrix,
  onQuickScheduleCut,
}) {
  if (lots.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-base font-bold text-slate-700 dark:text-slate-200">
          No sugarcane lots match your current filter criteria.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Try clearing your search query or switching back to "All Lots".
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {lots.map((lot) => {
        const styles = getStatusStyles(lot.status);

        return (
          <div
            key={lot.id}
            onClick={() => onSelectLot(lot)}
            className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-600/60 dark:hover:border-emerald-500/60 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className={'h-1.5 w-full ' + styles.bar} />

            <div className="p-4 sm:p-5">
              {/* Top Tier: Lot ID + Crop Class + Status Badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      {lot.id}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {lot.cropClass}
                    </span>
                    {lot.pendingSync && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        Pending sync
                      </span>
                    )}
                    {lot.isUnverifiedDefault && (
                      <span
                        title="Flagged: 20.0 / 20.5° matches legacy form default. Re-sample to verify."
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300"
                      >
                        <AlertCircle className="w-3 h-3" />
                        Unverified
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {lot.hacienda}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Planter:{' '}
                      <strong className="text-slate-800 dark:text-slate-100">
                        {lot.planter}
                      </strong>
                    </span>
                  </div>
                </div>

                <span
                  className={
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ' +
                    styles.badge
                  }
                >
                  <span className={'w-1.5 h-1.5 rounded-full ' + styles.dot} />
                  {lot.statusDisplay || lot.status}
                </span>
              </div>

              {/* 1e. Separate Sector, Area, Variety, and Est. Tons */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Sector
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                    {lot.sector}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Area
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {lot.areaHa} ha
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                    <Sprout className="w-3 h-3" />
                    Variety
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                    {lot.variety}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                    <Scale className="w-3 h-3" />
                    Est. Tons
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {lot.estimatedTons.toLocaleString()} MT
                  </div>
                </div>
              </div>

              {/* Middle Tier: 3 Key Agronomic Metrics */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Avg Brix
                  </div>
                  {lot.hasBrixSample ? (
                    <>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {lot.avgBrix}°
                      </div>
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        T:{lot.topBrix}° / B:{lot.bottomBrix}°
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-1">
                        No sample yet
                      </div>
                      <div className="text-[10px] text-slate-400">Needs 1st sample</div>
                    </>
                  )}
                </div>

                <div className="border-x border-slate-200 dark:border-slate-700 px-1">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    T/B Ratio
                  </div>
                  {lot.hasBrixSample ? (
                    <>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {lot.maturityRatio}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Opt: 0.94–1.05
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-slate-400 mt-1">—</div>
                      <div className="text-[10px] text-slate-400">Opt: 0.94–1.05</div>
                    </>
                  )}
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Crop Age
                  </div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {lot.cropAgeMonths}m
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    {lot.hasBrixSample ? `${lot.estimatedLkgTc} LKg/TC` : 'No yield est.'}
                  </div>
                </div>
              </div>

              {/* 2c. "Why this status?" Gate Checklist */}
              {Array.isArray(lot.gateChecklist) && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1 text-[11px]">
                  <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Why this status?</span>
                    <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                      <Clock className="w-3 h-3" />
                      Est. Ready: <strong className="text-slate-800 dark:text-slate-200">{lot.estimatedReady?.label}</strong>
                    </span>
                  </div>
                  {lot.gateChecklist.map((g) => (
                    <div key={g.key} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      {g.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      <span className="truncate">{g.summary}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 2c. Readiness index + breakdown */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Readiness index
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {lot.hasBrixSample ? `${lot.readinessScore}%` : 'No sample yet'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  {lot.hasBrixSample && (
                    <div
                      className={'h-full rounded-full transition-all duration-300 ' + styles.bar}
                      style={{ width: lot.readinessScore + '%' }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 2g. Bottom Footer with One-Tap Log Brix & Schedule cut */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={
                'px-4 py-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ' +
                (lot.dispatch
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                  : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800')
              }
            >
              <div className="truncate">
                {lot.dispatch ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" />
                    Cut: {lot.dispatch.scheduledDate}
                  </span>
                ) : lot.hasBrixSample && lot.lastSampled ? (
                  <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Sampled: {lot.lastSampled}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    No sample yet
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onQuickLogBrix && onQuickLogBrix(lot)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 text-slate-800 dark:text-slate-200 font-bold text-[11px]"
                >
                  <FlaskConical className="w-3 h-3 text-emerald-700" />
                  <span>Log Brix</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickScheduleCut && onQuickScheduleCut(lot)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px]"
                >
                  <Truck className="w-3 h-3" />
                  <span>Schedule cut</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

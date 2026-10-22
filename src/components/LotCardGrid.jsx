import React from 'react';
import { MapPin, User, Calendar, Truck, ChevronRight, Sprout } from 'lucide-react';
import { getStatusStyles } from '../utils/caneCalculations';

export default function LotCardGrid({ lots, onSelectLot }) {
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
        const isReady = lot.status === 'OK to Harvest';

        return (
          <div
            key={lot.id}
            onClick={() => onSelectLot(lot)}
            className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-600/60 dark:hover:border-emerald-500/60 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Status Top Accent Bar */}
            <div className={'h-1.5 w-full ' + styles.bar} />

            <div className="p-4 sm:p-5">
              {/* Top Tier: Lot ID + Crop Class + Status Badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      {lot.id}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {lot.cropClass}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {lot.hacienda}
                  </h3>
                </div>

                <span
                  className={
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ' +
                    styles.badge
                  }
                >
                  <span className={'w-1.5 h-1.5 rounded-full ' + styles.dot} />
                  {lot.status}
                </span>
              </div>

              {/* Planter & Sector Metadata */}
              <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 dark:text-slate-400 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Planter:
                  </span>
                  <strong className="text-slate-800 dark:text-slate-100 truncate">{lot.planter}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Location:
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {lot.sector} • <strong>{lot.areaHa} ha</strong>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Sprout className="w-3.5 h-3.5 text-slate-400" />
                    Variety:
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {lot.variety} ({lot.estimatedTons.toLocaleString()} MT)
                  </span>
                </div>
              </div>

              {/* Middle Tier: 3 Key Agronomic Metrics (Fixed Dark Mode Contrast) */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Avg Brix
                  </div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {lot.avgBrix}°
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    T:{lot.topBrix}° / B:{lot.bottomBrix}°
                  </div>
                </div>
                <div className="border-x border-slate-200 dark:border-slate-700 px-1">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    T/B Ratio
                  </div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {lot.maturityRatio}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Opt: 0.95–1.02
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Crop Age
                  </div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {lot.cropAgeMonths}m
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    {lot.estimatedLkgTc} LKg/TC
                  </div>
                </div>
              </div>

              {/* Readiness Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Harvest Readiness Index
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {lot.readinessScore}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={'h-full rounded-full transition-all duration-300 ' + styles.bar}
                    style={{ width: lot.readinessScore + '%' }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Footer */}
            <div
              className={
                'px-4 sm:px-5 py-3 border-t flex items-center justify-between text-xs transition-colors ' +
                (lot.dispatch
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                  : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800')
              }
            >
              {lot.dispatch ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Scheduled: {lot.dispatch.scheduledDate}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Sampled: {lot.lastSampled}
                </span>
              )}

              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                {isReady && !lot.dispatch ? 'Schedule Cut' : 'Inspect Lot'}
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

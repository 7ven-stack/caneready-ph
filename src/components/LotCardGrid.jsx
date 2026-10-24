import React from 'react';
import {
  MapPin,
  Phone,
  Building2,
  Calendar,
  Layers,
  Compass,
  Pencil,
} from 'lucide-react';
import { getStatusStyles } from '../utils/caneCalculations';

export default function LotCardGrid({
  lots = [],
  onSelectLot,
  onQuickScheduleCut,
  onEditLot,
}) {
  if (lots.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-base font-bold text-slate-700 dark:text-slate-200">
          No planter lots match your current filter criteria.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Try clearing your search query or resetting filters.
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

            <div className="p-4 sm:p-5 space-y-3">
              {/* Top Tier: Lot ID + Association Pill + Status Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      {lot.id}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Building2 className="w-3 h-3" />
                      {lot.association}
                    </span>
                    {lot.pendingSync && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        Pending sync
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {lot.planter}
                  </h3>

                  {/* Contact Number */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{lot.contactNumber || 'No contact number'}</span>
                  </div>
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

              {/* Location Box: Hacienda, Brgy., City */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Hacienda:
                  </span>
                  <strong className="text-slate-900 dark:text-white truncate">
                    {lot.hacienda}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Brgy. & City:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {lot.barangay}, {lot.city}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <Compass className="w-3 h-3 text-rose-500" />
                    Lat / Long:
                  </span>
                  <span className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
                    {lot.coordText}
                  </span>
                </div>
              </div>

              {/* Primary Highlight Box: Hectarage & Planned Date of Harvest */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-600" />
                    Hectarage
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    {lot.areaHa} ha
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    ~{lot.estimatedTons.toLocaleString()} MT Est.
                  </div>
                </div>

                <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    Planned Harvest
                  </div>
                  {lot.plannedHarvestDate ? (
                    <>
                      <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                        {lot.plannedHarvestDate}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {lot.harvestTimelineLabel}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-1">
                        No date set
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Click below to schedule
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs"
            >
              <button
                type="button"
                onClick={() => onEditLot && onEditLot(lot)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-[11px]"
              >
                <Pencil className="w-3 h-3 text-emerald-700" />
                <span>Edit Planter Info</span>
              </button>

              <button
                type="button"
                onClick={() => onQuickScheduleCut && onQuickScheduleCut(lot)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shadow-2xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {lot.plannedHarvestDate ? 'Change Harvest Date' : 'Set Harvest Date'}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Sprout,
  Plus,
  RefreshCw,
  Database,
  Download,
  Sun,
  Moon,
  Table,
  Map,
  Bell,
  Calendar,
  HelpCircle,
  Clock,
  Eye,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function Navbar({
  onOpenNewLotModal,
  dataSource,
  isOnline,
  onRefresh,
  onExportCsv,
  darkMode,
  onToggleDarkMode,
  viewMode = 'table',
  onViewModeChange,
  lots = [],
  onQuickScheduleCut,
  onSelectLot,
}) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Build notification items (Harvest Due <= 7d & Unscheduled Planter Lots)
  const attentionItems = useMemo(() => {
    const items = [];
    for (const lot of lots) {
      if (lot.status === 'Harvest Due') {
        items.push({
          priority: 1,
          key: `${lot.id}-due`,
          lot,
          badge: lot.harvestTimelineLabel,
          badgeTone:
            'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          icon: Calendar,
          reason: `Planned Harvest: ${lot.plannedHarvestDate} • ${lot.areaHa} ha`,
        });
      } else if (!lot.plannedHarvestDate) {
        items.push({
          priority: 2,
          key: `${lot.id}-unscheduled`,
          lot,
          badge: 'No Date Set',
          badgeTone:
            'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          icon: HelpCircle,
          reason: `${lot.hacienda}, ${lot.barangay} (${lot.areaHa} ha)`,
        });
      }
    }
    return items.sort((a, b) => a.priority - b.priority);
  }, [lots]);

  const dueCount = useMemo(
    () => attentionItems.filter((i) => i.priority === 1).length,
    [attentionItems]
  );
  const unscheduledCount = useMemo(
    () => attentionItems.filter((i) => i.priority === 2).length,
    [attentionItems]
  );

  // Close notification popover on outside click or Escape key
  useEffect(() => {
    if (!isNotifOpen) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotifOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors h-14 flex items-center">
      <div className="max-w-[1920px] w-full mx-auto px-3 sm:px-5 flex items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shadow-sm shrink-0">
            <Sprout className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                CaneReadyPH
              </h1>
              <span className="hidden xl:inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                CY 2026-2027
              </span>
              <button
                onClick={onRefresh}
                title="Click to re-sync database"
                className={
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ' +
                  (isOnline
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700')
                }
              >
                <span
                  className={
                    'w-1.5 h-1.5 rounded-full ' +
                    (isOnline ? 'bg-emerald-400' : 'bg-amber-500')
                  }
                />
                <Database className="w-3 h-3 hidden sm:inline" />
                <span className="truncate max-w-[140px] sm:max-w-none">{dataSource}</span>
                <RefreshCw className="w-2.5 h-2.5 opacity-70" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              Planter Harvest Schedule, Field Hectarage & GIS Coordinate Monitor
            </p>
          </div>
        </div>

        {/* Right Controls: Table/Map Switcher + Notification Bell + Theme + CSV + Register */}
        <div className="flex items-center gap-2 shrink-0">
          {onViewModeChange && (
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => onViewModeChange('table')}
                className={
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ' +
                  (viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
                }
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('map')}
                className={
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ' +
                  (viewMode === 'map'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
                }
              >
                <Map className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
            </div>
          )}

          {/* NOTIFICATION BELL & DROPDOWN */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              title="Planter Harvest Schedule Reminders"
              className={
                'relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all ' +
                (isNotifOpen
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200')
              }
            >
              <Bell className="w-4 h-4" />
              {attentionItems.length > 0 && (
                <span
                  className={
                    'absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold text-white shadow-xs ' +
                    (dueCount > 0 ? 'bg-rose-600' : 'bg-emerald-600')
                  }
                >
                  {attentionItems.length}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-[350px] sm:w-[400px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[1300] animate-drawer-item">
                <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />

                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                        Planter Harvest Schedule Reminders
                      </h3>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {attentionItems.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {dueCount > 0 ? `${dueCount} harvest due • ` : ''}
                      {unscheduledCount} unscheduled planter lot
                      {unscheduledCount === 1 ? '' : 's'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsNotifOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {attentionItems.length === 0 ? (
                  <div className="p-8 text-center space-y-1.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      All planter lots are scheduled!
                    </p>
                    <p className="text-[11px] text-slate-500">
                      No pending harvest schedule reminders right now.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {attentionItems.map((item) => {
                      const Icon = item.icon;
                      const lot = item.lot;
                      return (
                        <div
                          key={item.key}
                          className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-mono font-bold text-[11px] text-slate-900 dark:text-white">
                                {lot.id}
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {lot.planter}
                              </span>
                              <span
                                className={
                                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold border shrink-0 ' +
                                  item.badgeTone
                                }
                              >
                                {item.badge}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 pl-5">
                              {item.reason}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setIsNotifOpen(false);
                                if (onQuickScheduleCut) onQuickScheduleCut(lot);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px]"
                            >
                              <Clock className="w-3 h-3" />
                              <span>
                                {lot.plannedHarvestDate ? 'Change' : 'Set Date'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsNotifOpen(false);
                                if (onSelectLot) onSelectLot(lot);
                              }}
                              className="p-1.5 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              title="Inspect planter lot"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden md:inline">Dark</span>
              </>
            )}
          </button>

          <button
            onClick={onExportCsv}
            title="Export planter harvest schedule & coordinates to CSV"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenNewLotModal}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Register Planter Lot</span>
          </button>
        </div>
      </div>
    </header>
  );
}

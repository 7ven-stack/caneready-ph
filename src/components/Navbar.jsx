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
  const [notifTab, setNotifTab] = useState('ALL');
  const notifRef = useRef(null);

  // Build notification items (Harvest Due <= 7d & Unscheduled Planter Lots)
  const attentionItems = useMemo(() => {
    const items = [];
    for (const lot of lots) {
      if (lot.status === 'Harvest Due') {
        items.push({
          priority: 1,
          category: 'DUE',
          key: `${lot.id}-due`,
          lot,
          badge: lot.harvestTimelineLabel || 'Harvest Due',
          dotClass: 'bg-emerald-500',
          badgeTone:
            'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
          subtext: `${lot.hacienda}, ${lot.barangay} • ${Number(lot.areaHa).toFixed(2)} ha`,
          dateInfo: `Scheduled: ${lot.plannedHarvestDate}`,
        });
      } else if (!lot.plannedHarvestDate) {
        items.push({
          priority: 2,
          category: 'UNSCHEDULED',
          key: `${lot.id}-unscheduled`,
          lot,
          badge: 'No Date Set',
          dotClass: 'bg-amber-500',
          badgeTone:
            'bg-amber-50/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/90 dark:border-amber-800/80',
          subtext: `${lot.hacienda}, ${lot.barangay} • ${Number(lot.areaHa).toFixed(2)} ha`,
          dateInfo: null,
        });
      }
    }
    return items.sort((a, b) => a.priority - b.priority);
  }, [lots]);

  const dueCount = useMemo(
    () => attentionItems.filter((i) => i.category === 'DUE').length,
    [attentionItems]
  );
  const unscheduledCount = useMemo(
    () => attentionItems.filter((i) => i.category === 'UNSCHEDULED').length,
    [attentionItems]
  );

  const visibleNotifItems = useMemo(() => {
    if (notifTab === 'DUE') {
      return attentionItems.filter((i) => i.category === 'DUE');
    }
    if (notifTab === 'UNSCHEDULED') {
      return attentionItems.filter((i) => i.category === 'UNSCHEDULED');
    }
    return attentionItems;
  }, [attentionItems, notifTab]);

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
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors h-14 flex items-center select-none">
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
                <span className="truncate max-w-[140px] sm:max-w-none">
                  {dataSource}
                </span>
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

          {/* NOTIFICATION BELL & REFINED ENTERPRISE POPOVER */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              title="Planter Harvest Schedule Reminders"
              className={
                'relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all ' +
                (isNotifOpen
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/15'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200')
              }
            >
              <Bell className="w-4 h-4" />
              {attentionItems.length > 0 && (
                <span
                  className={
                    'absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold text-white shadow-xs tabular-nums ' +
                    (dueCount > 0 ? 'bg-rose-600' : 'bg-emerald-600')
                  }
                >
                  {attentionItems.length}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-[390px] sm:w-[430px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200/90 dark:border-slate-700 overflow-hidden z-[1300] animate-drawer-item">
                {/* Header & Segmented Filter Tabs */}
                <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-bold text-slate-900 dark:text-white tracking-tight">
                        Harvest Schedule Reminders
                      </h3>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 tabular-nums">
                        {attentionItems.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNotifOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Interactive Filter Pills */}
                  <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setNotifTab('ALL')}
                      className={
                        'py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ' +
                        (notifTab === 'ALL'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900')
                      }
                    >
                      <span>All</span>
                      <span className="font-mono text-[10px] opacity-75">
                        ({attentionItems.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('DUE')}
                      className={
                        'py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ' +
                        (notifTab === 'DUE'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900')
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Due ≤7d</span>
                      <span className="font-mono text-[10px] opacity-75">
                        ({dueCount})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('UNSCHEDULED')}
                      className={
                        'py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ' +
                        (notifTab === 'UNSCHEDULED'
                          ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900')
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>No Date</span>
                      <span className="font-mono text-[10px] opacity-75">
                        ({unscheduledCount})
                      </span>
                    </button>
                  </div>
                </div>

                {/* Notification List Body */}
                {visibleNotifItems.length === 0 ? (
                  <div className="p-8 text-center space-y-1.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      No reminders in this category
                    </p>
                    <p className="text-[11px] text-slate-500">
                      All matching planter lots are already scheduled.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                    {visibleNotifItems.map((item) => {
                      const lot = item.lot;
                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            setIsNotifOpen(false);
                            if (onSelectLot) onSelectLot(lot);
                          }}
                          className="group px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        >
                          {/* Left Content: Non-Wrapping Lot ID + Full Planter Name + Location */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={
                                  'w-2 h-2 rounded-full shrink-0 ' + item.dotClass
                                }
                              />
                              <span className="shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded font-mono font-semibold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                                {lot.id}
                              </span>
                              <span className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                {lot.planter}
                              </span>
                              <span
                                className={
                                  'shrink-0 whitespace-nowrap px-2 py-0.2 rounded-full text-[10px] font-semibold border ' +
                                  item.badgeTone
                                }
                              >
                                {item.badge}
                              </span>
                            </div>

                            <div className="pl-4 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                              <span className="truncate">{item.subtext}</span>
                              {item.dateInfo && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                                    {item.dateInfo}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Right Action: Single Clean Tactile Button */}
                          <div
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setIsNotifOpen(false);
                                if (onQuickScheduleCut) onQuickScheduleCut(lot);
                              }}
                              className={
                                'min-w-[78px] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ' +
                                (lot.plannedHarvestDate
                                  ? 'bg-white dark:bg-slate-800 hover:bg-emerald-50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-2xs')
                              }
                            >
                              {lot.plannedHarvestDate ? 'Reschedule' : 'Set Date'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Subtle Footer Hint */}
                <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-800/60 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                  <span>Click any row to inspect lot details</span>
                  <span className="font-mono tabular-nums">
                    {visibleNotifItems.length} shown
                  </span>
                </div>
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
        </div>
      </div>
    </header>
  );
}


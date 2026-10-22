import React from 'react';
import {
  Sprout,
  FlaskConical,
  Plus,
  RefreshCw,
  Database,
  Download,
  Sun,
  Moon,
} from 'lucide-react';

export default function Navbar({
  onOpenBrixModal,
  onOpenNewLotModal,
  dataSource,
  isOnline,
  onRefresh,
  onExportCsv,
  darkMode,
  onToggleDarkMode,
}) {
  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shadow-sm shrink-0">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                CaneReadyPH
              </h1>
              <span className="hidden md:inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                CY 2026-2027
              </span>
              {/* Integrated Connection Pill */}
              <button
                onClick={onRefresh}
                title="Click to re-sync database"
                className={
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ' +
                  (isOnline
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700')
                }
              >
                <span
                  className={
                    'w-1.5 h-1.5 rounded-full ' +
                    (isOnline ? 'bg-emerald-400' : 'bg-emerald-500')
                  }
                />
                <Database className="w-3 h-3 hidden sm:inline" />
                <span className="truncate max-w-[130px] sm:max-w-none">{dataSource}</span>
                <RefreshCw className="w-2.5 h-2.5 opacity-70" />
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Sugarcane Lot Maturity & Harvest Readiness Monitor
            </p>
          </div>
        </div>

        {/* Right Actions + Theme Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-600" />
                <span className="hidden md:inline">Dark</span>
              </>
            )}
          </button>

          <button
            onClick={onExportCsv}
            title="Export filtered lots to CSV"
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenBrixModal}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-2xs"
          >
            <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Log Brix Sample</span>
            <span className="sm:hidden">Brix</span>
          </button>

          <button
            onClick={onOpenNewLotModal}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] transition-all shadow-xs"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Register Lot</span>
            <span className="sm:hidden">New Lot</span>
          </button>
        </div>
      </div>
    </header>
  );
}

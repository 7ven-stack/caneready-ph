import fs from 'fs';
import path from 'path';

const files = {
  'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
}

/* Eliminate white sub-pixel grid lines between Leaflet satellite tiles on Windows DPI scaling */
.leaflet-container img.leaflet-tile {
  max-width: none !important;
  max-height: none !important;
  width: 257px !important;
  height: 257px !important;
  margin: -0.5px !important;
  outline: 1px solid transparent !important;
  backface-visibility: hidden !important;
}

/* =========================================================
   COMPREHENSIVE DARK MODE THEME OVERRIDES (html.dark)
   ========================================================= */
html.dark body {
  background-color: #020617 !important;
  color: #f8fafc !important;
}

/* Catch all white and light-slate backgrounds (including /opacity variants) */
html.dark .bg-slate-50,
html.dark [class*="bg-slate-50/"] {
  background-color: #0b1120 !important;
}

html.dark .bg-white,
html.dark [class*="bg-white/"] {
  background-color: #0f172a !important;
}

html.dark .bg-slate-100,
html.dark [class*="bg-slate-100/"] {
  background-color: #1e293b !important;
}

html.dark .bg-slate-200,
html.dark [class*="bg-slate-200/"] {
  background-color: #334155 !important;
}

/* Dark Mode Hover States */
html.dark .hover\:bg-slate-50:hover,
html.dark .hover\:bg-slate-100:hover,
html.dark .hover\:bg-slate-200:hover {
  background-color: #1e293b !important;
}

/* Catch all light borders (including /opacity variants that caused white outlines) */
html.dark .border-slate-100,
html.dark .border-slate-200,
html.dark [class*="border-slate-200/"],
html.dark .border-slate-300 {
  border-color: #1e293b !important;
}

html.dark .divide-slate-200 > :not([hidden]) ~ :not([hidden]) {
  border-color: #1e293b !important;
}

/* Typography Contrast in Dark Mode */
html.dark .text-slate-900 {
  color: #f8fafc !important;
}
html.dark .text-slate-800 {
  color: #f1f5f9 !important;
}
html.dark .text-slate-700 {
  color: #cbd5e1 !important;
}
html.dark .text-slate-600 {
  color: #94a3b8 !important;
}
html.dark .text-slate-500 {
  color: #94a3b8 !important;
}
html.dark .text-slate-400 {
  color: #64748b !important;
}

/* Form Inputs, Selects & Textareas */
html.dark input:not([type="checkbox"]),
html.dark select,
html.dark textarea {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  border-color: #334155 !important;
}
html.dark input::placeholder {
  color: #64748b !important;
}

/* Status Badges & Tinted Panels in Dark Mode */
html.dark .bg-emerald-50,
html.dark [class*="bg-emerald-50/"] {
  background-color: rgba(16, 185, 129, 0.15) !important;
}
html.dark .text-emerald-950,
html.dark .text-emerald-900,
html.dark .text-emerald-800,
html.dark .text-emerald-700 {
  color: #34d399 !important;
}
html.dark .border-emerald-200,
html.dark .border-emerald-100 {
  border-color: rgba(16, 185, 129, 0.35) !important;
}

html.dark .bg-amber-50,
html.dark [class*="bg-amber-50/"] {
  background-color: rgba(245, 158, 11, 0.15) !important;
}
html.dark .text-amber-800,
html.dark .text-amber-700 {
  color: #fbbf24 !important;
}
html.dark .border-amber-200 {
  border-color: rgba(245, 158, 11, 0.35) !important;
}

html.dark .bg-rose-50,
html.dark [class*="bg-rose-50/"] {
  background-color: rgba(244, 63, 94, 0.15) !important;
}
html.dark .text-rose-800,
html.dark .text-rose-700 {
  color: #fb7185 !important;
}
html.dark .border-rose-200 {
  border-color: rgba(244, 63, 94, 0.35) !important;
}

@keyframes drawerFadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mapPopupSpring {
  0% {
    opacity: 0;
    transform: translate(-50%, 8px) scale(0.92);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

.animate-drawer-item {
  animation: drawerFadeUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.animate-map-popup {
  animation: mapPopupSpring 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`,

  'src/components/Navbar.jsx': `import React from 'react';
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
`,

  'src/components/FilterToolbar.jsx': `import React from 'react';
import { Search, LayoutGrid, Map, Table, ArrowUpDown, X } from 'lucide-react';

export default function FilterToolbar({
  searchQuery,
  onSearchChange,
  sectorFilter,
  onSectorChange,
  sectors,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  statusFilter,
  onStatusFilterChange,
  allLots,
  filteredCount,
}) {
  const statuses = [
    { id: 'ALL', label: 'All Lots', count: allLots.length },
    { id: 'OK to Harvest', label: 'OK to Harvest', count: allLots.filter((l) => l.status === 'OK to Harvest').length },
    { id: 'Approaching', label: 'Approaching', count: allLots.filter((l) => l.status === 'Approaching').length },
    { id: 'Over-mature Risk', label: 'Over-mature Risk', count: allLots.filter((l) => l.status === 'Over-mature Risk').length },
    { id: 'Immature', label: 'Immature', count: allLots.filter((l) => l.status === 'Immature').length },
  ];

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'ALL' || sectorFilter !== 'ALL';

  const handleReset = () => {
    onSearchChange('');
    onStatusFilterChange('ALL');
    onSectorChange('ALL');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 shadow-2xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by Lot ID (e.g. LOT-167), Hacienda, Planter, or Variety..."
            className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
          <select
            value={sectorFilter}
            onChange={(e) => onSectorChange(e.target.value)}
            className="text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">All Mill Sectors</option>
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="text-xs sm:text-sm bg-transparent text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
            >
              <option value="readiness">Sort: Readiness Score</option>
              <option value="brix">Sort: Average Brix</option>
              <option value="age">Sort: Crop Age</option>
              <option value="area">Sort: Area (Ha)</option>
            </select>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => onViewModeChange('cards')}
              className={
                'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all ' +
                (viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
              }
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => onViewModeChange('map')}
              className={
                'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all ' +
                (viewMode === 'map'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
              }
            >
              <Map className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
            <button
              onClick={() => onViewModeChange('table')}
              className={
                'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all ' +
                (viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
              }
            >
              <Table className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {statuses.map((st) => {
            const active = statusFilter === st.id;
            return (
              <button
                key={st.id}
                onClick={() => onStatusFilterChange(st.id)}
                className={
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold border transition-all whitespace-nowrap ' +
                  (active
                    ? 'bg-emerald-700 text-white border-emerald-600 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700')
                }
              >
                <span>{st.label}</span>
                <span
                  className={
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold ' +
                    (active
                      ? 'bg-black/25 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200')
                  }
                >
                  {st.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>
            Showing <strong className="text-slate-800 dark:text-white">{filteredCount}</strong> of{' '}
            {allLots.length} lots
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
`,

  'src/components/LotCardGrid.jsx': `import React from 'react';
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
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Fixed Dark Mode UI: ' + relativePath);
}

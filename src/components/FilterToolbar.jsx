import React from 'react';
import {
  Search,
  LayoutGrid,
  Map,
  Table,
  ArrowUpDown,
  X,
  Rows3,
} from 'lucide-react';

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
  density = 'compact',
  onDensityChange,
}) {
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'ALL' ||
    sectorFilter !== 'ALL';

  const handleReset = () => {
    onSearchChange('');
    onStatusFilterChange('ALL');
    onSectorChange('ALL');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs">
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
              <option value="priority">Sort: Status Priority & Readiness</option>
              <option value="readiness">Sort: Readiness Index</option>
              <option value="brix">Sort: Average Brix</option>
              <option value="age">Sort: Crop Age</option>
              <option value="area">Sort: Area (Ha)</option>
            </select>
          </div>

          {viewMode === 'table' && onDensityChange && (
            <button
              type="button"
              onClick={() =>
                onDensityChange(density === 'compact' ? 'comfortable' : 'compact')
              }
              title="Toggle table row density"
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              <Rows3 className="w-3.5 h-3.5 text-slate-500" />
              <span className="capitalize">{density}</span>
            </button>
          )}

          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
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
            <button
              type="button"
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
              type="button"
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
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-800 dark:text-white">{filteredCount}</strong> of{' '}
          {allLots.length} monitored lots
          {statusFilter !== 'ALL' && (
            <span className="ml-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
              • Filtered by: {statusFilter}
            </span>
          )}
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}

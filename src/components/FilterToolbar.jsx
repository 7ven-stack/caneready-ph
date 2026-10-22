import React from 'react';
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

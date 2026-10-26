import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  ChevronDown,
  Check,
  ArrowUpDown,
  MapPin,
  Building2,
  Rows3,
  Rows4,
  RotateCcw,
} from 'lucide-react';

function CustomFilterDropdown({
  icon: Icon,
  value,
  options,
  onChange,
  align = 'left',
  minWidth = '165px',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];
  const isFiltered = value !== 'ALL' && value !== 'harvestDate';

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative select-none" style={{ minWidth }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={
          'w-full h-9 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 transition-all ' +
          (isOpen
            ? 'bg-white dark:bg-slate-800 border-emerald-600 ring-2 ring-emerald-500/15 text-slate-900 dark:text-white'
            : isFiltered
            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
            : 'bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200')
        }
      >
        <span className="flex items-center gap-1.5 truncate">
          {Icon && (
            <Icon
              className={
                'w-3.5 h-3.5 shrink-0 ' +
                (isFiltered || isOpen
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400 dark:text-slate-500')
              }
            />
          )}
          <span className="truncate">{selectedOption?.label}</span>
        </span>
        <ChevronDown
          className={
            'w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-150 ' +
            (isOpen ? 'rotate-180 text-emerald-600' : '')
          }
        />
      </button>

      {isOpen && (
        <div
          className={
            'absolute z-50 mt-1.5 min-w-full w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200/90 dark:border-slate-700 py-1.5 max-h-64 overflow-y-auto animate-drawer-item ' +
            (align === 'right' ? 'right-0' : 'left-0')
          }
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={
                  'w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors ' +
                  (active
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 font-medium')
                }
              >
                <span className="truncate">{opt.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {typeof opt.count === 'number' && (
                    <span
                      className={
                        'text-[10px] font-mono px-1.5 py-0.2 rounded-full ' +
                        (active
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400')
                      }
                    >
                      {opt.count}
                    </span>
                  )}
                  {active && (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterToolbar({
  searchQuery = '',
  onSearchChange,
  cityFilter = 'ALL',
  onCityChange,
  cities = [],
  associationFilter = 'ALL',
  onAssociationChange,
  associations = [],
  sortBy = 'harvestDate',
  onSortChange,
  statusFilter = 'ALL',
  onStatusFilterChange,
  allLots = [],
  filteredCount = 0,
  density = 'compact',
  onDensityChange,
}) {
  const searchInputRef = useRef(null);

  // Build City options with live lot counts
  const cityOptions = useMemo(() => {
    const counts = {};
    allLots.forEach((lot) => {
      if (lot.city) counts[lot.city] = (counts[lot.city] || 0) + 1;
    });
    return [
      { value: 'ALL', label: 'All Cities', count: allLots.length },
      ...cities.map((c) => ({
        value: c,
        label: c,
        count: counts[c] || 0,
      })),
    ];
  }, [cities, allLots]);

  // Build Association options with live lot counts (deduplicated)
  const associationOptions = useMemo(() => {
    const counts = {};
    allLots.forEach((lot) => {
      const assoc = lot.association || 'APSSI';
      counts[assoc] = (counts[assoc] || 0) + 1;
    });
    const uniqueAssocs = Array.from(new Set(associations));
    return [
      { value: 'ALL', label: 'All Associations', count: allLots.length },
      ...uniqueAssocs.map((a) => ({
        value: a,
        label: a,
        count: counts[a] || 0,
      })),
    ];
  }, [associations, allLots]);

  const sortOptions = [
    { value: 'harvestDate', label: 'Sort: Nearest Harvest Date' },
    { value: 'area', label: 'Sort: Largest Hectarage' },
    { value: 'planter', label: 'Sort: Planter Name (A–Z)' },
    { value: 'city', label: 'Sort: City / Municipality' },
  ];

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    cityFilter !== 'ALL' ||
    associationFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const handleResetAll = () => {
    if (onSearchChange) onSearchChange('');
    if (onCityChange) onCityChange('ALL');
    if (onAssociationChange) onAssociationChange('ALL');
    if (onStatusFilterChange) onStatusFilterChange('ALL');
    if (onSortChange) onSortChange('harvestDate');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 px-3 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
      {/* Left: Search Input */}
      <div className="relative flex-1 min-w-[240px]">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search planter, Lot ID, contact, hacienda, brgy, or city..."
          className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              searchInputRef.current?.focus();
            }}
            title="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right: Custom Filter Dropdowns + Density Toggle + Live Count Badge */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <CustomFilterDropdown
          icon={MapPin}
          value={cityFilter}
          options={cityOptions}
          onChange={onCityChange}
          minWidth="150px"
        />

        <CustomFilterDropdown
          icon={Building2}
          value={associationFilter}
          options={associationOptions}
          onChange={onAssociationChange}
          minWidth="170px"
        />

        <CustomFilterDropdown
          icon={ArrowUpDown}
          value={sortBy}
          options={sortOptions}
          onChange={onSortChange}
          align="right"
          minWidth="215px"
        />

        {/* Row Density Toggle */}
        {onDensityChange && (
          <button
            type="button"
            onClick={() =>
              onDensityChange(density === 'compact' ? 'comfortable' : 'compact')
            }
            title={
              density === 'compact'
                ? 'Switch to Comfortable row spacing'
                : 'Switch to Compact row spacing'
            }
            className="h-9 px-2.5 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
          >
            {density === 'compact' ? (
              <>
                <Rows4 className="w-3.5 h-3.5 text-slate-500" />
                <span>Compact</span>
              </>
            ) : (
              <>
                <Rows3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Spacious</span>
              </>
            )}
          </button>
        )}

        {/* Active Filter Reset Pill */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetAll}
            className="h-9 px-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold inline-flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}

        {/* Compact Lot Counter Pill */}
        <div className="hidden xl:flex items-center h-9 px-3 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
          <span>
            <strong className="font-bold text-slate-800 dark:text-slate-200">
              {filteredCount}
            </strong>{' '}
            / {allLots.length} lots
          </span>
        </div>
      </div>
    </div>
  );
}

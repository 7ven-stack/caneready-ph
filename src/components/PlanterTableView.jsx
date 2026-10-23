import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FlaskConical,
  Truck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getStatusStyles } from '../utils/caneCalculations';

function MiniBrixSparkline({ points = [], weeklyDelta = null }) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const width = 54;
  const height = 16;
  const min = Math.min(...points) - 0.5;
  const max = Math.max(...points) + 0.5;
  const range = Math.max(1, max - min);

  const polyPoints = points
    .map((val, idx) => {
      const x = ((idx / (points.length - 1)) * width).toFixed(1);
      const y = (height - ((val - min) / range) * height).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className="inline-flex items-center gap-1.5 mt-0.5"
      title={`Brix trend: ${points.join('° -> ')}°`}
    >
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="1.75"
          points={polyPoints}
        />
      </svg>
      {weeklyDelta !== null && (
        <span
          className={
            'text-[10px] font-mono font-bold ' +
            (weeklyDelta >= 0
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-rose-600')
          }
        >
          {weeklyDelta >= 0 ? `+${weeklyDelta}°/wk` : `${weeklyDelta}°/wk`}
        </span>
      )}
    </div>
  );
}

export default function PlanterTableView({
  lots = [],
  onSelectLot,
  onQuickLogBrix,
  onQuickScheduleCut,
  onBulkScheduleHarvest,
  density = 'compact',
}) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDate, setBulkDate] = useState('2026-10-28');
  const [bulkBrigade, setBulkBrigade] = useState('District Cutting Brigade A');
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => lots.some((l) => l.id === id)));
  }, [lots]);

  const handleSortHeader = (col) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedLots = useMemo(() => {
    if (!sortCol) return lots;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...lots].sort((a, b) => {
      if (sortCol === 'id') return a.id.localeCompare(b.id) * dir;
      if (sortCol === 'planter') return a.planter.localeCompare(b.planter) * dir;
      if (sortCol === 'area') return ((a.areaHa || 0) - (b.areaHa || 0)) * dir;
      if (sortCol === 'age')
        return ((a.cropAgeMonths || 0) - (b.cropAgeMonths || 0)) * dir;
      if (sortCol === 'brix')
        return ((a.avgBrix ?? -1) - (b.avgBrix ?? -1)) * dir;
      if (sortCol === 'ratio')
        return ((a.maturityRatio ?? -1) - (b.maturityRatio ?? -1)) * dir;
      if (sortCol === 'readiness')
        return ((a.readinessScore ?? -1) - (b.readinessScore ?? -1)) * dir;
      if (sortCol === 'status')
        return ((a.statusPriority || 4) - (b.statusPriority || 4)) * dir;
      if (sortCol === 'lastSampled')
        return (
          String(a.lastSampled || '').localeCompare(String(b.lastSampled || '')) *
          dir
        );
      if (sortCol === 'scheduled')
        return (
          String(a.dispatch?.scheduledDate || '').localeCompare(
            String(b.dispatch?.scheduledDate || '')
          ) * dir
        );
      return 0;
    });
  }, [lots, sortCol, sortDir]);

  const totalPages =
    pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(sortedLots.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleLots =
    pageSize === 'ALL'
      ? sortedLots
      : sortedLots.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allVisibleSelected =
    visibleLots.length > 0 &&
    visibleLots.every((l) => selectedIds.includes(l.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleLots.map((l) => l.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...visibleLots.map((l) => l.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleRowSelection = (lotId) => {
    setSelectedIds((prev) =>
      prev.includes(lotId)
        ? prev.filter((id) => id !== lotId)
        : [...prev, lotId]
    );
  };

  const handleApplyBulkDispatch = (e) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !onBulkScheduleHarvest) return;
    onBulkScheduleHarvest(selectedIds, {
      scheduledDate: bulkDate,
      brigadeLeader: bulkBrigade,
    });
    setSelectedIds([]);
  };

  const isCompact = density === 'compact';
  const cellPad = isCompact ? 'py-2 px-3' : 'py-3.5 px-4';

  const renderSortIcon = (col) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-700" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700" />
    );
  };

  if (lots.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          No sugarcane lots match your filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* 2f. Bulk "Schedule harvest" Action Bar */}
      {selectedIds.length > 0 && (
        <form
          onSubmit={handleApplyBulkDispatch}
          className="bg-emerald-950 text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md"
        >
          <div className="flex items-center gap-2 font-bold">
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>{selectedIds.length} lot(s) selected for bulk harvest dispatch</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-300">Cut Date:</span>
              <input
                type="date"
                required
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold"
              />
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-300">Crew:</span>
              <input
                type="text"
                required
                value={bulkBrigade}
                onChange={(e) => setBulkBrigade(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold"
              />
            </label>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Schedule harvest ({selectedIds.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Clear
            </button>
          </div>
        </form>
      )}

      {/* Sticky Header Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 select-none">
              <tr>
                <th className={cellPad + ' w-9'}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSortHeader('id')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Lot & Hacienda</span>
                    {renderSortIcon('id')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('planter')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Planter & Sector</span>
                    {renderSortIcon('planter')}
                  </div>
                </th>
                <th className={cellPad}>Variety</th>
                <th
                  onClick={() => handleSortHeader('area')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Area / MT</span>
                    {renderSortIcon('area')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('age')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Age</span>
                    {renderSortIcon('age')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('brix')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Avg Brix / Ratio</span>
                    {renderSortIcon('brix')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('readiness')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Readiness index</span>
                    {renderSortIcon('readiness')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('status')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Status & Est. Ready</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('lastSampled')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Last Sampled</span>
                    {renderSortIcon('lastSampled')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('scheduled')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Scheduled</span>
                    {renderSortIcon('scheduled')}
                  </div>
                </th>
                <th className={cellPad + ' text-right'}>Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {visibleLots.map((lot) => {
                const styles = getStatusStyles(lot.status);
                const isChecked = selectedIds.includes(lot.id);

                return (
                  <tr
                    key={lot.id}
                    onClick={() => onSelectLot(lot)}
                    className={
                      'transition-colors cursor-pointer ' +
                      (isChecked
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50')
                    }
                  >
                    <td
                      className={cellPad}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRowSelection(lot.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    <td className={cellPad}>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {lot.id}
                        </span>
                        {lot.pendingSync && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            Pending
                          </span>
                        )}
                        {lot.isUnverifiedDefault && (
                          <span
                            title="Flagged: 20.0 / 20.5° matches legacy form default"
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300"
                          >
                            <AlertCircle className="w-2.5 h-2.5" />
                            Unverified
                          </span>
                        )}
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[160px]">
                        {lot.hacienda}
                      </div>
                    </td>

                    <td className={cellPad}>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {lot.planter}
                      </div>
                      <div className="text-[11px] text-slate-400">{lot.sector}</div>
                    </td>

                    <td className={cellPad}>
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {lot.variety}
                      </div>
                      <div className="text-[11px] text-slate-400">{lot.cropClass}</div>
                    </td>

                    <td className={cellPad}>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {lot.areaHa} ha
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {lot.estimatedTons.toLocaleString()} MT
                      </div>
                    </td>

                    <td className={cellPad}>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {lot.cropAgeMonths}m
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {lot.plantingDate || '—'}
                      </div>
                    </td>

                    <td className={cellPad}>
                      {lot.hasBrixSample ? (
                        <div>
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white">
                              {lot.avgBrix}°
                            </span>
                            <span className="text-slate-400 ml-1 text-[11px]">
                              ({lot.topBrix}°/{lot.bottomBrix}°)
                            </span>
                            <span className="ml-1.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {lot.maturityRatio}
                            </span>
                          </div>
                          <MiniBrixSparkline
                            points={lot.brixTrend?.points}
                            weeklyDelta={lot.brixTrend?.weeklyDelta}
                          />
                        </div>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          No sample yet
                        </span>
                      )}
                    </td>

                    <td className={cellPad}>
                      {lot.hasBrixSample ? (
                        <div className="w-24">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span>{lot.readinessScore}%</span>
                            <span className="text-emerald-700 dark:text-emerald-400 text-[10px]">
                              {lot.estimatedLkgTc} LKg
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1 overflow-hidden">
                            <div
                              className={'h-full rounded-full ' + styles.bar}
                              style={{ width: lot.readinessScore + '%' }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className={cellPad}>
                      <span
                        title={lot.gateChecklist?.map((g) => g.summary).join(' | ')}
                        className={
                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ' +
                          styles.badge
                        }
                      >
                        <span className={'w-1.5 h-1.5 rounded-full ' + styles.dot} />
                        {lot.statusDisplay || lot.status}
                      </span>
                      <div
                        className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[165px]"
                        title={lot.estimatedReady?.reason}
                      >
                        Est:{' '}
                        <strong className="text-slate-700 dark:text-slate-300">
                          {lot.estimatedReady?.label || '—'}
                        </strong>
                      </div>
                    </td>

                    <td className={cellPad}>
                      {lot.hasBrixSample && lot.lastSampled ? (
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {lot.lastSampled}
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          No sample yet
                        </span>
                      )}
                    </td>

                    <td className={cellPad}>
                      {lot.dispatch?.scheduledDate ? (
                        <div>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {lot.dispatch.scheduledDate}
                          </span>
                          <div className="text-[10px] font-mono text-slate-400">
                            {lot.dispatch.quedanTicket}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unscheduled</span>
                      )}
                    </td>

                    {/* 2g. Log Brix and Schedule cut on every row */}
                    <td
                      className={cellPad + ' text-right'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onQuickLogBrix && onQuickLogBrix(lot)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-200 font-semibold text-[11px]"
                          title="Log Refractometer Brix for this lot"
                        >
                          <FlaskConical className="w-3 h-3 text-emerald-700" />
                          <span>Log Brix</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickScheduleCut && onQuickScheduleCut(lot)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-[11px]"
                          title="Schedule harvest dispatch for this lot"
                        >
                          <Truck className="w-3 h-3 text-slate-600" />
                          <span>Schedule cut</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table Pagination Footer */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span>
            Showing{' '}
            <strong>
              {pageSize === 'ALL' ? 1 : (safePage - 1) * pageSize + 1}–
              {pageSize === 'ALL'
                ? sortedLots.length
                : Math.min(sortedLots.length, safePage * pageSize)}
            </strong>{' '}
            of <strong>{sortedLots.length}</strong> lots
          </span>
          <select
            value={pageSize}
            onChange={(e) =>
              setPageSize(
                e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
              )
            }
            className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs bg-white dark:bg-slate-800 font-semibold"
          >
            <option value={10}>10 rows</option>
            <option value={15}>15 rows</option>
            <option value={30}>30 rows</option>
            <option value={50}>50 rows</option>
            <option value="ALL">All rows</option>
          </select>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 font-semibold text-slate-700 dark:text-slate-200">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 font-semibold"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

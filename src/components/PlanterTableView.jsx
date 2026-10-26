import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getStatusStyles } from '../utils/caneCalculations';

export default function PlanterTableView({
  lots = [],
  onSelectLot,
  onEditLot,
  onQuickScheduleCut,
  onBulkScheduleHarvest,
  density = 'compact',
}) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDate, setBulkDate] = useState('2026-11-15');
  const [bulkNotes, setBulkNotes] = useState('Planter group harvest schedule');
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
      if (sortCol === 'association')
        return (
          String(a.association || '').localeCompare(String(b.association || '')) *
          dir
        );
      if (sortCol === 'location')
        return (
          String(a.hacienda || '').localeCompare(String(b.hacienda || '')) * dir
        );
      if (sortCol === 'area') return ((a.areaHa || 0) - (b.areaHa || 0)) * dir;
      if (sortCol === 'harvestDate') {
        const dA = a.plannedHarvestDate || '9999-12-31';
        const dB = b.plannedHarvestDate || '9999-12-31';
        return dA.localeCompare(dB) * dir;
      }
      if (sortCol === 'status')
        return ((a.statusPriority || 4) - (b.statusPriority || 4)) * dir;
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

  const handleApplyBulkDate = (e) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !onBulkScheduleHarvest) return;
    onBulkScheduleHarvest(selectedIds, {
      scheduledDate: bulkDate,
      notes: bulkNotes,
    });
    setSelectedIds([]);
  };

  const isCompact = density === 'compact';
  const cellPad = isCompact ? 'py-2 px-3.5' : 'py-3 px-4';

  const renderSortIcon = (col) => {
    if (sortCol !== col)
      return (
        <ArrowUpDown className="w-3 h-3 opacity-25 group-hover:opacity-60 transition-opacity" />
      );
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
    );
  };

  if (lots.length === 0) {
    return (
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No planter lots match your current filters.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Try clearing your search query or switching the status filter above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Bulk Selection Action Bar */}
      {selectedIds.length > 0 && (
        <form
          onSubmit={handleApplyBulkDate}
          className="shrink-0 bg-slate-900 dark:bg-slate-950 text-white rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md border border-slate-800"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[11px]">
              {selectedIds.length} selected
            </span>
            <span className="font-medium text-slate-200">
              Assign batch harvest schedule
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Harvest Date</span>
              <input
                type="date"
                required
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="inline-flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Notes</span>
              <input
                type="text"
                placeholder="Optional remarks..."
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:border-emerald-500 w-44"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            >
              Apply Date
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1 rounded-md hover:bg-slate-800 text-slate-300 font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </form>
      )}

      {/* Fixed-Height Flex Enterprise Table Card */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 shadow-[0_1px_0_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_0_rgba(51,65,85,1)] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
              <tr>
                <th className={cellPad + ' w-10 text-center'}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSortHeader('id')}
                  className={
                    cellPad +
                    ' w-28 group cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors'
                  }
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Lot ID</span>
                    {renderSortIcon('id')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('planter')}
                  className={
                    cellPad +
                    ' group cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors'
                  }
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Planter & Contact</span>
                    {renderSortIcon('planter')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('association')}
                  className={
                    cellPad +
                    ' group cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors'
                  }
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Assoc.</span>
                    {renderSortIcon('association')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('location')}
                  className={
                    cellPad +
                    ' group cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors'
                  }
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Hacienda & Location</span>
                    {renderSortIcon('location')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('area')}
                  className={
                    cellPad +
                    ' text-right group cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors'
                  }
                >
                  <div className="inline-flex items-center justify-end gap-1 w-full">
                    <span>Hectarage</span>
                    {renderSortIcon('area')}
                  </div>
                </th>
                <th className={cellPad}>
                  <span>Coordinates (Lat, Lng)</span>
                </th>
                <th
                  onClick={() => handleSortHeader('harvestDate')}
                  className={
                    cellPad +
                    ' group cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors'
                  }
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Harvest Date</span>
                    {renderSortIcon('harvestDate')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('status')}
                  className={
                    cellPad +
                    ' group cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors'
                  }
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className={cellPad + ' text-right w-44'}>Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {visibleLots.map((lot) => {
                const styles = getStatusStyles(lot.status);
                const isChecked = selectedIds.includes(lot.id);
                const hasContact =
                  lot.contactNumber &&
                  String(lot.contactNumber).trim() !== '' &&
                  String(lot.contactNumber).toLowerCase() !== 'not provided';

                return (
                  <tr
                    key={lot.id}
                    onClick={() => onSelectLot(lot)}
                    className={
                      'group transition-colors cursor-pointer ' +
                      (isChecked
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/25'
                        : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40')
                    }
                  >
                    <td
                      className={cellPad + ' text-center'}
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

                    <td className={cellPad + ' whitespace-nowrap'}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                        {lot.id}
                      </span>
                    </td>

                    <td className={cellPad + ' whitespace-nowrap'}>
                      <div className="font-semibold text-slate-900 dark:text-white text-[13px] leading-tight">
                        {lot.planter}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        {hasContact ? (
                          lot.contactNumber
                        ) : (
                          <span className="font-sans text-slate-400 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </div>
                    </td>

                    <td className={cellPad + ' whitespace-nowrap'}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                        {lot.association || '—'}
                      </span>
                    </td>

                    <td className={cellPad + ' whitespace-nowrap'}>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 text-[12.5px] leading-tight">
                        {lot.hacienda}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {lot.barangay},{' '}
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {lot.city}
                        </span>
                      </div>
                    </td>

                    <td className={cellPad + ' text-right whitespace-nowrap tabular-nums'}>
                      <div className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight">
                        {Number(lot.areaHa).toFixed(2)}{' '}
                        <span className="text-[11px] font-medium text-slate-500">
                          ha
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        ~{lot.estimatedTons.toLocaleString()} MT
                      </div>
                    </td>

                    <td className={cellPad + ' whitespace-nowrap'}>
                      <span className="inline-block font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 px-2 py-1 rounded-md border border-slate-200/70 dark:border-slate-700/70">
                        {lot.latitude.toFixed(5)}°, {lot.longitude.toFixed(5)}°
                      </span>
                    </td>

                    <td className={cellPad + ' whitespace-nowrap tabular-nums'}>
                      {lot.plannedHarvestDate ? (
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white text-[12.5px] leading-tight">
                            {lot.plannedHarvestDate}
                          </div>
                          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {lot.harvestTimelineLabel}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                          — Unscheduled
                        </span>
                      )}
                    </td>

                    <td className={cellPad + ' whitespace-nowrap'}>
                      <span
                        className={
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ' +
                          styles.badge
                        }
                      >
                        <span className={'w-1.5 h-1.5 rounded-full ' + styles.dot} />
                        {lot.status}
                      </span>
                    </td>

                    <td
                      className={cellPad + ' text-right whitespace-nowrap'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onQuickScheduleCut && onQuickScheduleCut(lot)
                          }
                          className={
                            'min-w-[82px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ' +
                            (lot.plannedHarvestDate
                              ? 'bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-2xs')
                          }
                        >
                          {lot.plannedHarvestDate ? 'Reschedule' : 'Set Date'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditLot && onEditLot(lot)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pinned Card Footer for Pagination */}
        <div className="shrink-0 px-4 py-2 bg-slate-50/90 dark:bg-slate-800/70 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
            <span>
              Showing{' '}
              <strong className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                {pageSize === 'ALL' ? 1 : (safePage - 1) * pageSize + 1}–
                {pageSize === 'ALL'
                  ? sortedLots.length
                  : Math.min(sortedLots.length, safePage * pageSize)}
              </strong>{' '}
              of{' '}
              <strong className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                {sortedLots.length}
              </strong>{' '}
              planter lots
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(
                  e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
                );
                setCurrentPage(1);
              }}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value={10}>10 rows</option>
              <option value={15}>15 rows</option>
              <option value={30}>30 rows</option>
              <option value="ALL">All rows</option>
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 font-semibold tabular-nums text-xs">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

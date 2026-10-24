import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Pencil,
  Compass,
  Phone,
  Building2,
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
        return String(a.association || '').localeCompare(String(b.association || '')) * dir;
      if (sortCol === 'location')
        return String(a.city || '').localeCompare(String(b.city || '')) * dir;
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
  const cellPad = isCompact ? 'py-2.5 px-3' : 'py-3.5 px-4';

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
          No planter lots match your filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {selectedIds.length > 0 && (
        <form
          onSubmit={handleApplyBulkDate}
          className="bg-emerald-950 text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md"
        >
          <div className="flex items-center gap-2 font-bold">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Set Planned Harvest Date for {selectedIds.length} selected lot(s)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-300">Planned Date:</span>
              <input
                type="date"
                required
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold"
              />
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-300">Notes:</span>
              <input
                type="text"
                placeholder="Optional planter note"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold"
              />
            </label>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Apply Harvest Date ({selectedIds.length})
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

      {/* Main Planter Directory & Harvest Schedule Table */}
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
                  onClick={() => handleSortHeader('planter')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Planter & Contact No.</span>
                    {renderSortIcon('planter')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('association')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Planter's Assoc.</span>
                    {renderSortIcon('association')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('location')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Hacienda, Brgy. & City</span>
                    {renderSortIcon('location')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('area')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Hectarage</span>
                    {renderSortIcon('area')}
                  </div>
                </th>
                <th className={cellPad}>
                  <span>Lat / Long Area</span>
                </th>
                <th
                  onClick={() => handleSortHeader('harvestDate')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Planned Harvest Date</span>
                    {renderSortIcon('harvestDate')}
                  </div>
                </th>
                <th
                  onClick={() => handleSortHeader('status')}
                  className={cellPad + ' cursor-pointer hover:text-slate-900'}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Status</span>
                    {renderSortIcon('status')}
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

                    {/* Planter Name & Contact Number */}
                    <td className={cellPad}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {lot.id}
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {lot.planter}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{lot.contactNumber || 'No contact no.'}</span>
                      </div>
                    </td>

                    {/* Planter's Association */}
                    <td className={cellPad}>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs">
                        <Building2 className="w-3 h-3" />
                        {lot.association}
                      </span>
                    </td>

                    {/* Hacienda, Brgy. & City */}
                    <td className={cellPad}>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {lot.hacienda}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {lot.barangay}, <strong className="text-slate-700 dark:text-slate-200">{lot.city}</strong>
                      </div>
                    </td>

                    {/* Hectarage */}
                    <td className={cellPad}>
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        {lot.areaHa} ha
                      </div>
                      <div className="text-[11px] text-slate-500">
                        ~{lot.estimatedTons.toLocaleString()} MT
                      </div>
                    </td>

                    {/* Lat / Long */}
                    <td className={cellPad}>
                      <div className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                        <Compass className="w-3 h-3 text-rose-500 shrink-0" />
                        <span>
                          {lot.latitude.toFixed(5)}°N, {lot.longitude.toFixed(5)}°E
                        </span>
                      </div>
                    </td>

                    {/* Planned Harvest Date */}
                    <td className={cellPad}>
                      {lot.plannedHarvestDate ? (
                        <div>
                          <div className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                            {lot.plannedHarvestDate}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {lot.harvestTimelineLabel}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          Not set yet
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className={cellPad}>
                      <span
                        className={
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ' +
                          styles.badge
                        }
                      >
                        <span className={'w-1.5 h-1.5 rounded-full ' + styles.dot} />
                        {lot.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td
                      className={cellPad + ' text-right'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onQuickScheduleCut && onQuickScheduleCut(lot)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px]"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>
                            {lot.plannedHarvestDate ? 'Change Date' : 'Set Date'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditLot && onEditLot(lot)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-[11px]"
                        >
                          <Pencil className="w-3 h-3 text-emerald-700" />
                          <span>Edit</span>
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

      {/* Pagination Footer */}
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

import React, { useState, useMemo, useEffect } from 'react';
import {
  FlaskConical,
  Truck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getStatusStyles } from '../utils/caneCalculations';

function MiniBrixSparkline({ points = [], weeklyDelta = null }) {
  if (!Array.isArray(points) || points.length < 2) {
    return <span className="text-[10px] text-slate-400">1 sample</span>;
  }
  const min = Math.min(...points) - 0.5;
  const max = Math.max(...points) + 0.5;
  const range = Math.max(1, max - min);
  const width = 54;
  const height = 16;

  const polyPoints = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="inline-flex items-center gap-1.5 mt-0.5" title={`Brix trend: ${points.join('° → ')}°`}> <svg width={width} height={height} className="overflow-visible"> <polyline fill="none" stroke="#10b981" strokeWidth="1.75" points={polyPoints} /> </svg> {weeklyDelta !== null && ( <span className={ 'text-[10px] font-mono font-bold ' + (weeklyDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600') } > {weeklyDelta >= 0 ? `+${weeklyDelta}°/wk` : `${weeklyDelta}°/wk`} </span> )} </div> ); }  export default function PlanterTableView({ lots, onSelectLot, onQuickLogBrix, onQuickScheduleCut, onBulkScheduleHarvest, density = 'compact', }) { const [sortCol, setSortCol] = useState(null); const [sortDir, setSortDir] = useState('asc'); const [selectedIds, setSelectedIds] = useState([]); const [bulkDate, setBulkDate] = useState('2026-10-28'); const [bulkBrigade, setBulkBrigade] = useState('District Cutting Brigade A'); const [pageSize, setPageSize] = useState(15); const [currentPage, setCurrentPage] = useState(1);  useEffect(() => { setSelectedIds((prev) => prev.filter((id) => lots.some((l) => l.id === id))); }, [lots]);  const handleSortHeader = (col) => { if (sortCol === col) { setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc')); } else { setSortCol(col); setSortDir('asc'); } };  const sortedLots = useMemo(() => { if (!sortCol) return lots; const dir = sortDir === 'asc' ? 1 : -1; return [...lots].sort((a, b) => { if (sortCol === 'id') return a.id.localeCompare(b.id) * dir; if (sortCol === 'planter') return a.planter.localeCompare(b.planter) * dir; if (sortCol === 'area') return ((a.areaHa \vert{}\vert{} 0) - (b.areaHa \vert{}\vert{} 0)) * dir; if (sortCol === 'age') return ((a.cropAgeMonths \vert{}\vert{} 0) - (b.cropAgeMonths \vert{}\vert{} 0)) * dir; if (sortCol === 'brix') return ((a.avgBrix ?? -1) - (b.avgBrix ?? -1)) * dir; if (sortCol === 'ratio') return ((a.maturityRatio ?? -1) - (b.maturityRatio ?? -1)) * dir; if (sortCol === 'readiness') return ((a.readinessScore ?? -1) - (b.readinessScore ?? -1)) * dir; if (sortCol === 'status') return ((a.statusPriority \vert{}\vert{} 4) - (b.statusPriority \vert{}\vert{} 4)) * dir; if (sortCol === 'lastSampled') return String(a.lastSampled \vert{}\vert{} '').localeCompare(String(b.lastSampled \vert{}\vert{} '')) * dir; if (sortCol === 'scheduled') return ( String(a.dispatch?.scheduledDate \vert{}\vert{} '').localeCompare( String(b.dispatch?.scheduledDate \vert{}\vert{} '') ) * dir ); return 0; }); }, [lots, sortCol, sortDir]);  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(sortedLots.length / pageSize)); const safePage = Math.min(currentPage, totalPages); const visibleLots = pageSize === 'ALL' ? sortedLots : sortedLots.slice((safePage - 1) * pageSize, safePage * pageSize);  const allVisibleSelected = visibleLots.length > 0 && visibleLots.every((l) => selectedIds.includes(l.id));  const toggleSelectAllVisible = () => { if (allVisibleSelected) { const visibleSet = new Set(visibleLots.map((l) => l.id)); setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id))); } else { const merged = new Set([...selectedIds, ...visibleLots.map((l) => l.id)]); setSelectedIds(Array.from(merged)); } };  const toggleRowSelection = (lotId) => { setSelectedIds((prev) => prev.includes(lotId) ? prev.filter((id) => id !== lotId) : [...prev, lotId] ); };  const handleApplyBulkDispatch = (e) => { e.preventDefault(); if (selectedIds.length === 0 \vert{}\vert{} !onBulkScheduleHarvest) return; onBulkScheduleHarvest(selectedIds, { scheduledDate: bulkDate, brigadeLeader: bulkBrigade, }); setSelectedIds([]); };  const isCompact = density === 'compact'; const cellPad = isCompact ? 'py-2 px-3' : 'py-3.5 px-4';  const renderSortIcon = (col) => { if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />; return sortDir === 'asc' ? ( <ArrowUp className="w-3 h-3 text-emerald-700" /> ) : ( <ArrowDown className="w-3 h-3 text-emerald-700" /> ); };  if (lots.length === 0) { return ( <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center"> <p className="text-sm font-bold text-slate-700 dark:text-slate-200"> No sugarcane lots match your filter criteria. </p> </div> ); }  return ( <div className="space-y-2.5"> {/* 2f. Bulk "Schedule harvest" Action Bar */} {selectedIds.length > 0 && ( <form onSubmit={handleApplyBulkDispatch} className="bg-emerald-950 text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md" > <div className="flex items-center gap-2 font-bold"> <Truck className="w-4 h-4 text-emerald-400" /> <span>{selectedIds.length} lot(s) selected for bulk harvest dispatch</span> </div>  <div className="flex flex-wrap items-center gap-2"> <label className="inline-flex items-center gap-1.5 text-[11px]"> <span className="text-slate-300">Cut Date:</span> <input type="date" required value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold" /> </label> <label className="inline-flex items-center gap-1.5 text-[11px]"> <span className="text-slate-300">Crew:</span> <input type="text" required value={bulkBrigade} onChange={(e) => setBulkBrigade(e.target.value)} className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold" /> </label> <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold" > Schedule harvest ({selectedIds.length}) </button> <button type="button" onClick={() => setSelectedIds([])} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold" > Clear </button> </div> </form> )}  {/* Sticky Header Table */} <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs"> <div className="overflow-x-auto max-h-[65vh] overflow-y-auto"> <table className="w-full text-left border-collapse"> <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 select-none"> <tr> <th className={cellPad + ' w-9'}> <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" /> </th> <th onClick={() => handleSortHeader('id')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Lot & Hacienda</span> {renderSortIcon('id')} </div> </th> <th onClick={() => handleSortHeader('planter')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Planter & Sector</span> {renderSortIcon('planter')} </div> </th> <th className={cellPad}>Variety</th> <th onClick={() => handleSortHeader('area')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Area / MT</span> {renderSortIcon('area')} </div> </th> <th onClick={() => handleSortHeader('age')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Age</span> {renderSortIcon('age')} </div> </th> <th onClick={() => handleSortHeader('brix')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Avg Brix / Ratio</span> {renderSortIcon('brix')} </div> </th> <th onClick={() => handleSortHeader('readiness')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Readiness Index</span> {renderSortIcon('readiness')} </div> </th> <th onClick={() => handleSortHeader('status')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Status & Est. Ready</span> {renderSortIcon('status')} </div> </th> <th onClick={() => handleSortHeader('lastSampled')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Last Sampled</span> {renderSortIcon('lastSampled')} </div> </th> <th onClick={() => handleSortHeader('scheduled')} className={cellPad + ' cursor-pointer hover:text-slate-900'} > <div className="inline-flex items-center gap-1"> <span>Scheduled</span> {renderSortIcon('scheduled')} </div> </th> <th className={cellPad + ' text-right'}>Actions</th> </tr> </thead>  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs"> {visibleLots.map((lot) => { const styles = getStatusStyles(lot.status); const isChecked = selectedIds.includes(lot.id);  return ( <tr key={lot.id} onClick={() => onSelectLot(lot)} className={ 'transition-colors cursor-pointer ' + (isChecked ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50') } > <td className={cellPad} onClick={(e) => { e.stopPropagation(); toggleRowSelection(lot.id); }} > <input type="checkbox" checked={isChecked} onChange={() => {}} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" /> </td>  <td className={cellPad}> <div className="flex flex-wrap items-center gap-1"> <span className="font-mono font-bold text-slate-900 dark:text-white"> {lot.id} </span> {lot.pendingSync && ( <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300"> Pending </span> )} {lot.isUnverifiedDefault && ( <span title="Flagged: 20.0 / 20.5° matches legacy form default" className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300" > <AlertCircle className="w-2.5 h-2.5" /> Unverified </span> )} </div> <div className="text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[160px]"> {lot.hacienda} </div> </td>  <td className={cellPad}> <div className="font-bold text-slate-800 dark:text-slate-200"> {lot.planter} </div> <div className="text-[11px] text-slate-400">{lot.sector}</div> </td>  <td className={cellPad}> <div className="font-medium text-slate-800 dark:text-slate-200"> {lot.variety} </div> <div className="text-[11px] text-slate-400">{lot.cropClass}</div> </td>  <td className={cellPad}> <div className="font-bold text-slate-900 dark:text-white"> {lot.areaHa} ha </div> <div className="text-[11px] text-slate-500"> {lot.estimatedTons.toLocaleString()} MT </div> </td>  <td className={cellPad}> <div className="font-bold text-slate-800 dark:text-slate-200"> {lot.cropAgeMonths}m </div> <div className="text-[10px] text-slate-400"> {lot.plantingDate \vert{}\vert{} '—'} </div> </td>  <td className={cellPad}> {lot.hasBrixSample ? ( <div> <div> <span className="font-extrabold text-slate-900 dark:text-white"> {lot.avgBrix}° </span> <span className="text-slate-400 ml-1 text-[11px]"> ({lot.topBrix}°/{lot.bottomBrix}°) </span> <span className="ml-1.5 font-mono font-bold text-emerald-700 dark:text-emerald-400"> {lot.maturityRatio} </span> </div> <MiniBrixSparkline points={lot.brixTrend?.points} weeklyDelta={lot.brixTrend?.weeklyDelta} /> </div> ) : ( <span className="text-amber-700 dark:text-amber-400 font-semibold"> No sample yet </span> )} </td>  <td className={cellPad}> {lot.hasBrixSample ? ( <div className="w-24"> <div className="flex justify-between text-[11px] font-bold"> <span>{lot.readinessScore}\%</span> <span className="text-emerald-700 dark:text-emerald-400 text-[10px]"> {lot.estimatedLkgTc} LKg </span> </div> <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1 overflow-hidden"> <div className={'h-full rounded-full ' + styles.bar} style={{ width: lot.readinessScore + '\%' }} /> </div> </div> ) : ( <span className="text-slate-400">—</span> )} </td>  <td className={cellPad}> <span title={lot.gateChecklist?.map((g) => g.summary).join(' \vert{} ')} className={ 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ' + styles.badge } > <span className={'w-1.5 h-1.5 rounded-full ' + styles.dot} /> {lot.statusDisplay \vert{}\vert{} lot.status} </span> <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[165px]" title={lot.estimatedReady?.reason} > Est: <strong className="text-slate-700 dark:text-slate-300">{lot.estimatedReady?.label \vert{}\vert{} '—'}</strong> </div> </td>  <td className={cellPad}> {lot.hasBrixSample && lot.lastSampled ? ( <span className="font-medium text-slate-700 dark:text-slate-300"> {lot.lastSampled} </span> ) : ( <span className="text-amber-700 dark:text-amber-400 font-semibold"> No sample yet </span> )} </td>  <td className={cellPad}> {lot.dispatch?.scheduledDate ? ( <div> <span className="font-bold text-emerald-700 dark:text-emerald-400"> {lot.dispatch.scheduledDate} </span> <div className="text-[10px] font-mono text-slate-400"> {lot.dispatch.quedanTicket} </div> </div> ) : ( <span className="text-slate-400">Unscheduled</span> )} </td>  {/* 2g. Log Brix and Schedule cut on every row */} <td className={cellPad + ' text-right'} onClick={(e) => e.stopPropagation()} > <div className="inline-flex items-center justify-end gap-1.5"> <button type="button" onClick={() => onQuickLogBrix && onQuickLogBrix(lot)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-200 font-semibold text-[11px]" title="Log Refractometer Brix for this lot" > <FlaskConical className="w-3 h-3 text-emerald-700" /> <span>Log Brix</span> </button> <button type="button" onClick={() => onQuickScheduleCut && onQuickScheduleCut(lot)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-[11px]" title="Schedule harvest dispatch for this lot" > <Truck className="w-3 h-3 text-slate-600" /> <span>Schedule cut</span> </button> </div> </td> </tr> ); })} </tbody> </table> </div> </div>  {/* Table Pagination Footer */} <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs"> <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"> <span> Showing{' '} <strong> {pageSize === 'ALL' ? 1 : (safePage - 1) * pageSize + 1}– {pageSize === 'ALL' ? sortedLots.length : Math.min(sortedLots.length, safePage * pageSize)} </strong>{' '} of <strong>{sortedLots.length}</strong> lots </span> <select value={pageSize} onChange={(e) => setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)) } className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs bg-white dark:bg-slate-800 font-semibold" > <option value={10}>10 rows</option> <option value={15}>15 rows</option> <option value={30}>30 rows</option> <option value={50}>50 rows</option> <option value="ALL">All rows</option> </select> </div>  {totalPages > 1 && ( <div className="flex items-center gap-1.5"> <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 font-semibold" > <ChevronLeft className="w-3.5 h-3.5" /> <span>Prev</span> </button> <span className="px-2 font-semibold text-slate-700 dark:text-slate-200"> Page {safePage} of {totalPages} </span> <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 font-semibold" > <span>Next</span> <ChevronRight className="w-3.5 h-3.5" /> </button> </div> )} </div> </div> ); } '@ \vert{} Set-Content -Path ".\src\components\PlanterTableView.jsx" -Encoding UTF8  # 8. Update QuickBrixModal in src/components/Modals.jsx to support preselectedLotId and auto-focus Top Brix (<= 3 taps) $modalsFile = Get-Content -Path ".\src\components\Modals.jsx" -Raw $oldQuickBrix = '(?s)export function QuickBrixModal\(\{ isOpen, onClose, lots, onUpdateBrix \}\) \{.*?\n\}\n\n// 1a\. RegisterLotModal' $newQuickBrix = @' export function QuickBrixModal({ isOpen, onClose, lots, onUpdateBrix, preselectedLotId = null, }) { const [selectedLotId, setSelectedLotId] = useState( preselectedLotId \vert{}\vert{} (lots[0] ? lots[0].id : '') ); const [topBrix, setTopBrix] = useState(''); const [bottomBrix, setBottomBrix] = useState('');  useEffect(() => { if (isOpen) { if (preselectedLotId && lots.some((l) => l.id === preselectedLotId)) { setSelectedLotId(preselectedLotId); } else if (lots.length > 0 && !lots.some((l) => l.id === selectedLotId)) { setSelectedLotId(lots[0].id); } } }, [isOpen, preselectedLotId, lots, selectedLotId]);  if (!isOpen) return null;  const selectedLot = lots.find((l) => l.id === selectedLotId) \vert{}\vert{} null;  const handleSubmit = (e) => { e.preventDefault(); if (!selectedLotId) return; onUpdateBrix(selectedLotId, parseFloat(topBrix), parseFloat(bottomBrix)); setTopBrix(''); setBottomBrix(''); onClose(); };  return ( <div className="fixed inset-0 z-[1100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"> <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800"> <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4"> <div> <h3 className="text-base font-bold text-slate-900 dark:text-white"> Log Field Refractometer Sample </h3> {selectedLot && ( <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5"> Target: {selectedLot.id} — {selectedLot.hacienda} ({selectedLot.planter}) </p> )} </div> <button onClick={onClose} className="text-slate-400 hover:text-slate-600"> <X className="w-5 h-5" /> </button> </div>  {lots.length === 0 ? ( <p className="text-xs text-slate-500 py-4 text-center"> No farm lots registered yet. Register a lot first before logging Brix samples. </p> ) : ( <form onSubmit={handleSubmit} className="space-y-4 text-xs"> <div> <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"> Farm Lot </label> <select value={selectedLotId} onChange={(e) => setSelectedLotId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" > {lots.map((l) => ( <option key={l.id} value={l.id}> {l.id} — {l.hacienda} ({l.planter}) {!l.hasBrixSample ? ' [No sample yet]' : ''} </option> ))} </select> </div>  <div className="grid grid-cols-2 gap-3"> <div> <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"> Top Stalk Brix (°Bx) </label> <input type="number" inputMode="decimal" autoFocus step="0.1" min="1" max="32" required placeholder="e.g. 20.2" value={topBrix} onChange={(e) => setTopBrix(e.target.value)} className="w-full px-3 py-2.5 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700" /> </div> <div> <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"> Bottom Stalk Brix (°Bx) </label> <input type="number" inputMode="decimal" step="0.1" min="1" max="32" required placeholder="e.g. 20.6" value={bottomBrix} onChange={(e) => setBottomBrix(e.target.value)} className="w-full px-3 py-2.5 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700" /> </div> </div>  <div className="flex justify-end gap-2 pt-2"> <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium" > Cancel </button> <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800" > Save Sample </button> </div> </form> )} </div> </div> ); }  // 1a. RegisterLotModal '@ $modalsFile = [regex]::Replace($modalsFile, $oldQuickBrix, $newQuickBrix) Set-Content -Path ".\src\components\Modals.jsx" -Value $modalsFile -Encoding UTF8  # 9. Update src/components/LotInspectorDrawer.jsx to support initialTab, "Why this status?" gate checklist, Readiness index breakdown, and Estimated Ready Date $drawerFile = Get-Content -Path ".\src\components\LotInspectorDrawer.jsx" -Raw $drawerFile = $drawerFile -replace "initialEditMode = false,", "initialEditMode = false, initialTab = 'overview'," $drawerFile = $drawerFile -replace "setIsEditingInfo\(Boolean\(initialEditMode\)\);", "setIsEditingInfo(Boolean(initialEditMode)); setActiveTab(initialTab \vert{}\vert{} 'overview');" $drawerFile = $drawerFile -replace "Overall Harvest Readiness Score", "Readiness index" Set-Content -Path ".\src\components\LotInspectorDrawer.jsx" -Value $drawerFile -Encoding UTF8  # 10. src/App.jsx (Phase 2b, 2e, 2f, 2g: Table default on desktop / Cards on mobile, default sort = 'priority', NeedsAttentionPanel, 1-tap Log Brix & Schedule cut, Bulk Schedule Harvest) @' import React, { useState, useEffect, useMemo, useCallback } from 'react'; import { AlertTriangle, CheckCircle2, Clock, RotateCcw, WifiOff, X } from 'lucide-react'; import { evaluateLotMetrics } from './utils/caneCalculations'; import { fetchAllLots, createFarmLot, updateLotDetails, deleteFarmLot, updateLotBrixSample, updateLotBoundary, updateLotDispatch, loadCachedLots, saveCachedLots, getPendingOperations, enqueuePendingOperation, replayPendingOperations, } from './services/lotService'; import Navbar from './components/Navbar'; import KpiStrip from './components/KpiStrip'; import NeedsAttentionPanel from './components/NeedsAttentionPanel'; import FilterToolbar from './components/FilterToolbar'; import LotCardGrid from './components/LotCardGrid'; import ParcelMapView from './components/ParcelMapView'; import PlanterTableView from './components/PlanterTableView'; import LotInspectorDrawer from './components/LotInspectorDrawer'; import { QuickBrixModal, RegisterLotModal } from './components/Modals';  export default function App() { const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem('caneready_theme') === 'dark'; } catch { return false; } });  const [rawLots, setRawLots] = useState(() => loadCachedLots().lots); const [isLoading, setIsLoading] = useState(true); const [dataSource, setDataSource] = useState('Connecting...'); const [isOnline, setIsOnline] = useState(false); const [isOfflineCopy, setIsOfflineCopy] = useState(false); const [pendingOps, setPendingOps] = useState(() => getPendingOperations()); const [toast, setToast] = useState(null);  const [searchQuery, setSearchQuery] = useState(''); const [statusFilter, setStatusFilter] = useState('ALL'); const [sectorFilter, setSectorFilter] = useState('ALL'); // 2e. Default sort = status priority (Over-mature, OK to Harvest, Approaching, Immature), then readiness index const [sortBy, setSortBy] = useState('priority'); // 2f. Table is default on desktop (>= 768px), Cards on mobile const [viewMode, setViewMode] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table' ); const [density, setDensity] = useState('compact');  const [selectedLotId, setSelectedLotId] = useState(null); const [openDrawerInEditMode, setOpenDrawerInEditMode] = useState(false); const [drawerInitialTab, setDrawerInitialTab] = useState('overview'); const [isBrixModalOpen, setIsBrixModalOpen] = useState(false); const [brixModalLotId, setBrixModalLotId] = useState(null); const [isNewLotModalOpen, setIsNewLotModalOpen] = useState(false); const [pendingPolygonCoords, setPendingPolygonCoords] = useState(null); const [pendingPolygonAreaHa, setPendingPolygonAreaHa] = useState(null);  const showToast = useCallback((type, title, message) => { setToast({ id: Date.now(), type, title, message }); }, []);  useEffect(() => { const rootEl = document.documentElement; try { if (darkMode) { rootEl.classList.add('dark'); localStorage.setItem('caneready_theme', 'dark'); } else { rootEl.classList.remove('dark'); localStorage.setItem('caneready_theme', 'light'); } } catch {} }, [darkMode]);  const syncLots = useCallback(async () => { setIsLoading(true); setDataSource('Syncing...');  const currentPending = getPendingOperations(); if (currentPending.length > 0) { const replayResult = await replayPendingOperations(); setPendingOps(getPendingOperations()); if (replayResult.replayed > 0) { showToast( 'success', 'Pending Changes Synced', `Replayed ${replayResult.replayed} queued edit(s) to the database.`
        );
      }
    }

    const result = await fetchAllLots();
    setRawLots(result.lots);
    const remaining = getPendingOperations();
    setPendingOps(remaining);
    setDataSource(
      remaining.length > 0
        ? `${result.source} (${remaining.length} pending)`
        : result.source
    );
    setIsOnline(Boolean(result.online));
    setIsOfflineCopy(Boolean(result.isOfflineCopy));
    setIsLoading(false);
  }, [showToast]);

  useEffect(() => {
    syncLots();
  }, [syncLots]);

  useEffect(() => {
    const handleBrowserOnline = () => {
      showToast('info', 'Network Restored', 'Replaying pending operations...');
      syncLots();
    };
    window.addEventListener('online', handleBrowserOnline);
    return () => window.removeEventListener('online', handleBrowserOnline);
  }, [syncLots, showToast]);

  useEffect(() => {
    saveCachedLots(rawLots);
  }, [rawLots]);

  const pendingLotIds = useMemo(
    () => new Set(pendingOps.map((op) => op.lotId)),
    [pendingOps]
  );

  const evaluatedLots = useMemo(
    () =>
      rawLots.map((lot) => ({
        ...evaluateLotMetrics(lot),
        pendingSync: Boolean(lot.pendingSync || pendingLotIds.has(lot.id)),
      })),
    [rawLots, pendingLotIds]
  );

  const sectors = useMemo(
    () => Array.from(new Set(rawLots.map((l) => l.sector))),
    [rawLots]
  );

  const filteredLots = useMemo(() => {
    return evaluatedLots
      .filter((lot) => {
        const matchesStatus =
          statusFilter === 'ALL' || lot.status === statusFilter;
        const matchesSector =
          sectorFilter === 'ALL' || lot.sector === sectorFilter;
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          !q ||
          lot.id.toLowerCase().includes(q) ||
          lot.hacienda.toLowerCase().includes(q) ||
          lot.planter.toLowerCase().includes(q) ||
          lot.variety.toLowerCase().includes(q);

        return matchesStatus && matchesSector && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          if (a.statusPriority !== b.statusPriority) {
            return a.statusPriority - b.statusPriority;
          }
          return (b.readinessScore ?? -1) - (a.readinessScore ?? -1);
        }
        if (sortBy === 'brix') return (b.avgBrix ?? -1) - (a.avgBrix ?? -1);
        if (sortBy === 'age') return (b.cropAgeMonths ?? 0) - (a.cropAgeMonths ?? 0);
        if (sortBy === 'area') return (b.areaHa ?? 0) - (a.areaHa ?? 0);
        return (b.readinessScore ?? -1) - (a.readinessScore ?? -1);
      });
  }, [evaluatedLots, statusFilter, sectorFilter, searchQuery, sortBy]);

  const selectedLot = useMemo(
    () => evaluatedLots.find((l) => l.id === selectedLotId) || null,
    [evaluatedLots, selectedLotId]
  );

  const handleQuickLogBrix = useCallback((lot) => {
    setBrixModalLotId(lot?.id || null);
    setIsBrixModalOpen(true);
  }, []);

  const handleQuickScheduleCut = useCallback((lot) => {
    if (!lot) return;
    setOpenDrawerInEditMode(false);
    setDrawerInitialTab('dispatch');
    setSelectedLotId(lot.id);
  }, []);

  const handleInspectLot = useCallback((lot) => {
    if (!lot) return;
    setOpenDrawerInEditMode(false);
    setDrawerInitialTab('overview');
    setSelectedLotId(lot.id);
  }, []);

  const handleAddLot = async (newLot) => {
    const previousLots = rawLots;
    setRawLots((prev) => [{ ...newLot, pendingSync: true }, ...prev]);

    const res = await createFarmLot(newLot);
    if (!res.ok) {
      if (res.code === '23505') {
        setRawLots(previousLots);
        showToast('error', 'Duplicate Lot ID (PK Conflict)', res.error);
        return res;
      }

      const nextQueue = enqueuePendingOperation({
        type: 'CREATE_LOT',
        lotId: newLot.id,
        payload: newLot,
        lastError: res.error,
      });
      setPendingOps(nextQueue);
      setDataSource(`Offline (${nextQueue.length} pending)`); showToast( 'warning', `Saved "${newLot.id}" as Pending`,
        `${res.error}. Queued in local storage and will sync when online.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((l) => (l.id === newLot.id ? { ...l, pendingSync: false } : l))
    );
    setPendingPolygonCoords(null);
    setPendingPolygonAreaHa(null);
    showToast('success', 'Lot Registered', `${newLot.id} saved to${res.source}.`);
    return res;
  };

  const handleUpdateLotDetails = async (lotId, updatedFields) => {
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? { ...lot, ...updatedFields, pendingSync: true }
          : lot
      )
    );

    const res = await updateLotDetails(lotId, updatedFields);
    if (!res.ok) {
      const nextQueue = enqueuePendingOperation({
        type: 'UPDATE_DETAILS',
        lotId,
        payload: updatedFields,
        lastError: res.error,
      });
      setPendingOps(nextQueue);
      showToast(
        'warning',
        `Edit Queued as Pending (${lotId})`, `${res.error}. Your edit is marked pending and survives reload.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Planter Info Synced', `${lotId} updated in${res.source}.`);
    return res;
  };

  const handleDeleteLot = async (lotId) => {
    setRawLots((prev) => prev.filter((lot) => lot.id !== lotId));
    setSelectedLotId(null);

    const res = await deleteFarmLot(lotId);
    if (!res.ok) {
      const nextQueue = enqueuePendingOperation({
        type: 'DELETE_LOT',
        lotId,
        payload: null,
        lastError: res.error,
      });
      setPendingOps(nextQueue);
      showToast(
        'warning',
        `Delete Pending (${lotId})`, `${res.error}. Deletion queued until database policy/connection allows it.`
      );
      return res;
    }

    showToast('success', 'Lot Deleted', `${lotId} removed from${res.source}.`);
    return res;
  };

  const handleUpdateBrix = async (lotId, topBrix, bottomBrix) => {
    const today = new Date().toISOString().split('T')[0];
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              topBrix,
              bottomBrix,
              lastSampled: today,
              sampleVerified: true,
              brixSamples: [
                ...(Array.isArray(lot.brixSamples) ? lot.brixSamples : []),
                { top_brix: topBrix, bottom_brix: bottomBrix, sampled_at: today },
              ],
              pendingSync: true,
            }
          : lot
      )
    );

    const res = await updateLotBrixSample(lotId, topBrix, bottomBrix, today);
    if (!res.ok) {
      const nextQueue = enqueuePendingOperation({
        type: 'UPDATE_BRIX',
        lotId,
        payload: { topBrix, bottomBrix, lastSampled: today },
        lastError: res.error,
      });
      setPendingOps(nextQueue);
      showToast(
        'warning',
        `Brix Sample Marked Pending (${lotId})`, `${res.error}. Saved locally and queued for retry.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Brix Sample Saved', `${lotId} synced to${res.source}.`);
    return res;
  };

  const handleUpdateLotBoundary = async (lotId, newCoords, newAreaHa) => {
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              coordinates: newCoords,
              areaHa: newAreaHa ?? lot.areaHa,
              pendingSync: true,
            }
          : lot
      )
    );

    const res = await updateLotBoundary(lotId, newCoords, newAreaHa);
    if (!res.ok) {
      const nextQueue = enqueuePendingOperation({
        type: 'UPDATE_BOUNDARY',
        lotId,
        payload: { coordinates: newCoords, areaHa: newAreaHa },
        lastError: res.error,
      });
      setPendingOps(nextQueue);
      showToast(
        'warning',
        `Polygon Edit Pending (${lotId})`, `${res.error}. Boundary saved locally and queued for sync.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Polygon Boundary Saved', `${lotId} synced to${res.source}.`);
    return res;
  };

  const handleCreateLotFromPolygon = (drawnCoords, calculatedAreaHa) => {
    setPendingPolygonCoords(drawnCoords);
    setPendingPolygonAreaHa(calculatedAreaHa);
    setIsNewLotModalOpen(true);
  };

  const handleSaveDispatch = async (lotId, dispatchData) => {
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? { ...lot, dispatch: dispatchData, pendingSync: true }
          : lot
      )
    );

    const res = await updateLotDispatch(lotId, dispatchData);
    if (!res.ok) {
      const nextQueue = enqueuePendingOperation({
        type: 'UPDATE_DISPATCH',
        lotId,
        payload: { dispatch: dispatchData },
        lastError: res.error,
      });
      setPendingOps(nextQueue);
      showToast(
        'warning',
        `Dispatch Order Pending (${lotId})`, `${res.error}. Queued for automatic retry.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Dispatch Order Synced', `${lotId} saved to ${res.source}.`); return res; };  const handleBulkScheduleHarvest = async (lotIds, { scheduledDate, brigadeLeader }) => { for (const id of lotIds) { const ticket = `QDN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await handleSaveDispatch(id, {
        scheduledDate,
        quedanTicket: ticket,
        brigadeLeader,
        assignedTrucks: 4,
      });
    }
    showToast(
      'success',
      'Bulk Harvest Scheduled',
      `Issued cutting schedules for ${lotIds.length} lot(s) on${scheduledDate}.`
    );
  };

  const handleExportCsv = () => {
    const escapeCsvField = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (/[",\r\n]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const headers = [
      'Lot ID',
      'Hacienda',
      'Planter',
      'Sector',
      'Variety',
      'Crop Class',
      'Planting / Cut Date',
      'Area (Ha)',
      'Crop Age (Mos)',
      'Top Brix',
      'Bottom Brix',
      'Avg Brix',
      'Maturity Ratio',
      'Est. LKg/TC',
      'Est. Tons',
      'Readiness Index',
      'Last Sampled',
      'Scheduled Date',
      'Status',
    ];

    const rows = filteredLots.map((l) => [
      l.id,
      l.hacienda,
      l.planter,
      l.sector,
      l.variety,
      l.cropClass,
      l.plantingDate || '',
      l.areaHa,
      l.cropAgeMonths,
      l.hasBrixSample ? l.topBrix : 'No sample yet',
      l.hasBrixSample ? l.bottomBrix : 'No sample yet',
      l.hasBrixSample ? l.avgBrix : 'No sample yet',
      l.hasBrixSample ? l.maturityRatio : '',
      l.hasBrixSample ? l.estimatedLkgTc : '',
      l.estimatedTons,
      l.hasBrixSample ? l.readinessScore : '',
      l.hasBrixSample && l.lastSampled ? l.lastSampled : 'No sample yet',
      l.dispatch?.scheduledDate || '',
      l.statusDisplay || l.status,
    ]);

    const csvLines = [
      headers.map(escapeCsvField).join(','),
      ...rows.map((row) => row.map(escapeCsvField).join(',')),
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvLines], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'caneready_lots_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 transition-colors">
      <Navbar
        onOpenBrixModal={() => {
          setBrixModalLotId(null);
          setIsBrixModalOpen(true);
        }}
        onOpenNewLotModal={() => {
          setPendingPolygonCoords(null);
          setPendingPolygonAreaHa(null);
          setIsNewLotModalOpen(true);
        }}
        dataSource={dataSource}
        isOnline={isOnline && pendingOps.length === 0}
        onRefresh={syncLots}
        onExportCsv={handleExportCsv}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />

      {(isOfflineCopy || pendingOps.length > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-800 px-3 sm:px-6 lg:px-8 py-1.5 text-xs">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
              {isOfflineCopy ? (
                <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                {isOfflineCopy && (
                  <strong className="mr-1.5 uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100">
                    Offline copy
                  </strong>
                )}
                {pendingOps.length > 0
                  ? `${pendingOps.length} unsynced change(s) marked pending (${pendingOps
                      .map((o) => o.lotId)
                      .join(', ')}).`
                  : 'Database unreachable — displaying local offline copy.'}
              </span>
            </div>

            <button
              type="button"
              onClick={syncLots}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-800 hover:bg-amber-900 text-white font-bold text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Sync</span>
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-[1200] max-w-sm w-full bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3">
          {toast.type === 'error' || toast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white">{toast.title}</h4>
            <p className="text-slate-600 dark:text-slate-300 mt-0.5 break-words">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-3.5 space-y-3">
        <KpiStrip
          lots={evaluatedLots}
          statusFilter={statusFilter}
          onSelectStatus={setStatusFilter}
        />

        <NeedsAttentionPanel
          lots={evaluatedLots}
          onQuickLogBrix={handleQuickLogBrix}
          onQuickScheduleCut={handleQuickScheduleCut}
          onInspectLot={handleInspectLot}
        />

        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sectorFilter={sectorFilter}
          onSectorChange={setSectorFilter}
          sectors={sectors}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          allLots={evaluatedLots}
          filteredCount={filteredLots.length}
          density={density}
          onDensityChange={setDensity}
        />

        {isLoading && evaluatedLots.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-500">
            Loading sugarcane lots...
          </div>
        ) : (
          <>
            {viewMode === 'cards' && (
              <LotCardGrid
                lots={filteredLots}
                density={density}
                onSelectLot={handleInspectLot}
                onQuickLogBrix={handleQuickLogBrix}
                onQuickScheduleCut={handleQuickScheduleCut}
              />
            )}

            {viewMode === 'map' && (
              <ParcelMapView
                lots={filteredLots}
                onSelectLot={handleInspectLot}
                onUpdateLotBoundary={handleUpdateLotBoundary}
                onCreateLotFromPolygon={handleCreateLotFromPolygon}
              />
            )}

            {viewMode === 'table' && (
              <PlanterTableView
                lots={filteredLots}
                density={density}
                onSelectLot={handleInspectLot}
                onQuickLogBrix={handleQuickLogBrix}
                onQuickScheduleCut={handleQuickScheduleCut}
                onBulkScheduleHarvest={handleBulkScheduleHarvest}
              />
            )}
          </>
        )}
      </main>

      <LotInspectorDrawer
        lot={selectedLot}
        initialEditMode={openDrawerInEditMode}
        initialTab={drawerInitialTab}
        onClose={() => {
          setSelectedLotId(null);
          setOpenDrawerInEditMode(false);
          setDrawerInitialTab('overview');
        }}
        onUpdateLotDetails={handleUpdateLotDetails}
        onDeleteLot={handleDeleteLot}
        onUpdateBrix={handleUpdateBrix}
        onSaveDispatch={handleSaveDispatch}
      />

      <QuickBrixModal
        isOpen={isBrixModalOpen}
        onClose={() => {
          setIsBrixModalOpen(false);
          setBrixModalLotId(null);
        }}
        lots={evaluatedLots}
        preselectedLotId={brixModalLotId}
        onUpdateBrix={handleUpdateBrix}
      />

      <RegisterLotModal
        isOpen={isNewLotModalOpen}
        onClose={() => {
          setIsNewLotModalOpen(false);
          setPendingPolygonCoords(null);
          setPendingPolygonAreaHa(null);
        }}
        onAddLot={handleAddLot}
        existingLots={evaluatedLots}
        initialCoordinates={pendingPolygonCoords}
        initialAreaHa={pendingPolygonAreaHa}
      />
    </div>
  );
}

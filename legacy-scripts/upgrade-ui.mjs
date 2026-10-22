import fs from 'fs';
import path from 'path';

const files = {
  'src/services/lotService.js': `import { createClient } from '@supabase/supabase-js';
import { INITIAL_LOTS } from '../data/initialLots';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const supabase =
  SUPABASE_URL && SUPABASE_KEY && !SUPABASE_KEY.includes('PASTE_YOUR')
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

function fromSqlRow(row) {
  return {
    id: row.id,
    hacienda: row.hacienda,
    planter: row.planter,
    sector: row.sector,
    variety: row.variety,
    cropClass: row.crop_class ?? row.cropClass,
    areaHa: Number(row.area_ha ?? row.areaHa),
    expectedTcHa: Number(row.expected_tc_ha ?? row.expectedTcHa ?? 75),
    plantingDate: row.planting_date ?? row.plantingDate,
    cropAgeMonths: Number(row.crop_age_months ?? row.cropAgeMonths),
    topBrix: Number(row.top_brix ?? row.topBrix),
    bottomBrix: Number(row.bottom_brix ?? row.bottomBrix),
    soilMoisture: row.soil_moisture ?? row.soilMoisture,
    lastSampled: row.last_sampled ?? row.lastSampled,
    svgPoints: row.svg_points ?? row.svgPoints,
    labelPos: row.label_pos ?? row.labelPos,
    dispatch: row.dispatch ?? null,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 1800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function fetchAllLots() {
  // 1. Try Supabase with fast error handling
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data && data.length > 0) {
        return { lots: data.map(fromSqlRow), source: 'Supabase Cloud DB', online: true };
      }
    } catch {
      // Fall through to Express or LocalStorage
    }
  }

  // 2. Try Express API with 1.8s timeout so it never hangs on "Connecting..."
  try {
    const res = await fetchWithTimeout(API_URL + '/lots');
    if (res.ok) {
      const data = await res.json();
      return { lots: data.map(fromSqlRow), source: 'Express API Server', online: true };
    }
  } catch {
    // Express server not active, fall back immediately
  }

  // 3. Instant LocalStorage Fallback
  const saved = localStorage.getItem('caneready_lots_v1');
  const lots = saved ? JSON.parse(saved) : INITIAL_LOTS;
  return { lots, source: 'Local Storage (Ready)', online: false };
}

export async function createFarmLot(newLot) {
  if (supabase) {
    try {
      await supabase.from('farm_lots').insert([
        {
          id: newLot.id,
          hacienda: newLot.hacienda,
          planter: newLot.planter,
          sector: newLot.sector,
          variety: newLot.variety,
          crop_class: newLot.cropClass,
          area_ha: newLot.areaHa,
          expected_tc_ha: newLot.expectedTcHa,
          planting_date: newLot.plantingDate,
          crop_age_months: newLot.cropAgeMonths,
          top_brix: newLot.topBrix,
          bottom_brix: newLot.bottomBrix,
          soil_moisture: newLot.soilMoisture,
          last_sampled: newLot.lastSampled,
          dispatch: null,
        },
      ]);
      return;
    } catch {}
  }

  try {
    await fetchWithTimeout(API_URL + '/lots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLot),
    });
  } catch {}
}

export async function updateLotBrixSample(lotId, topBrix, bottomBrix, lastSampled) {
  if (supabase) {
    try {
      await supabase
        .from('farm_lots')
        .update({ top_brix: topBrix, bottom_brix: bottomBrix, last_sampled: lastSampled })
        .eq('id', lotId);
      return;
    } catch {}
  }

  try {
    await fetchWithTimeout(API_URL + '/lots/' + lotId + '/brix', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topBrix, bottomBrix, lastSampled }),
    });
  } catch {}
}

export async function updateLotDispatch(lotId, dispatchData) {
  if (supabase) {
    try {
      await supabase
        .from('farm_lots')
        .update({ dispatch: dispatchData })
        .eq('id', lotId);
      return;
    } catch {}
  }

  try {
    await fetchWithTimeout(API_URL + '/lots/' + lotId + '/dispatch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatch: dispatchData }),
    });
  } catch {}
}
`,

  'src/components/Navbar.jsx': `import React from 'react';
import { Sprout, FlaskConical, Plus, RefreshCw, Database, Download } from 'lucide-react';

export default function Navbar({
  onOpenBrixModal,
  onOpenNewLotModal,
  dataSource,
  isOnline,
  onRefresh,
  onExportCsv,
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shadow-sm shrink-0">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 truncate">
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
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200')
                }
              >
                <span
                  className={
                    'w-1.5 h-1.5 rounded-full ' +
                    (isOnline ? 'bg-emerald-400' : 'bg-emerald-600')
                  }
                />
                <Database className="w-3 h-3 hidden sm:inline" />
                <span className="truncate max-w-[130px] sm:max-w-none">{dataSource}</span>
                <RefreshCw className="w-2.5 h-2.5 opacity-70" />
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              Sugarcane Lot Maturity & Harvest Readiness Monitor
            </p>
          </div>
        </div>

        {/* Desktop & Tablet Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onExportCsv}
            title="Export filtered lots to CSV"
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onOpenBrixModal}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-2xs"
          >
            <FlaskConical className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="hidden sm:inline">Log Brix Sample</span>
            <span className="sm:hidden">Brix</span>
          </button>
          <button
            onClick={onOpenNewLotModal}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] transition-all shadow-xs"
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

  'src/components/KpiStrip.jsx': `import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Layers } from 'lucide-react';

export default function KpiStrip({ lots, statusFilter, onSelectStatus }) {
  const totalHa = lots.reduce((sum, l) => sum + Number(l.areaHa), 0).toFixed(1);
  const totalTons = lots.reduce((sum, l) => sum + l.estimatedTons, 0);
  const okLots = lots.filter((l) => l.status === 'OK to Harvest');
  const okTons = okLots.reduce((sum, l) => sum + l.estimatedTons, 0);
  const okHa = okLots.reduce((sum, l) => sum + Number(l.areaHa), 0).toFixed(1);
  const approachingLots = lots.filter((l) => l.status === 'Approaching');
  const riskLots = lots.filter((l) => l.status === 'Over-mature Risk');
  const immatureLots = lots.filter((l) => l.status === 'Immature');

  const countPct = (arr) => (lots.length > 0 ? Math.round((arr.length / lots.length) * 100) : 0);

  const cards = [
    {
      id: 'ALL',
      title: 'Monitored Lots',
      value: lots.length,
      unit: 'Total Lots',
      sub: totalHa + ' ha • ' + totalTons.toLocaleString() + ' MT Est.',
      badge: '100% Estate',
      icon: Layers,
      accent: 'text-slate-700 bg-slate-100 border-slate-200',
      activeBorder: 'border-slate-900 ring-2 ring-slate-900/10 bg-white',
      topBar: 'bg-slate-800',
    },
    {
      id: 'OK to Harvest',
      title: 'OK to Harvest',
      value: okLots.length,
      unit: 'Lots Ready',
      sub: okHa + ' ha • ' + okTons.toLocaleString() + ' MT Ready',
      badge: countPct(okLots) + '% of Lots',
      icon: CheckCircle2,
      accent: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-600/15 bg-emerald-50/20',
      topBar: 'bg-emerald-600',
    },
    {
      id: 'Approaching',
      title: 'Approaching',
      value: approachingLots.length,
      unit: 'Near Maturity',
      sub: 'Re-test Brix in 7–10 days',
      badge: countPct(approachingLots) + '% of Lots',
      icon: Clock,
      accent: 'text-amber-700 bg-amber-50 border-amber-200',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/20',
      topBar: 'bg-amber-500',
    },
    {
      id: 'Over-mature Risk',
      title: 'Over-Mature Risk',
      value: riskLots.length,
      unit: 'Urgent Cut',
      sub: 'Inversion risk (Ratio > 1.08)',
      badge: countPct(riskLots) + '% Urgent',
      icon: AlertTriangle,
      accent: 'text-rose-700 bg-rose-50 border-rose-200',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/15 bg-rose-50/20',
      topBar: 'bg-rose-600',
    },
  ];

  return (
    <section className="space-y-3">
      {/* Responsive 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const isActive = statusFilter === card.id;

          return (
            <button
              key={card.id}
              onClick={() =>
                onSelectStatus(isActive && card.id !== 'ALL' ? 'ALL' : card.id)
              }
              className={
                'group relative text-left rounded-xl p-3.5 sm:p-4 border transition-all overflow-hidden ' +
                (isActive
                  ? card.activeBorder + ' shadow-sm'
                  : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs')
              }
            >
              <div className={'absolute top-0 left-0 right-0 h-1 ' + card.topBar} />

              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
                  {card.title}
                </span>
                <span className={'p-1.5 sm:p-2 rounded-lg border shrink-0 ' + card.accent}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {card.value}
                </span>
                <span className="text-xs font-semibold text-slate-500 truncate">
                  {card.unit}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                <p className="text-[11px] text-slate-500 truncate">{card.sub}</p>
                <span className="hidden sm:inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                  {card.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* District Proportional Maturity Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-700">District Harvest Readiness Mix:</span>
          <span className="text-slate-500">{totalHa} Total Hectares</span>
        </div>

        <div className="flex-1 max-w-md w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
          <div
            style={{ width: countPct(okLots) + '%' }}
            className="bg-emerald-500 h-full transition-all"
            title={'OK to Harvest: ' + okLots.length}
          />
          <div
            style={{ width: countPct(approachingLots) + '%' }}
            className="bg-amber-400 h-full transition-all"
            title={'Approaching: ' + approachingLots.length}
          />
          <div
            style={{ width: countPct(riskLots) + '%' }}
            className="bg-rose-500 h-full transition-all"
            title={'Over-mature Risk: ' + riskLots.length}
          />
          <div
            style={{ width: countPct(immatureLots) + '%' }}
            className="bg-slate-400 h-full transition-all"
            title={'Immature: ' + immatureLots.length}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Ready ({okLots.length})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Approaching ({approachingLots.length})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Urgent ({riskLots.length})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Immature ({immatureLots.length})
          </span>
        </div>
      </div>
    </section>
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
    {
      id: 'OK to Harvest',
      label: 'OK to Harvest',
      count: allLots.filter((l) => l.status === 'OK to Harvest').length,
    },
    {
      id: 'Approaching',
      label: 'Approaching',
      count: allLots.filter((l) => l.status === 'Approaching').length,
    },
    {
      id: 'Over-mature Risk',
      label: 'Over-mature Risk',
      count: allLots.filter((l) => l.status === 'Over-mature Risk').length,
    },
    {
      id: 'Immature',
      label: 'Immature',
      count: allLots.filter((l) => l.status === 'Immature').length,
    },
  ];

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'ALL' || sectorFilter !== 'ALL';

  const handleReset = () => {
    onSearchChange('');
    onStatusFilterChange('ALL');
    onSectorChange('ALL');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 space-y-3 shadow-2xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Input with quick clear */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by Lot ID (e.g. LOT-A101), Hacienda, Planter, or Variety..."
            className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
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

        {/* Filter & View Switcher Controls */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
          <select
            value={sectorFilter}
            onChange={(e) => onSectorChange(e.target.value)}
            className="text-xs sm:text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">All Mill Sectors</option>
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-2.5 py-2 bg-white">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="text-xs sm:text-sm bg-transparent text-slate-700 font-medium focus:outline-none"
            >
              <option value="readiness">Sort: Readiness Score</option>
              <option value="brix">Sort: Average Brix</option>
              <option value="age">Sort: Crop Age</option>
              <option value="area">Sort: Area (Ha)</option>
            </select>
          </div>

          {/* Segmented View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-100">
            <button
              onClick={() => onViewModeChange('cards')}
              className={
                'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all ' +
                (viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900')
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
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900')
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
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900')
              }
            >
              <Table className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Filter Pill Strip + Result Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {statuses.map((st) => {
            const active = statusFilter === st.id;
            return (
              <button
                key={st.id}
                onClick={() => onStatusFilterChange(st.id)}
                className={
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ' +
                  (active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100')
                }
              >
                <span>{st.label}</span>
                <span
                  className={
                    'px-1.5 py-0.2 rounded-full text-[10px] ' +
                    (active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700')
                  }
                >
                  {st.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 shrink-0">
          <span>
            Showing <strong className="text-slate-800">{filteredCount}</strong> of{' '}
            {allLots.length} lots
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2"
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
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-base font-bold text-slate-700">
          No sugarcane lots match your current filter criteria.
        </p>
        <p className="text-xs text-slate-500 mt-1">
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
            className="group relative bg-white rounded-xl border border-slate-200/90 hover:border-emerald-600/60 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Status Top Accent Bar */}
            <div className={'h-1.5 w-full ' + styles.bar} />

            <div className="p-4 sm:p-5">
              {/* Top Tier: Lot ID + Crop Class + Status Badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      {lot.id}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                      {lot.cropClass}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1.5 group-hover:text-emerald-700 transition-colors truncate">
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
              <div className="grid grid-cols-1 gap-1 text-xs text-slate-600 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Planter:
                  </span>
                  <strong className="text-slate-800 truncate">{lot.planter}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Location:
                  </span>
                  <span className="font-medium text-slate-700">
                    {lot.sector} • <strong>{lot.areaHa} ha</strong>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <Sprout className="w-3.5 h-3.5 text-slate-400" />
                    Variety:
                  </span>
                  <span className="font-medium text-slate-700">
                    {lot.variety} ({lot.estimatedTons.toLocaleString()} MT)
                  </span>
                </div>
              </div>

              {/* Middle Tier: 3 Key Agronomic Metrics */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50/90 border border-slate-200/60 text-center">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Avg Brix</div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    {lot.avgBrix}°
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">
                    T:{lot.topBrix}° / B:{lot.bottomBrix}°
                  </div>
                </div>
                <div className="border-x border-slate-200/80 px-1">
                  <div className="text-[11px] font-medium text-slate-500">T/B Ratio</div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    {lot.maturityRatio}
                  </div>
                  <div className="text-[10px] font-medium text-emerald-700">
                    Opt: 0.95–1.02
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Crop Age</div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    {lot.cropAgeMonths}m
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700">
                    {lot.estimatedLkgTc} LKg/TC
                  </div>
                </div>
              </div>

              {/* Readiness Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600">
                    Harvest Readiness Index
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {lot.readinessScore}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
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
                  ? 'bg-emerald-50/60 border-emerald-100'
                  : 'bg-slate-50/70 border-slate-100')
              }
            >
              {lot.dispatch ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  Scheduled: {lot.dispatch.scheduledDate}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Sampled: {lot.lastSampled}
                </span>
              )}

              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform">
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
`,

  'src/App.jsx': `import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { INITIAL_LOTS } from './data/initialLots';
import { evaluateLotMetrics } from './utils/caneCalculations';
import {
  fetchAllLots,
  createFarmLot,
  updateLotBrixSample,
  updateLotDispatch,
} from './services/lotService';
import Navbar from './components/Navbar';
import KpiStrip from './components/KpiStrip';
import FilterToolbar from './components/FilterToolbar';
import LotCardGrid from './components/LotCardGrid';
import ParcelMapView from './components/ParcelMapView';
import PlanterTableView from './components/PlanterTableView';
import LotInspectorDrawer from './components/LotInspectorDrawer';
import { QuickBrixModal, RegisterLotModal } from './components/Modals';

export default function App() {
  const [rawLots, setRawLots] = useState(() => {
    const saved = localStorage.getItem('caneready_lots_v1');
    return saved ? JSON.parse(saved) : INITIAL_LOTS;
  });
  const [dataSource, setDataSource] = useState('Local Storage (Ready)');
  const [isOnline, setIsOnline] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('readiness');
  const [viewMode, setViewMode] = useState('cards');

  const [selectedLotId, setSelectedLotId] = useState(null);
  const [isBrixModalOpen, setIsBrixModalOpen] = useState(false);
  const [isNewLotModalOpen, setIsNewLotModalOpen] = useState(false);

  const syncLots = useCallback(async () => {
    setDataSource('Syncing...');
    const { lots, source, online } = await fetchAllLots();
    setRawLots(lots);
    setDataSource(source);
    setIsOnline(Boolean(online));
  }, []);

  useEffect(() => {
    syncLots();
  }, [syncLots]);

  useEffect(() => {
    localStorage.setItem('caneready_lots_v1', JSON.stringify(rawLots));
  }, [rawLots]);

  const evaluatedLots = useMemo(
    () => rawLots.map((lot) => evaluateLotMetrics(lot)),
    [rawLots]
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
        if (sortBy === 'brix') return b.avgBrix - a.avgBrix;
        if (sortBy === 'age') return b.cropAgeMonths - a.cropAgeMonths;
        if (sortBy === 'area') return b.areaHa - a.areaHa;
        return b.readinessScore - a.readinessScore;
      });
  }, [evaluatedLots, statusFilter, sectorFilter, searchQuery, sortBy]);

  const selectedLot = useMemo(
    () => evaluatedLots.find((l) => l.id === selectedLotId) || null,
    [evaluatedLots, selectedLotId]
  );

  const handleUpdateBrix = async (lotId, topBrix, bottomBrix) => {
    const today = new Date().toISOString().split('T')[0];
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? { ...lot, topBrix, bottomBrix, lastSampled: today }
          : lot
      )
    );
    await updateLotBrixSample(lotId, topBrix, bottomBrix, today);
  };

  const handleSaveDispatch = async (lotId, dispatchData) => {
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, dispatch: dispatchData } : lot
      )
    );
    await updateLotDispatch(lotId, dispatchData);
  };

  const handleAddLot = async (newLot) => {
    setRawLots((prev) => [newLot, ...prev]);
    await createFarmLot(newLot);
  };

  const handleExportCsv = () => {
    const headers = [
      'Lot ID',
      'Hacienda',
      'Planter',
      'Sector',
      'Variety',
      'Crop Class',
      'Area (Ha)',
      'Crop Age (Mos)',
      'Top Brix',
      'Bottom Brix',
      'Avg Brix',
      'Maturity Ratio',
      'Est. LKg/TC',
      'Est. Tons',
      'Readiness Score',
      'Status',
    ];
    const rows = filteredLots.map((l) => [
      l.id,
      '"' + l.hacienda + '"',
      '"' + l.planter + '"',
      '"' + l.sector + '"',
      '"' + l.variety + '"',
      '"' + l.cropClass + '"',
      l.areaHa,
      l.cropAgeMonths,
      l.topBrix,
      l.bottomBrix,
      l.avgBrix,
      l.maturityRatio,
      l.estimatedLkgTc,
      l.estimatedTons,
      l.readinessScore,
      '"' + l.status + '"',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'caneready_lots_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        onOpenBrixModal={() => setIsBrixModalOpen(true)}
        onOpenNewLotModal={() => setIsNewLotModalOpen(true)}
        dataSource={dataSource}
        isOnline={isOnline}
        onRefresh={syncLots}
        onExportCsv={handleExportCsv}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        <KpiStrip
          lots={evaluatedLots}
          statusFilter={statusFilter}
          onSelectStatus={setStatusFilter}
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
        />

        {viewMode === 'cards' && (
          <LotCardGrid
            lots={filteredLots}
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
          />
        )}

        {viewMode === 'map' && (
          <ParcelMapView
            lots={filteredLots}
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
          />
        )}

        {viewMode === 'table' && (
          <PlanterTableView
            lots={filteredLots}
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
          />
        )}
      </main>

      <LotInspectorDrawer
        lot={selectedLot}
        onClose={() => setSelectedLotId(null)}
        onUpdateBrix={handleUpdateBrix}
        onSaveDispatch={handleSaveDispatch}
      />

      <QuickBrixModal
        isOpen={isBrixModalOpen}
        onClose={() => setIsBrixModalOpen(false)}
        lots={evaluatedLots}
        onUpdateBrix={handleUpdateBrix}
      />

      <RegisterLotModal
        isOpen={isNewLotModalOpen}
        onClose={() => setIsNewLotModalOpen(false)}
        onAddLot={handleAddLot}
      />
    </div>
  );
}
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Upgraded UI component: ' + relativePath);
}

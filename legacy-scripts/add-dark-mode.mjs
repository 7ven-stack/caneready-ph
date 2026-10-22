import fs from 'fs';
import path from 'path';

const files = {
  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,

  'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
}

/* Fix white grid lines/seams between Leaflet satellite tiles */
.leaflet-container img.leaflet-tile {
  max-width: none !important;
  max-height: none !important;
  width: 256.5px !important;
  height: 256.5px !important;
}

/* =========================================================
   DARK MODE THEME OVERRIDES (html.dark)
   ========================================================= */
html.dark body {
  background-color: #020617 !important;
  color: #f8fafc !important;
}

/* Main App & Surface Backgrounds */
html.dark .bg-slate-50 {
  background-color: #020617 !important;
}
html.dark .bg-slate-50\/50,
html.dark .bg-slate-50\/70,
html.dark .bg-slate-50\/80,
html.dark .bg-slate-50\/90 {
  background-color: #0f172a !important;
}
html.dark .bg-white {
  background-color: #0f172a !important;
}
html.dark .bg-white\/95 {
  background-color: rgba(15, 23, 42, 0.95) !important;
}
html.dark .bg-slate-100 {
  background-color: #1e293b !important;
}
html.dark .bg-slate-200,
html.dark .bg-slate-200\/80 {
  background-color: #334155 !important;
}

/* Hover States in Dark Mode */
html.dark .hover\:bg-slate-50:hover,
html.dark .hover\:bg-slate-100:hover,
html.dark .hover\:bg-slate-200:hover {
  background-color: #1e293b !important;
}

/* Borders & Dividers */
html.dark .border-slate-100 {
  border-color: #1e293b !important;
}
html.dark .border-slate-200,
html.dark .border-slate-200\/60,
html.dark .border-slate-200\/70,
html.dark .border-slate-200\/80,
html.dark .border-slate-200\/90,
html.dark .border-slate-200\/95 {
  border-color: #1e293b !important;
}
html.dark .border-slate-300 {
  border-color: #334155 !important;
}
html.dark .divide-slate-200 > :not([hidden]) ~ :not([hidden]) {
  border-color: #1e293b !important;
}

/* Typography Hierarchy */
html.dark .text-slate-900 {
  color: #f8fafc !important;
}
html.dark .text-slate-800 {
  color: #e2e8f0 !important;
}
html.dark .text-slate-700 {
  color: #cbd5e1 !important;
}
html.dark .text-slate-600 {
  color: #94a3b8 !important;
}
html.dark .text-slate-500 {
  color: #64748b !important;
}
html.dark .text-slate-400 {
  color: #475569 !important;
}

/* Form Inputs & Dropdowns */
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
html.dark .bg-emerald-50\/60,
html.dark .bg-emerald-50\/70,
html.dark .bg-emerald-50\/20,
html.dark .bg-emerald-50\/10 {
  background-color: rgba(16, 185, 129, 0.14) !important;
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
html.dark .bg-amber-50\/10,
html.dark .bg-amber-50\/20 {
  background-color: rgba(245, 158, 11, 0.14) !important;
}
html.dark .text-amber-800,
html.dark .text-amber-700 {
  color: #fbbf24 !important;
}
html.dark .border-amber-200 {
  border-color: rgba(245, 158, 11, 0.35) !important;
}

html.dark .bg-rose-50,
html.dark .bg-rose-50\/10,
html.dark .bg-rose-50\/20 {
  background-color: rgba(244, 63, 94, 0.14) !important;
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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-colors">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
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

        {/* Right Actions + Theme Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dark / Light Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
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
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenBrixModal}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs"
          >
            <FlaskConical className="w-4 h-4 text-emerald-600 shrink-0" />
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

  'src/App.jsx': `import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { INITIAL_LOTS } from './data/initialLots';
import { evaluateLotMetrics } from './utils/caneCalculations';
import {
  fetchAllLots,
  createFarmLot,
  updateLotDetails,
  deleteFarmLot,
  updateLotBrixSample,
  updateLotBoundary,
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
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('caneready_theme') === 'dark';
  });

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
  const [openDrawerInEditMode, setOpenDrawerInEditMode] = useState(false);
  const [isBrixModalOpen, setIsBrixModalOpen] = useState(false);
  const [isNewLotModalOpen, setIsNewLotModalOpen] = useState(false);
  const [pendingPolygonCoords, setPendingPolygonCoords] = useState(null);
  const [pendingPolygonAreaHa, setPendingPolygonAreaHa] = useState(null);

  // Sync Dark Mode class on <html> tag and persist in localStorage
  useEffect(() => {
    const rootEl = document.documentElement;
    if (darkMode) {
      rootEl.classList.add('dark');
      localStorage.setItem('caneready_theme', 'dark');
    } else {
      rootEl.classList.remove('dark');
      localStorage.setItem('caneready_theme', 'light');
    }
  }, [darkMode]);

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

  const handleUpdateLotDetails = async (lotId, updatedFields) => {
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, ...updatedFields } : lot
      )
    );
    await updateLotDetails(lotId, updatedFields);
  };

  const handleDeleteLot = async (lotId) => {
    setRawLots((prev) => prev.filter((lot) => lot.id !== lotId));
    setSelectedLotId(null);
    await deleteFarmLot(lotId);
  };

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

  const handleUpdateLotBoundary = async (lotId, newCoords, newAreaHa) => {
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? { ...lot, coordinates: newCoords, areaHa: newAreaHa ?? lot.areaHa }
          : lot
      )
    );
    await updateLotBoundary(lotId, newCoords, newAreaHa);
  };

  const handleCreateLotFromPolygon = (drawnCoords, calculatedAreaHa) => {
    setPendingPolygonCoords(drawnCoords);
    setPendingPolygonAreaHa(calculatedAreaHa);
    setIsNewLotModalOpen(true);
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
    setPendingPolygonCoords(null);
    setPendingPolygonAreaHa(null);
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
    const nl = String.fromCharCode(10);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join(nl);
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'caneready_lots_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 transition-colors">
      <Navbar
        onOpenBrixModal={() => setIsBrixModalOpen(true)}
        onOpenNewLotModal={() => {
          setPendingPolygonCoords(null);
          setPendingPolygonAreaHa(null);
          setIsNewLotModalOpen(true);
        }}
        dataSource={dataSource}
        isOnline={isOnline}
        onRefresh={syncLots}
        onExportCsv={handleExportCsv}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
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
            onSelectLot={(lot) => {
              setOpenDrawerInEditMode(false);
              setSelectedLotId(lot.id);
            }}
          />
        )}

        {viewMode === 'map' && (
          <ParcelMapView
            lots={filteredLots}
            onSelectLot={(lot) => {
              setOpenDrawerInEditMode(false);
              setSelectedLotId(lot.id);
            }}
            onUpdateLotBoundary={handleUpdateLotBoundary}
            onCreateLotFromPolygon={handleCreateLotFromPolygon}
          />
        )}

        {viewMode === 'table' && (
          <PlanterTableView
            lots={filteredLots}
            onSelectLot={(lot) => {
              setOpenDrawerInEditMode(false);
              setSelectedLotId(lot.id);
            }}
            onEditLot={(lot) => {
              setOpenDrawerInEditMode(true);
              setSelectedLotId(lot.id);
            }}
          />
        )}
      </main>

      <LotInspectorDrawer
        lot={selectedLot}
        initialEditMode={openDrawerInEditMode}
        onClose={() => {
          setSelectedLotId(null);
          setOpenDrawerInEditMode(false);
        }}
        onUpdateLotDetails={handleUpdateLotDetails}
        onDeleteLot={handleDeleteLot}
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
        onClose={() => {
          setIsNewLotModalOpen(false);
          setPendingPolygonCoords(null);
          setPendingPolygonAreaHa(null);
        }}
        onAddLot={handleAddLot}
        initialCoordinates={pendingPolygonCoords}
        initialAreaHa={pendingPolygonAreaHa}
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
  console.log('Updated: ' + relativePath);
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

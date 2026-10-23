import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, WifiOff, X } from 'lucide-react';
import { evaluateLotMetrics } from './utils/caneCalculations';
import {
  fetchAllLots,
  createFarmLot,
  updateLotDetails,
  deleteFarmLot,
  updateLotBrixSample,
  updateLotBoundary,
  updateLotDispatch,
  loadCachedLots,
  saveCachedLots,
  getPendingOperations,
  enqueuePendingOperation,
  replayPendingOperations,
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
    try {
      return localStorage.getItem('caneready_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [rawLots, setRawLots] = useState(() => loadCachedLots().lots);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState('Connecting...');
  const [isOnline, setIsOnline] = useState(false);
  const [isOfflineCopy, setIsOfflineCopy] = useState(false);
  const [pendingOps, setPendingOps] = useState(() => getPendingOperations());
  const [toast, setToast] = useState(null);

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

  const showToast = useCallback((type, title, message) => {
    setToast({ id: Date.now(), type, title, message });
  }, []);

  useEffect(() => {
    const rootEl = document.documentElement;
    try {
      if (darkMode) {
        rootEl.classList.add('dark');
        localStorage.setItem('caneready_theme', 'dark');
      } else {
        rootEl.classList.remove('dark');
        localStorage.setItem('caneready_theme', 'light');
      }
    } catch {}
  }, [darkMode]);

  const syncLots = useCallback(async () => {
    setIsLoading(true);
    setDataSource('Syncing...');

    const currentPending = getPendingOperations();
    if (currentPending.length > 0) {
      const replayResult = await replayPendingOperations();
      setPendingOps(getPendingOperations());
      if (replayResult.replayed > 0) {
        showToast(
          'success',
          'Pending Changes Synced',
          `Replayed ${replayResult.replayed} queued edit(s) to the database.`
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
      setDataSource(`Offline (${nextQueue.length} pending)`);
      showToast(
        'warning',
        `Saved "${newLot.id}" as Pending`,
        `${res.error}. Queued in local storage and will sync when online.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((l) => (l.id === newLot.id ? { ...l, pendingSync: false } : l))
    );
    setPendingPolygonCoords(null);
    setPendingPolygonAreaHa(null);
    showToast('success', 'Lot Registered', `${newLot.id} saved to ${res.source}.`);
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
        `Edit Queued as Pending (${lotId})`,
        `${res.error}. Your edit is marked pending and survives reload.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Planter Info Synced', `${lotId} updated in ${res.source}.`);
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
        `Delete Pending (${lotId})`,
        `${res.error}. Deletion queued until database policy/connection allows it.`
      );
      return res;
    }

    showToast('success', 'Lot Deleted', `${lotId} removed from ${res.source}.`);
    return res;
  };

  const handleUpdateBrix = async (lotId, topBrix, bottomBrix) => {
    const today = new Date().toISOString().split('T')[0];
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? { ...lot, topBrix, bottomBrix, lastSampled: today, pendingSync: true }
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
        `Brix Sample Marked Pending (${lotId})`,
        `${res.error}. Saved locally and queued for retry.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Brix Sample Saved', `${lotId} synced to ${res.source}.`);
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
        `Polygon Edit Pending (${lotId})`,
        `${res.error}. Boundary saved locally and queued for sync.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Polygon Boundary Saved', `${lotId} synced to ${res.source}.`);
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
        `Dispatch Order Pending (${lotId})`,
        `${res.error}. Queued for automatic retry.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Dispatch Order Synced', `${lotId} saved to ${res.source}.`);
    return res;
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
      'Readiness Score',
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

    // 1f. Build a Blob with a UTF-8 BOM (\uFEFF) and RFC-4180 quote escaping
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
        onOpenBrixModal={() => setIsBrixModalOpen(true)}
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
        <div className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-800 px-3 sm:px-6 lg:px-8 py-2 text-xs">
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
                      .join(', ')}). Will replay automatically when connection/permissions are restored.`
                  : 'Database unreachable — displaying local offline copy.'}
              </span>
            </div>

            <button
              type="button"
              onClick={syncLots}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-800 hover:bg-amber-900 text-white font-bold text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Sync Now</span>
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

        {isLoading && evaluatedLots.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
            Loading sugarcane lots...
          </div>
        ) : (
          <>
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
          </>
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
        existingLots={evaluatedLots}
        initialCoordinates={pendingPolygonCoords}
        initialAreaHa={pendingPolygonAreaHa}
      />
    </div>
  );
}


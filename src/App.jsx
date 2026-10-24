import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, WifiOff, X } from 'lucide-react';
import { evaluateLotMetrics } from './utils/caneCalculations';
import {
  fetchAllLots,
  createFarmLot,
  updateLotDetails,
  deleteFarmLot,
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
import NeedsAttentionPanel from './components/NeedsAttentionPanel';
import FilterToolbar from './components/FilterToolbar';
import ParcelMapView from './components/ParcelMapView';
import PlanterTableView from './components/PlanterTableView';
import LotInspectorDrawer from './components/LotInspectorDrawer';
import { SetHarvestDateModal, RegisterLotModal } from './components/Modals';

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
  const [isToastLeaving, setIsToastLeaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [associationFilter, setAssociationFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('harvestDate');
  const [viewMode, setViewMode] = useState('table');
  const [density, setDensity] = useState('compact');

  const [selectedLotId, setSelectedLotId] = useState(null);
  const [openDrawerInEditMode, setOpenDrawerInEditMode] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState('overview');

  const [scheduleModalLotId, setScheduleModalLotId] = useState(null);
  const [isNewLotModalOpen, setIsNewLotModalOpen] = useState(false);
  const [pendingPolygonCoords, setPendingPolygonCoords] = useState(null);
  const [pendingPolygonAreaHa, setPendingPolygonAreaHa] = useState(null);
  const [pendingPolygonLat, setPendingPolygonLat] = useState(null);
  const [pendingPolygonLng, setPendingPolygonLng] = useState(null);

  const showToast = useCallback((type, title, message) => {
    setIsToastLeaving(false);
    setToast({ id: Date.now(), type, title, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const fadeTimer = setTimeout(() => setIsToastLeaving(true), 3800);
    const removeTimer = setTimeout(() => {
      setToast(null);
      setIsToastLeaving(false);
    }, 4300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast]);

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

  const cities = useMemo(
    () => Array.from(new Set(evaluatedLots.map((l) => l.city).filter(Boolean))),
    [evaluatedLots]
  );

  const associations = useMemo(
    () =>
      Array.from(new Set(evaluatedLots.map((l) => l.association).filter(Boolean))),
    [evaluatedLots]
  );

  const filteredLots = useMemo(() => {
    return evaluatedLots
      .filter((lot) => {
        const matchesStatus =
          statusFilter === 'ALL' || lot.status === statusFilter;
        const matchesCity = cityFilter === 'ALL' || lot.city === cityFilter;
        const matchesAssoc =
          associationFilter === 'ALL' || lot.association === associationFilter;
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          !q ||
          lot.id.toLowerCase().includes(q) ||
          lot.planter.toLowerCase().includes(q) ||
          String(lot.contactNumber || '').toLowerCase().includes(q) ||
          String(lot.association || '').toLowerCase().includes(q) ||
          lot.hacienda.toLowerCase().includes(q) ||
          String(lot.barangay || '').toLowerCase().includes(q) ||
          String(lot.city || '').toLowerCase().includes(q) ||
          lot.coordText.toLowerCase().includes(q);

        return matchesStatus && matchesCity && matchesAssoc && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'harvestDate') {
          const dA = a.plannedHarvestDate || '9999-12-31';
          const dB = b.plannedHarvestDate || '9999-12-31';
          if (dA !== dB) return dA.localeCompare(dB);
          return b.areaHa - a.areaHa;
        }
        if (sortBy === 'area') return b.areaHa - a.areaHa;
        if (sortBy === 'planter') return a.planter.localeCompare(b.planter);
        if (sortBy === 'city') return String(a.city).localeCompare(String(b.city));
        return 0;
      });
  }, [
    evaluatedLots,
    statusFilter,
    cityFilter,
    associationFilter,
    searchQuery,
    sortBy,
  ]);

  const selectedLot = useMemo(
    () => evaluatedLots.find((l) => l.id === selectedLotId) || null,
    [evaluatedLots, selectedLotId]
  );

  const scheduleModalLot = useMemo(
    () => evaluatedLots.find((l) => l.id === scheduleModalLotId) || null,
    [evaluatedLots, scheduleModalLotId]
  );

  const handleQuickScheduleCut = useCallback((lot) => {
    if (!lot) return;
    setScheduleModalLotId(lot.id);
  }, []);

  const handleAddLot = async (newLot) => {
    const previousLots = rawLots;
    setRawLots((prev) => [{ ...newLot, pendingSync: true }, ...prev]);

    const res = await createFarmLot(newLot);
    if (!res.ok) {
      if (res.code === '23505') {
        setRawLots(previousLots);
        showToast('error', 'Duplicate Lot ID', res.error);
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
        `${res.error}. Queued locally and will sync when online.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((l) => (l.id === newLot.id ? { ...l, pendingSync: false } : l))
    );
    setPendingPolygonCoords(null);
    setPendingPolygonAreaHa(null);
    setPendingPolygonLat(null);
    setPendingPolygonLng(null);
    showToast('success', 'Planter Lot Registered', `${newLot.id} saved to ${res.source}.`);
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
        `${res.error}. Marked pending and survives reload.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Planter Info Updated', `${lotId} synced to ${res.source}.`);
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
        `${res.error}. Deletion queued.`
      );
      return res;
    }

    showToast('success', 'Lot Deleted', `${lotId} removed from ${res.source}.`);
    return res;
  };

  const handleUpdateLotBoundary = async (
    lotId,
    newCoords,
    newAreaHa,
    newLat,
    newLng
  ) => {
    const existingLot = evaluatedLots.find((l) => l.id === lotId) || null;
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              coordinates: newCoords,
              areaHa: newAreaHa ?? lot.areaHa,
              latitude: newLat ?? lot.latitude,
              longitude: newLng ?? lot.longitude,
              pendingSync: true,
            }
          : lot
      )
    );

    const res = await updateLotBoundary(
      lotId,
      newCoords,
      newAreaHa,
      newLat,
      newLng,
      existingLot
    );
    if (!res.ok) {
      const nextQueue = enqueuePendingOperation({
        type: 'UPDATE_BOUNDARY',
        lotId,
        payload: {
          coordinates: newCoords,
          areaHa: newAreaHa,
          latitude: newLat,
          longitude: newLng,
        },
        lastError: res.error,
      });
      setPendingOps(nextQueue);
      showToast(
        'warning',
        `Polygon Edit Pending (${lotId})`,
        `${res.error}. Saved locally and queued.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast('success', 'Field Boundary & Lat/Lng Saved', `${lotId} synced to ${res.source}.`);
    return res;
  };

  const handleCreateLotFromPolygon = (
    drawnCoords,
    calculatedAreaHa,
    centroidLat,
    centroidLng
  ) => {
    setPendingPolygonCoords(drawnCoords);
    setPendingPolygonAreaHa(calculatedAreaHa);
    setPendingPolygonLat(centroidLat);
    setPendingPolygonLng(centroidLng);
    setIsNewLotModalOpen(true);
  };

  const handleSaveDispatch = async (lotId, dispatchData) => {
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              plannedHarvestDate: dispatchData?.scheduledDate || null,
              harvestNotes: dispatchData?.notes || '',
              dispatch: { ...lot.dispatch, ...dispatchData },
              pendingSync: true,
            }
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
        `Harvest Date Pending (${lotId})`,
        `${res.error}. Queued for automatic retry.`
      );
      return res;
    }

    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, pendingSync: false } : lot
      )
    );
    showToast(
      'success',
      'Planned Harvest Date Saved',
      dispatchData?.scheduledDate
        ? `${lotId} scheduled for ${dispatchData.scheduledDate}.`
        : `${lotId} harvest date cleared.`
    );
    return res;
  };

  const handleBulkScheduleHarvest = async (lotIds, { scheduledDate, notes }) => {
    for (const id of lotIds) {
      const lotObj = evaluatedLots.find((l) => l.id === id);
      await handleSaveDispatch(id, {
        scheduledDate,
        notes: notes || '',
        contactNumber: lotObj?.contactNumber || '',
        association: lotObj?.association || 'APSSI',
        barangay: lotObj?.barangay || '',
        city: lotObj?.city || 'Silay City',
      });
    }
    showToast(
      'success',
      'Bulk Harvest Date Applied',
      `Set planned harvest date (${scheduledDate}) for ${lotIds.length} lot(s).`
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
      'Planter Name',
      'Contact Number',
      "Planter's Association",
      'Hacienda',
      'Barangay (Brgy.)',
      'City',
      'Field Hectarage (Ha)',
      'Planned Date of Harvest',
      'Schedule Status',
      'Latitude',
      'Longitude',
      'Planter Notes',
    ];

    const rows = filteredLots.map((l) => [
      l.id,
      l.planter,
      l.contactNumber,
      l.association,
      l.hacienda,
      l.barangay,
      l.city,
      l.areaHa,
      l.plannedHarvestDate || 'Not set',
      l.status,
      l.latitude,
      l.longitude,
      l.harvestNotes || '',
    ]);

    const nl = String.fromCharCode(13, 10);
    const csvLines = [
      headers.map(escapeCsvField).join(','),
      ...rows.map((row) => row.map(escapeCsvField).join(',')),
    ].join(nl);

    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom + csvLines], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'planter_harvest_schedule_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={
        'flex flex-col bg-slate-50 text-slate-900 transition-colors ' +
        (viewMode === 'map' ? 'h-screen overflow-hidden' : 'min-h-screen')
      }
    >
      <Navbar
        onOpenNewLotModal={() => {
          setPendingPolygonCoords(null);
          setPendingPolygonAreaHa(null);
          setPendingPolygonLat(null);
          setPendingPolygonLng(null);
          setIsNewLotModalOpen(true);
        }}
        dataSource={dataSource}
        isOnline={isOnline && pendingOps.length === 0}
        onRefresh={syncLots}
        onExportCsv={handleExportCsv}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        lots={evaluatedLots}
        onQuickScheduleCut={handleQuickScheduleCut}
        onSelectLot={(lot) => {
          setOpenDrawerInEditMode(false);
          setDrawerInitialTab('overview');
          setSelectedLotId(lot.id);
        }}
      />

      {viewMode === 'table' && (isOfflineCopy || pendingOps.length > 0) && (
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
              <span>Retry Sync Now</span>
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={
            'fixed top-16 right-4 z-[1200] max-w-sm w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3 transition-all duration-500 transform ' +
            (isToastLeaving
              ? 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
              : 'opacity-100 translate-y-0 scale-100')
          }
        >
          {toast.type === 'error' || toast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white">
              {toast.title}
            </h4>
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

      {/* FULL-SCREEN MAP MODE vs. DASHBOARD TABLE MODE */}
      {viewMode === 'map' ? (
        <main className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
          <ParcelMapView
            lots={evaluatedLots}
            onSelectLot={(lot) => {
              setOpenDrawerInEditMode(false);
              setDrawerInitialTab('overview');
              setSelectedLotId(lot.id);
            }}
            onUpdateLotBoundary={handleUpdateLotBoundary}
            onCreateLotFromPolygon={handleCreateLotFromPolygon}
          />
        </main>
      ) : (
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-3.5">
          <KpiStrip
            lots={evaluatedLots}
            statusFilter={statusFilter}
            onSelectStatus={setStatusFilter}
            isLoading={isLoading}
          />

          <FilterToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            cityFilter={cityFilter}
            onCityChange={setCityFilter}
            cities={cities}
            associationFilter={associationFilter}
            onAssociationChange={setAssociationFilter}
            associations={associations}
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
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
              Loading planter lots...
            </div>
          ) : (
            <PlanterTableView
              lots={filteredLots}
              density={density}
              onSelectLot={(lot) => {
                setOpenDrawerInEditMode(false);
                setDrawerInitialTab('overview');
                setSelectedLotId(lot.id);
              }}
              onEditLot={(lot) => {
                setOpenDrawerInEditMode(true);
                setDrawerInitialTab('overview');
                setSelectedLotId(lot.id);
              }}
              onQuickScheduleCut={handleQuickScheduleCut}
              onBulkScheduleHarvest={handleBulkScheduleHarvest}
            />
          )}
        </main>
      )}

      {viewMode === 'table' && (
        <NeedsAttentionPanel
          lots={evaluatedLots}
          onQuickScheduleCut={handleQuickScheduleCut}
          onSelectLot={(lot) => {
            setOpenDrawerInEditMode(false);
            setDrawerInitialTab('overview');
            setSelectedLotId(lot.id);
          }}
          isLoading={isLoading}
        />
      )}

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
        onSaveDispatch={handleSaveDispatch}
      />

      <SetHarvestDateModal
        isOpen={Boolean(scheduleModalLot)}
        lot={scheduleModalLot}
        onClose={() => setScheduleModalLotId(null)}
        onSaveDispatch={handleSaveDispatch}
      />

      <RegisterLotModal
        isOpen={isNewLotModalOpen}
        onClose={() => {
          setIsNewLotModalOpen(false);
          setPendingPolygonCoords(null);
          setPendingPolygonAreaHa(null);
          setPendingPolygonLat(null);
          setPendingPolygonLng(null);
        }}
        onAddLot={handleAddLot}
        existingLots={evaluatedLots}
        initialCoordinates={pendingPolygonCoords}
        initialAreaHa={pendingPolygonAreaHa}
        initialLatitude={pendingPolygonLat}
        initialLongitude={pendingPolygonLng}
      />
    </div>
  );
}




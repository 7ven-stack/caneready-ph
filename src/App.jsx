import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, WifiOff, X } from 'lucide-react';
import {
  evaluateLotMetrics,
  calculatePolygonAreaHa,
  computeCentroidLatLng,
} from './utils/caneCalculations';
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
  savePendingOperations,
  enqueuePendingOperation,
  replayPendingOperations,
  clearPendingOperations,
  getSavedMultiPolygonsMap,
  saveMultiPolygonsForLot,
  getAbsorbedLotIds,
  markLotsAbsorbed,
} from './services/lotService';
import { exportReportCsv, exportReportXlsx, exportReportPdf } from './utils/reportExporter';
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
  const [pageSize, setPageSize] = useState('ALL');
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState([]);
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  // Once the map tab has been opened it stays mounted (just hidden) so switching tabs
  // never rebuilds the map, reloads tiles, or re-parses a big KML layer.
  const [hasOpenedMap, setHasOpenedMap] = useState(false);

  const [selectedLotId, setSelectedLotId] = useState(null);
  const [openDrawerInEditMode, setOpenDrawerInEditMode] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState('overview');

  const [scheduleModalLotId, setScheduleModalLotId] = useState(null);
  const [isNewLotModalOpen, setIsNewLotModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [pendingPolygonCoords, setPendingPolygonCoords] = useState(null);
  const [pendingPolygonAreaHa, setPendingPolygonAreaHa] = useState(null);
  const [pendingPolygonLat, setPendingPolygonLat] = useState(null);
  const [pendingPolygonLng, setPendingPolygonLng] = useState(null);

  const showToast = useCallback((type, title, message) => {
    if (/Harvest Reminder|bell icon/i.test(String(title || '') + ' ' + String(message || ''))) {
      return;
    }
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

  // Toggle with View Transitions API for a smooth GPU-composited cross-fade.
  // Falls back to instant switch on browsers without support.
  const toggleDarkMode = useCallback(() => {
    const applyTheme = () => setDarkMode((prev) => !prev);

    if (document.startViewTransition) {
      document.startViewTransition(applyTheme);
    } else {
      applyTheme();
    }
  }, []);

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
    try {
      if (!localStorage.getItem('caneready_restored_polygons_v2')) {
        clearPendingOperations();
        localStorage.setItem('caneready_restored_polygons_v2', '1');
      }
    } catch {}
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

  const evaluatedLots = useMemo(() => {
    // Read localStorage once per recompute, not once per lot.
    const absorbedIds = getAbsorbedLotIds();
    const multiMap = getSavedMultiPolygonsMap();

    return rawLots
      .filter((lot) => !absorbedIds.has(String(lot.id)))
      .map((lot) => {
        const normalizedAssoc =
          String(lot.association || '').toLowerCase() === 'independent'
            ? 'Private'
            : lot.association || 'APSSI';

        const savedMulti =
          (Array.isArray(lot.multiCoordinates) && lot.multiCoordinates.length > 1
            ? lot.multiCoordinates
            : null) ||
          (Array.isArray(lot.label_pos?.multiCoordinates) &&
          lot.label_pos.multiCoordinates.length > 1
            ? lot.label_pos.multiCoordinates
            : null) ||
          (Array.isArray(lot.dispatch?.multiCoordinates) &&
          lot.dispatch.multiCoordinates.length > 1
            ? lot.dispatch.multiCoordinates
            : null) ||
          (Array.isArray(multiMap[lot.id]) && multiMap[lot.id].length > 1
            ? multiMap[lot.id]
            : null);

        return {
          ...evaluateLotMetrics({ ...lot, association: normalizedAssoc }),
          association: normalizedAssoc,
          multiCoordinates: savedMulti,
          parcelCount: savedMulti ? savedMulti.length : 1,
          pendingSync: Boolean(lot.pendingSync || pendingLotIds.has(lot.id)),
        };
      });
  }, [rawLots, pendingLotIds]);

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
    if (Array.isArray(newLot.multiCoordinates) && newLot.multiCoordinates.length > 1) {
      saveMultiPolygonsForLot(newLot.id, newLot.multiCoordinates);
    }
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

  
  const handleBatchAddLots = async (newLots = []) => {
    if (!Array.isArray(newLots) || newLots.length === 0) return;

    for (const lot of newLots) {
      if (Array.isArray(lot.multiCoordinates) && lot.multiCoordinates.length > 1) {
        saveMultiPolygonsForLot(lot.id, lot.multiCoordinates);
      }
    }

    setRawLots((prev) => [
      ...newLots.map((l) => ({ ...l, pendingSync: true })),
      ...prev,
    ]);

    let savedCount = 0;
    let queuedCount = 0;

    for (const lot of newLots) {
      const res = await createFarmLot(lot);
      if (res.ok) {
        savedCount++;
        setRawLots((prev) =>
          prev.map((l) => (l.id === lot.id ? { ...l, pendingSync: false } : l))
        );
      } else {
        queuedCount++;
        enqueuePendingOperation({
          type: 'CREATE_LOT',
          lotId: lot.id,
          payload: lot,
          lastError: res.error,
        });
      }
    }

    const remaining = getPendingOperations();
    setPendingOps(remaining);

    if (queuedCount > 0) {
      setDataSource(`Offline (${remaining.length} pending)`);
      showToast(
        'warning',
        `Registered ${newLots.length} Lot(s) (Pending Sync)`,
        `Saved locally and queued ${queuedCount} lot(s) for database sync.`
      );
    } else {
      showToast(
        'success',
        'KML Lots Registered',
        `Added ${savedCount} planter lot(s) directly from KML.`
      );
    }
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
      // Keep the delete in the queue so it is retried and the lot does not
      // silently reappear on the next sync.
      const nextQueue = enqueuePendingOperation({
        type: 'DELETE_LOT',
        lotId,
        payload: null,
        lastError: res.error,
      });
      setPendingOps(nextQueue);
      setDataSource(`Offline (${nextQueue.length} pending)`);
      showToast(
        'warning',
        `Delete Queued as Pending (${lotId})`,
        `${res.error}. Will retry on the next sync.`
      );
      return res;
    }

    const remaining = getPendingOperations();
    setPendingOps(remaining);
    if (remaining.length === 0) {
      setDataSource('Supabase Cloud DB');
    }
    showToast('success', 'Lot Deleted', `${lotId} removed from ${res.source}.`);
    return res;
  };

  // ---------------------------------------------------------------------
  // Merge mode handlers (App scope: used directly in the JSX below)
  // ---------------------------------------------------------------------
  const handleToggleMergeMode = () => {
    setMergeSelectedIds([]);
    setMergePrimaryId('');
    if (!isMergeMode) {
      setSelectedLotId(null);
    }
    setIsMergeMode(!isMergeMode);
  };

  const handleViewModeChange = useCallback((mode) => {
    // Merge mode only makes sense on the map; never leave it armed in the table view.
    if (mode !== 'map') {
      setIsMergeMode(false);
      setMergeSelectedIds([]);
      setMergePrimaryId('');
    }
    if (mode === 'map') setHasOpenedMap(true);
    setViewMode(mode);
  }, []);

  const handleSelectLotOrMerge = (lot) => {
    if (!lot) {
      setSelectedLotId(null);
      return;
    }

    if (isMergeMode) {
      const next = mergeSelectedIds.includes(lot.id)
        ? mergeSelectedIds.filter((id) => id !== lot.id)
        : [...mergeSelectedIds, lot.id];
      setMergeSelectedIds(next);
      if (next.length === 0) {
        setMergePrimaryId('');
      } else if (!next.includes(mergePrimaryId)) {
        setMergePrimaryId(next[0]);
      }
      return;
    }

    setOpenDrawerInEditMode(false);
    setDrawerInitialTab('overview');
    setSelectedLotId(lot.id);
  };

  // Returns true when the merge went through (so the caller can leave merge mode),
  // false when it was blocked or cancelled.
  const handleMergeLots = async (lotIds = [], preferredPrimaryId = null) => {
    if (!Array.isArray(lotIds) || lotIds.length < 2) return false;
    const selectedLots = evaluatedLots.filter((l) => lotIds.includes(l.id));
    if (selectedLots.length < 2) return false;

    const norm = (v) => String(v || '').trim().toLowerCase();

    // Largest parcel is the default primary lot when none was chosen
    const sortedByArea = [...selectedLots].sort(
      (a, b) => (Number(b.areaHa) || 0) - (Number(a.areaHa) || 0)
    );
    const primaryLot =
      selectedLots.find((l) => l.id === preferredPrimaryId) || sortedByArea[0];

    // --- Validation: only slices of the same planter may be merged -------------
    if (new Set(selectedLots.map((l) => norm(l.planter))).size > 1) {
      showToast(
        'error',
        'Cannot Merge Different Planters',
        'All selected slices must belong to the same planter.'
      );
      return false;
    }

    const differences = [];
    if (new Set(selectedLots.map((l) => norm(l.hacienda))).size > 1) {
      differences.push('hacienda');
    }
    if (new Set(selectedLots.map((l) => l.plannedHarvestDate || '')).size > 1) {
      differences.push('planned harvest date');
    }
    if (differences.length > 0) {
      const proceed = window.confirm(
        `The selected lots have different ${differences.join(' and ')}.\n\n` +
          `The merged lot keeps the details of ${primaryLot.id} and the others are discarded. Continue?`
      );
      if (!proceed) return false;
    }

    // --- Collect every slice ring (road gaps between slices are preserved) ------
    const rings = [];
    for (const lotItem of selectedLots) {
      if (
        Array.isArray(lotItem.multiCoordinates) &&
        lotItem.multiCoordinates.length > 1
      ) {
        for (const ring of lotItem.multiCoordinates) {
          if (Array.isArray(ring) && ring.length >= 3) rings.push(ring);
        }
      } else if (
        Array.isArray(lotItem.coordinates) &&
        lotItem.coordinates.length >= 3
      ) {
        rings.push(lotItem.coordinates);
      }
    }

    if (rings.length === 0) {
      showToast('error', 'Cannot Merge', 'None of the selected lots has a drawn boundary.');
      return false;
    }

    // Largest ring first: it becomes `coordinates` and is where the single map label
    // sits (Leaflet centers a multi-polygon label on its first ring).
    const allRings = rings
      .map((ring) => ({ ring, area: calculatePolygonAreaHa(ring) }))
      .sort((a, b) => b.area - a.area)
      .map((item) => item.ring);

    const anchorCentroid = computeCentroidLatLng({ coordinates: allRings[0] });

    const totalAreaHa = Number(
      selectedLots
        .reduce((sum, l) => sum + (Number(l.areaHa) || 0), 0)
        .toFixed(2)
    );

    const mergedFields = {
      areaHa: totalAreaHa,
      coordinates: allRings[0],
      latitude: anchorCentroid.latitude,
      longitude: anchorCentroid.longitude,
      multiCoordinates: allRings.length > 1 ? allRings : null,
      parcelCount: allRings.length,
    };

    // Full payload for the database write (multiCoordinates -> multi_coordinates column)
    const payload = { ...primaryLot, ...mergedFields };

    const absorbedIds = selectedLots
      .map((l) => l.id)
      .filter((id) => id !== primaryLot.id);

    // Queued ops that target absorbed lots are meaningless now: drop them first, so
    // the new ops queued below are not removed with them.
    savePendingOperations(
      getPendingOperations().filter((op) => !absorbedIds.includes(String(op.lotId)))
    );

    // Local state first so the map updates immediately
    markLotsAbsorbed(absorbedIds);
    saveMultiPolygonsForLot(primaryLot.id, allRings);
    for (const oldId of absorbedIds) {
      saveMultiPolygonsForLot(oldId, null);
    }

    setRawLots((prev) =>
      prev
        .filter((l) => !absorbedIds.includes(l.id))
        .map((l) =>
          l.id === primaryLot.id ? { ...l, ...mergedFields, pendingSync: true } : l
        )
    );

    // --- Persist. Never delete the slices unless the merged lot was saved. -------
    let queuedCount = 0;
    let firstError = null;

    const upd = await updateLotDetails(primaryLot.id, payload);
    if (upd.ok) {
      setRawLots((prev) =>
        prev.map((l) => (l.id === primaryLot.id ? { ...l, pendingSync: false } : l))
      );
      for (const oldId of absorbedIds) {
        const del = await deleteFarmLot(oldId);
        if (!del.ok) {
          enqueuePendingOperation({
            type: 'DELETE_LOT',
            lotId: oldId,
            payload: null,
            dependsOn: primaryLot.id,
            lastError: del.error,
          });
          queuedCount++;
          firstError = firstError || del.error;
        }
      }
    } else {
      firstError = upd.error;
      enqueuePendingOperation({
        type: 'UPDATE_DETAILS',
        lotId: primaryLot.id,
        payload,
        lastError: upd.error,
      });
      queuedCount++;
      for (const oldId of absorbedIds) {
        enqueuePendingOperation({
          type: 'DELETE_LOT',
          lotId: oldId,
          payload: null,
          dependsOn: primaryLot.id,
          lastError: upd.error,
        });
        queuedCount++;
      }
    }

    const remaining = getPendingOperations();
    setPendingOps(remaining);

    if (queuedCount > 0) {
      setDataSource(`Offline (${remaining.length} pending)`);
      showToast(
        'warning',
        'Merge Saved Locally, Sync Pending',
        `${firstError || 'Database write failed'}. ${queuedCount} change(s) queued and will retry on the next sync.`
      );
    } else {
      showToast(
        'success',
        'Planter Fields Merged',
        `Combined ${selectedLots.length} slices into ${primaryLot.id} (${totalAreaHa} ha total).`
      );
    }

    return true;
  };

  const handleUpdateLotBoundary = async (
    lotId,
    newCoords,
    newAreaHa,
    newLat,
    newLng
  ) => {
    const existingLot = evaluatedLots.find((l) => l.id === lotId) || null;

    // Reshaping a merged lot would overwrite one slice and corrupt the total area.
    if (
      existingLot &&
      Array.isArray(existingLot.multiCoordinates) &&
      existingLot.multiCoordinates.length > 1
    ) {
      showToast(
        'warning',
        'Merged Lot Cannot Be Reshaped',
        `${lotId} is made of ${existingLot.multiCoordinates.length} slices. Reshape is only available for single-polygon lots.`
      );
      return { ok: false, error: 'Merged lots cannot be reshaped.' };
    }

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

  const handleExportCsv = (requestedFormat) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const baseName = `CaneReadyPH_Harvest_Schedule_${todayStr}`;

    if (requestedFormat === 'csv') {
      exportReportCsv(filteredLots, baseName);
      setIsExportModalOpen(false);
      showToast('success', 'CSV Exported', `Downloaded ${baseName}.csv (${filteredLots.length} lots).`);
      return;
    }
    if (requestedFormat === 'xlsx') {
      exportReportXlsx(filteredLots, baseName);
      setIsExportModalOpen(false);
      showToast('success', 'Excel (.xlsx) Exported', `Downloaded ${baseName}.xlsx (${filteredLots.length} lots).`);
      return;
    }
    if (requestedFormat === 'pdf') {
      exportReportPdf(filteredLots, baseName);
      setIsExportModalOpen(false);
      showToast('success', 'PDF Report Exported', `Downloaded ${baseName}.pdf (${filteredLots.length} lots).`);
      return;
    }

    setIsExportModalOpen(true);
  };
  return (
    <div
      className={
        'flex flex-col bg-slate-50 text-slate-900 transition-colors ' +
        'h-screen overflow-hidden'
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
        onToggleDarkMode={toggleDarkMode}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
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
                {pendingOps.some((o) => o.lastError) && (
                  <span className="block mt-0.5 font-normal text-[11px] text-amber-800 dark:text-amber-300 break-words">
                    Last error:{' '}
                    {Array.from(
                      new Set(pendingOps.map((o) => o.lastError).filter(Boolean))
                    )
                      .slice(0, 2)
                      .join(' | ')}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={syncLots}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-800 hover:bg-amber-900 text-white font-bold text-[11px]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry Sync Now</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Discard ${pendingOps.length} unsynced change(s)? They will NOT be saved to the database.`
                    )
                  ) {
                    return;
                  }
                  clearPendingOperations();
                  setPendingOps([]);
                  setRawLots((prev) =>
                    prev.map((l) => ({ ...l, pendingSync: false }))
                  );
                  setDataSource('Supabase Cloud DB');
                  showToast('info', 'Pending Queue Cleared', 'Cleared stuck local queue items.');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 hover:bg-amber-100 text-amber-900 dark:text-amber-200 font-semibold text-[11px]"
              >
                <X className="w-3 h-3" />
                <span>Dismiss Pending</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={
            'fixed bottom-5 left-1/2 -translate-x-1/2 z-[1400] max-w-sm w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3 transition-all duration-500 transform ' +
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
      {hasOpenedMap && (
        <main
          className={
            'flex-1 min-h-0 w-full flex-col overflow-hidden ' +
            (viewMode === 'map' ? 'flex' : 'hidden')
          }
        >
                    {viewMode === 'map' && isMergeMode && (() => {
            const selectedLotsList = evaluatedLots.filter((l) =>
              mergeSelectedIds.includes(l.id)
            );
            const combinedAreaHa = selectedLotsList
              .reduce((s, l) => s + (Number(l.areaHa) || 0), 0)
              .toFixed(2);

            const firstLot = selectedLotsList[0] || null;
            const hasPlanterConflict =
              new Set(
                selectedLotsList.map((l) =>
                  String(l.planter || '').trim().toLowerCase()
                )
              ).size > 1;

            const samePlanterLots = firstLot
              ? evaluatedLots.filter(
                  (l) =>
                    l.planter.toLowerCase() === firstLot.planter.toLowerCase() &&
                    l.hacienda.toLowerCase() === firstLot.hacienda.toLowerCase() &&
                    l.plannedHarvestDate === firstLot.plannedHarvestDate
                )
              : [];

            const canAutoSelectAll =
              firstLot &&
              !hasPlanterConflict &&
              samePlanterLots.length > mergeSelectedIds.length;

            return (
              <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1250] w-[calc(100vw-1.5rem)] max-w-[660px] bg-slate-950/95 text-slate-100 px-3.5 py-2.5 rounded-xl shadow-2xl border border-violet-500/50 backdrop-blur-md flex items-center justify-between gap-3 text-xs select-none">
                <div
                  className="flex items-center gap-2.5 shrink-0"
                  title={
                    mergeSelectedIds.length > 0
                      ? `Selected Lots: ${mergeSelectedIds.join(', ')}`
                      : 'Click polygons on the map to select'
                  }
                >
                  <span className="px-2.5 py-1 rounded-lg bg-violet-600 text-white font-extrabold text-[11px] tabular-nums tracking-wide shadow-2xs">
                    {mergeSelectedIds.length}{' '}
                    {mergeSelectedIds.length === 1 ? 'slice' : 'slices'}
                  </span>

                  {mergeSelectedIds.length > 0 && (
                    <div className="flex flex-col leading-tight">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                        Combined Area
                      </span>
                      <span className="font-mono font-extrabold text-emerald-400 text-xs tabular-nums">
                        {combinedAreaHa} ha
                      </span>
                    </div>
                  )}

                  {mergeSelectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setMergeSelectedIds([]);
                        setMergePrimaryId('');
                      }}
                      title="Clear selected slices"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5"/>
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex items-center justify-center gap-2 border-x border-slate-800/90 px-3">
                  {mergeSelectedIds.length === 0 && (
                    <span className="text-[11px] font-medium text-slate-300 truncate">
                      Click 2 or more slices of the same planter to merge
                    </span>
                  )}

                  {mergeSelectedIds.length === 1 && (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-slate-300 truncate">
                        Select 1 more slice for{' '}
                        <strong className="text-white">{firstLot?.planter}</strong>
                      </span>
                      {canAutoSelectAll && (
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = samePlanterLots.map((l) => l.id);
                            setMergeSelectedIds(allIds);
                            if (!mergePrimaryId) setMergePrimaryId(allIds[0]);
                          }}
                          className="px-2 py-0.5 rounded-md bg-violet-950 hover:bg-violet-900 text-violet-200 border border-violet-700/80 font-bold text-[10px] shrink-0 transition-colors cursor-pointer"
                        >
                          +All {samePlanterLots.length} slices
                        </button>
                      )}
                    </div>
                  )}

                  {mergeSelectedIds.length >= 2 && hasPlanterConflict && (
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px] truncate">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0"/>
                      <span className="truncate">
                        Slices must belong to the same planter
                      </span>
                    </div>
                  )}

                  {mergeSelectedIds.length >= 2 && !hasPlanterConflict && (
                    <div className="flex items-center gap-2 w-full max-w-[270px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                        Keep ID
                      </span>
                      <select
                        value={mergePrimaryId || mergeSelectedIds[0]}
                        onChange={(e) => setMergePrimaryId(e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-violet-500 truncate cursor-pointer"
                      >
                        {selectedLotsList.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.id} — {l.planter} ({Number(l.areaHa).toFixed(2)} ha)
                          </option>
                        ))}
                      </select>

                      {canAutoSelectAll && (
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = samePlanterLots.map((l) => l.id);
                            setMergeSelectedIds(allIds);
                            if (!mergePrimaryId) setMergePrimaryId(allIds[0]);
                          }}
                          title={`Select all ${samePlanterLots.length} matching slices for ${firstLot.planter}`}
                          className="px-2 py-1 rounded-lg bg-violet-950 hover:bg-violet-900 text-violet-200 border border-violet-700/80 font-bold text-[10px] shrink-0 transition-colors cursor-pointer"
                        >
                          +All {samePlanterLots.length}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={
                      mergeSelectedIds.length < 2 ||
                      hasPlanterConflict ||
                      isMerging
                    }
                    onClick={async () => {
                      setIsMerging(true);
                      try {
                        const merged = await handleMergeLots(
                          mergeSelectedIds,
                          mergePrimaryId || mergeSelectedIds[0]
                        );
                        if (merged) {
                          setIsMergeMode(false);
                          setMergeSelectedIds([]);
                          setMergePrimaryId('');
                        }
                      } finally {
                        setIsMerging(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5"/>
                    <span>{isMerging ? 'Merging...' : 'Merge'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMergeMode}
                    title="Exit Merge Mode"
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            );
          })()}          <ParcelMapView
            isActive={viewMode === 'map'}
            lots={evaluatedLots}
            isMergeMode={isMergeMode}
            mergeSelectedIds={mergeSelectedIds}
            onToggleMergeMode={handleToggleMergeMode}
            onSelectLot={handleSelectLotOrMerge}
            onUpdateLotBoundary={handleUpdateLotBoundary}
            onCreateLotFromPolygon={handleCreateLotFromPolygon}
            onQuickAddLot={handleAddLot}
            onBatchAddLots={handleBatchAddLots}
          />
        </main>
      )}

      {viewMode !== 'map' && (
        <main className="flex-1 min-h-0 max-w-[1560px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 flex flex-col gap-2.5 overflow-hidden">
          <div className="shrink-0">
            <KpiStrip
              lots={evaluatedLots}
              statusFilter={statusFilter}
              onSelectStatus={setStatusFilter}
              isLoading={isLoading}
            />
          </div>

          <div className="shrink-0">
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
              onViewModeChange={handleViewModeChange}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              allLots={evaluatedLots}
              filteredCount={filteredLots.length}
              density={density}
              onDensityChange={setDensity}
            />
          </div>

          {isLoading && evaluatedLots.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
              Loading planter lots...
            </div>
          ) : (
            <PlanterTableView
              onMergeLots={handleMergeLots}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
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
          suppressed={Boolean(selectedLotId)}
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

      {isExportModalOpen && (
        <div
          onClick={() => setIsExportModalOpen(false)}
          className="fixed inset-0 z-[1500] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden select-none"
          >
            <div className="h-1.5 w-full bg-emerald-600" />
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Select Export Format
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Exporting <strong>{filteredLots.length}</strong> planter lots (
                    <strong>
                      {filteredLots
                        .reduce((s, l) => s + (Number(l.areaHa) || 0), 0)
                        .toFixed(2)}{' '}
                      ha
                    </strong>
                    ) • Organized without Lot ID
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleExportCsv('xlsx')}
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      XLSX
                    </span>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        Excel Workbook (.xlsx)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Auto-sized columns, styled header &amp; total summary row
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                    Download
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCsv('pdf')}
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-500 dark:hover:border-rose-500 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-rose-50/40 dark:hover:bg-rose-950/30 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-rose-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      PDF
                    </span>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">
                        PDF Report (.pdf)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Landscape A4 official report table ready for printing
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] shrink-0">
                    Download
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCsv('csv')}
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-sky-50/40 dark:hover:bg-sky-950/30 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-sky-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      CSV
                    </span>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        CSV Spreadsheet (.csv)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Universal comma-separated text file for Excel &amp; GIS
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold text-[11px] shrink-0">
                    Download
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}    </div>
  );
}




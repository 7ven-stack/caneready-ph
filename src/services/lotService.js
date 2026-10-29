import { createClient } from '@supabase/supabase-js';
import { INITIAL_LOTS } from '../data/initialLots';
import {
  computeCropAgeMonths,
  computeCentroidLatLng,
  buildPolygonFromLatLng,
} from '../utils/caneCalculations';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const LOTS_CACHE_KEY = 'caneready_lots_v1';
export const PENDING_OPS_KEY = 'caneready_pending_ops_v1';
const MULTI_POLYGONS_KEY = 'caneready_multipolygons_v1';
const ABSORBED_IDS_KEY = 'caneready_absorbed_lot_ids_v1';

// Required once in the Supabase SQL editor so merged lots can store every slice:
//   alter table farm_lots add column if not exists multi_coordinates jsonb;
export const MULTI_COORDINATES_SQL =
  'alter table farm_lots add column if not exists multi_coordinates jsonb;';

export const supabase =
  SUPABASE_URL && SUPABASE_KEY && !SUPABASE_KEY.includes('PASTE_YOUR')
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export function safeJsonParse(raw, fallback = null) {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Accepts an array (or JSON string) of rings. Returns an array of valid rings
// when there are 2+ of them, otherwise null (a single ring is just `coordinates`).
export function normalizeMultiCoordinates(raw) {
  const parsed = typeof raw === 'string' ? safeJsonParse(raw, null) : raw;
  if (!Array.isArray(parsed)) return null;
  const rings = parsed.filter(
    (ring) =>
      Array.isArray(ring) &&
      ring.length >= 3 &&
      ring.every(
        (pt) =>
          Array.isArray(pt) &&
          pt.length >= 2 &&
          Number.isFinite(Number(pt[0])) &&
          Number.isFinite(Number(pt[1]))
      )
  );
  return rings.length > 1 ? rings : null;
}

export function loadCachedLots() {
  try {
    const raw = localStorage.getItem(LOTS_CACHE_KEY);
    const parsed = safeJsonParse(raw, null);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { lots: parsed, isCache: true };
    }
  } catch {}
  return { lots: INITIAL_LOTS, isCache: false };
}

export function saveCachedLots(lots) {
  try {
    if (Array.isArray(lots)) {
      localStorage.setItem(LOTS_CACHE_KEY, JSON.stringify(lots));
    }
  } catch {}
}

export function getPendingOperations() {
  try {
    const raw = localStorage.getItem(PENDING_OPS_KEY);
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePendingOperations(ops) {
  try {
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops));
  } catch {}
}

export function enqueuePendingOperation(op) {
  const current = getPendingOperations();
  const filtered = current.filter(
    (item) =>
      !(item.lotId === op.lotId && item.type === op.type && op.type !== 'CREATE_LOT')
  );
  const entry = {
    opId:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'op-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    ...op,
  };
  const next = [...filtered, entry];
  savePendingOperations(next);
  return next;
}

// Also looks at IDs that were absorbed by a merge, so a freshly registered lot
// can never reuse an ID that is hidden by the absorbed list.
export function generateSequentialLotId(existingLots = [], cityOrSector = 'Silay City') {
  const match = String(cityOrSector).match(/^([A-Z])/i);
  const letter = match ? match[1].toUpperCase() : 'A';
  let maxNum = 100;
  const regex = /^LOT-[A-Z](\d+)$/i;

  const knownIds = [
    ...existingLots.filter((lot) => lot?.id).map((lot) => String(lot.id).trim()),
    ...Array.from(getAbsorbedLotIds()),
  ];

  for (const id of knownIds) {
    const m = id.match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }

  let candidate = `LOT-${letter}${maxNum + 1}`;
  const existingIds = new Set(knownIds.map((id) => id.toUpperCase()));
  let step = 2;
  while (existingIds.has(candidate.toUpperCase())) {
    candidate = `LOT-${letter}${maxNum + step}`;
    step++;
  }
  return candidate;
}

function parseCoordinates(row, labelPos, areaHa) {
  if (Array.isArray(row.coordinates) && row.coordinates.length >= 3) {
    return row.coordinates;
  }
  if (typeof row.svg_points === 'string' && row.svg_points.trim().startsWith('[')) {
    const parsed = safeJsonParse(row.svg_points, null);
    if (Array.isArray(parsed) && parsed.length >= 3) return parsed;
  }
  if (labelPos && Number.isFinite(Number(labelPos.lat)) && Number.isFinite(Number(labelPos.lng))) {
    return buildPolygonFromLatLng(Number(labelPos.lat), Number(labelPos.lng), areaHa);
  }
  const fallback = INITIAL_LOTS.find((l) => l.id === row.id);
  return fallback ? fallback.coordinates : null;
}

function fromSqlRow(row) {
  const fallbackSeed = INITIAL_LOTS.find((l) => l.id === row.id) || {};
  const plantingDate = row.planting_date ?? row.plantingDate ?? '2025-11-01';
  const storedAge = Number(row.crop_age_months ?? row.cropAgeMonths ?? 0);
  const cropAgeMonths = computeCropAgeMonths(plantingDate, storedAge);
  const areaHa = Number(row.area_ha ?? row.areaHa ?? 0);

  const labelPos =
    typeof row.label_pos === 'string'
      ? safeJsonParse(row.label_pos, null)
      : row.label_pos ?? null;

  const dispatchObj =
    typeof row.dispatch === 'string'
      ? safeJsonParse(row.dispatch, null)
      : row.dispatch ?? null;

  const coordinates = parseCoordinates(row, labelPos, areaHa);
  const centroid = computeCentroidLatLng({
    coordinates,
    latitude: row.latitude ?? labelPos?.lat,
    longitude: row.longitude ?? labelPos?.lng,
  });

  // Merged lots: every slice ring lives in the multi_coordinates column
  // (camelCase `multiCoordinates` is what cached / queued lots already use).
  const multiCoordinates = normalizeMultiCoordinates(
    row.multi_coordinates ??
      row.multiCoordinates ??
      labelPos?.multiCoordinates ??
      dispatchObj?.multiCoordinates ??
      null
  );

  const contactNumber =
    row.contactNumber ??
    row.contact_number ??
    labelPos?.contactNumber ??
    dispatchObj?.contactNumber ??
    fallbackSeed.contactNumber ??
    '';

  const association =
    row.association ??
    labelPos?.association ??
    dispatchObj?.association ??
    fallbackSeed.association ??
    'APSSI';

  const barangay =
    row.barangay ??
    labelPos?.barangay ??
    dispatchObj?.barangay ??
    fallbackSeed.barangay ??
    'Brgy. Hawaiian';

  const city =
    row.city ??
    labelPos?.city ??
    dispatchObj?.city ??
    fallbackSeed.city ??
    'Silay City';

  const plannedHarvestDate =
    row.plannedHarvestDate ?? dispatchObj?.scheduledDate ?? null;
  const harvestNotes =
    row.harvestNotes ?? dispatchObj?.notes ?? dispatchObj?.brigadeLeader ?? '';

  return {
    id: row.id,
    hacienda: row.hacienda,
    planter: row.planter,
    contactNumber,
    association,
    barangay,
    city,
    sector: row.sector || `${city} (${barangay})`,
    variety: row.variety || 'Phil 2006-2289',
    cropClass: row.crop_class ?? row.cropClass ?? 'Plant Cane',
    areaHa,
    expectedTcHa: Number(row.expected_tc_ha ?? row.expectedTcHa ?? 75),
    plantingDate,
    cropAgeMonths,
    plannedHarvestDate,
    harvestNotes,
    latitude: centroid.latitude,
    longitude: centroid.longitude,
    coordinates,
    multiCoordinates,
    dispatch: {
      scheduledDate: plannedHarvestDate,
      notes: harvestNotes,
      contactNumber,
      association,
      barangay,
      city,
    },
  };
}

export function mergeLotsWithPendingOps(remoteLots, pendingOps = getPendingOperations()) {
  if (!Array.isArray(pendingOps) || pendingOps.length === 0) {
    return remoteLots.map((l) => ({ ...l, pendingSync: false }));
  }

  const lotMap = new Map(
    remoteLots.map((lot) => [lot.id, { ...lot, pendingSync: false }])
  );

  for (const op of pendingOps) {
    const { type, lotId, payload } = op;
    if (type === 'CREATE_LOT' && payload) {
      lotMap.set(lotId, { ...fromSqlRow(payload), pendingSync: true });
    } else if (type === 'DELETE_LOT') {
      lotMap.delete(lotId);
    } else if (lotMap.has(lotId)) {
      const current = lotMap.get(lotId);
      if (type === 'UPDATE_DETAILS') {
        lotMap.set(lotId, { ...current, ...payload, pendingSync: true });
      } else if (type === 'UPDATE_BOUNDARY') {
        lotMap.set(lotId, {
          ...current,
          coordinates: payload.coordinates,
          areaHa: payload.areaHa ?? current.areaHa,
          latitude: payload.latitude ?? current.latitude,
          longitude: payload.longitude ?? current.longitude,
          pendingSync: true,
        });
      } else if (type === 'UPDATE_DISPATCH') {
        lotMap.set(lotId, {
          ...current,
          plannedHarvestDate: payload.dispatch?.scheduledDate ?? null,
          harvestNotes: payload.dispatch?.notes ?? '',
          dispatch: { ...current.dispatch, ...payload.dispatch },
          pendingSync: true,
        });
      }
    }
  }

  return Array.from(lotMap.values());
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2200) {
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

function formatSupabaseError(error) {
  if (!error) return 'Unknown Supabase error';
  if (error.code === '23505') {
    return 'Lot ID already exists (PK conflict 23505). Please use the next sequential ID.';
  }
  return error.message || String(error);
}

export async function fetchAllLots() {
  const pendingOps = getPendingOperations();
  let lastErrorMsg = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        lastErrorMsg = `Supabase read error: ${formatSupabaseError(error)}`;
      } else if (Array.isArray(data)) {
        const merged = mergeLotsWithPendingOps(data.map(fromSqlRow), pendingOps);
        saveCachedLots(merged);
        return {
          ok: true,
          lots: merged,
          source: 'Supabase Cloud DB',
          online: true,
          isOfflineCopy: false,
          error: null,
        };
      }
    } catch (err) {
      lastErrorMsg = `Supabase network failure: ${err.message}`;
    }
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/lots`);
    if (res.ok) {
      const data = await res.json();
      const merged = mergeLotsWithPendingOps(data.map(fromSqlRow), pendingOps);
      saveCachedLots(merged);
      return {
        ok: true,
        lots: merged,
        source: 'Express API Server',
        online: true,
        isOfflineCopy: false,
        error: null,
      };
    }
  } catch (err) {
    if (!lastErrorMsg) {
      lastErrorMsg = `Offline (${err.message})`;
    }
  }

  const { lots: cachedLots, isCache } = loadCachedLots();
  const mergedOffline = mergeLotsWithPendingOps(cachedLots.map(fromSqlRow), pendingOps);
  return {
    ok: false,
    lots: mergedOffline,
    source: isCache ? 'Offline copy (cached)' : 'Offline copy (demo data)',
    online: false,
    isOfflineCopy: true,
    error: lastErrorMsg || 'Database unreachable. Showing offline copy.',
  };
}

export async function createFarmLot(newLot) {
  let supabaseError = null;
  const todayIso = new Date().toISOString().split('T')[0];

  const metaPayload = {
    lat: Number(newLot.latitude) || 10.8185,
    lng: Number(newLot.longitude) || 123.0145,
    contactNumber: newLot.contactNumber || '',
    association: newLot.association || 'APSSI',
    barangay: newLot.barangay || '',
    city: newLot.city || 'Silay City',
  };

  const dispatchPayload = {
    scheduledDate: newLot.plannedHarvestDate || null,
    notes: newLot.harvestNotes || '',
    contactNumber: newLot.contactNumber || '',
    association: newLot.association || 'APSSI',
    barangay: newLot.barangay || '',
    city: newLot.city || 'Silay City',
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .insert([
          {
            id: newLot.id,
            hacienda: newLot.hacienda,
            planter: newLot.planter,
            sector: newLot.city
              ? `${newLot.city} - ${newLot.barangay || ''}`
              : newLot.sector || 'Silay City',
            variety: newLot.variety || 'Phil 2006-2289',
            crop_class: newLot.cropClass || 'Plant Cane',
            area_ha: newLot.areaHa,
            expected_tc_ha: newLot.expectedTcHa || 75,
            planting_date: newLot.plantingDate || todayIso,
            crop_age_months: newLot.cropAgeMonths || 0,
            svg_points: newLot.coordinates ? JSON.stringify(newLot.coordinates) : null,
            label_pos: metaPayload,
            dispatch: dispatchPayload,
          },
        ])
        .select();

      if (error) {
        if (error.code === '23505') {
          return {
            ok: false,
            code: '23505',
            error: formatSupabaseError(error),
            source: 'Supabase Cloud DB',
          };
        }
        supabaseError = formatSupabaseError(error);
      } else if (!data || data.length === 0) {
        supabaseError = 'Insert blocked by Supabase RLS policy (0 rows returned).';
      } else {
        return { ok: true, error: null, source: 'Supabase Cloud DB', data: data[0] };
      }
    } catch (err) {
      supabaseError = err.message;
    }
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/lots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLot),
    });
    if (res.status === 409) {
      return {
        ok: false,
        code: '23505',
        error: `Lot ID "${newLot.id}" already exists.`,
        source: 'Express API Server',
      };
    }
    if (res.ok) {
      return { ok: true, error: null, source: 'Express API Server' };
    }
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Write failed while offline (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }

  return {
    ok: false,
    error: supabaseError || 'Failed to save lot',
    source: 'Supabase Cloud DB',
  };
}

export async function updateLotDetails(lotId, updates) {
  let supabaseError = null;

  const metaPayload = {
    lat: Number(updates.latitude) || 10.8185,
    lng: Number(updates.longitude) || 123.0145,
    contactNumber: updates.contactNumber || '',
    association: updates.association || 'APSSI',
    barangay: updates.barangay || '',
    city: updates.city || 'Silay City',
  };

  const dispatchPayload = {
    scheduledDate: updates.plannedHarvestDate || null,
    notes: updates.harvestNotes || '',
    contactNumber: updates.contactNumber || '',
    association: updates.association || 'APSSI',
    barangay: updates.barangay || '',
    city: updates.city || 'Silay City',
  };

  const row = {
    hacienda: updates.hacienda,
    planter: updates.planter,
    sector: updates.city
      ? `${updates.city} - ${updates.barangay || ''}`
      : updates.sector,
    variety: updates.variety,
    crop_class: updates.cropClass,
    area_ha: updates.areaHa,
    expected_tc_ha: updates.expectedTcHa || 75,
    planting_date: updates.plantingDate,
    crop_age_months: updates.cropAgeMonths || 0,
    svg_points: updates.coordinates ? JSON.stringify(updates.coordinates) : undefined,
    label_pos: metaPayload,
    dispatch: dispatchPayload,
  };

  // Only touch the multi_coordinates column when the caller explicitly passes it,
  // so ordinary edits never wipe (or require) the column.
  if (Object.prototype.hasOwnProperty.call(updates, 'multiCoordinates')) {
    row.multi_coordinates = normalizeMultiCoordinates(updates.multiCoordinates);
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .update(row)
        .eq('id', lotId)
        .select();

      if (error) {
        supabaseError = /multi_coordinates/i.test(error.message || '')
          ? `Database column "multi_coordinates" is missing. Run in the Supabase SQL editor: ${MULTI_COORDINATES_SQL}`
          : formatSupabaseError(error);
      } else if (!data || data.length === 0) {
        supabaseError = `Update for ${lotId} blocked by RLS policy or row missing.`;
      } else {
        return { ok: true, error: null, source: 'Supabase Cloud DB', data: data[0] };
      }
    } catch (err) {
      supabaseError = err.message;
    }
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/lots/${lotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      return { ok: true, error: null, source: 'Express API Server' };
    }
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Update failed while offline (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }

  return {
    ok: false,
    error: supabaseError || 'Update failed',
    source: 'Supabase Cloud DB',
  };
}

export async function updateLotBoundary(lotId, coordinates, areaHa, latitude, longitude, existingLot = null) {
  let supabaseError = null;

  const metaPayload = {
    lat: Number(latitude) || 10.8185,
    lng: Number(longitude) || 123.0145,
    contactNumber: existingLot?.contactNumber || '',
    association: existingLot?.association || 'APSSI',
    barangay: existingLot?.barangay || '',
    city: existingLot?.city || 'Silay City',
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .update({
          svg_points: JSON.stringify(coordinates),
          area_ha: areaHa,
          label_pos: metaPayload,
        })
        .eq('id', lotId)
        .select();

      if (error) {
        supabaseError = formatSupabaseError(error);
      } else if (!data || data.length === 0) {
        supabaseError = `Boundary update for ${lotId} blocked by RLS policy.`;
      } else {
        return { ok: true, error: null, source: 'Supabase Cloud DB', data: data[0] };
      }
    } catch (err) {
      supabaseError = err.message;
    }
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/lots/${lotId}/boundary`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates, areaHa, latitude, longitude }),
    });
    if (res.ok) {
      return { ok: true, error: null, source: 'Express API Server' };
    }
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Boundary save failed (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }

  return {
    ok: false,
    error: supabaseError || 'Boundary save failed',
    source: 'Supabase Cloud DB',
  };
}

export async function updateLotDispatch(lotId, dispatchData) {
  let supabaseError = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .update({ dispatch: dispatchData })
        .eq('id', lotId)
        .select();

      if (error) {
        supabaseError = formatSupabaseError(error);
      } else if (!data || data.length === 0) {
        supabaseError = `Harvest date update for ${lotId} blocked by RLS policy.`;
      } else {
        return { ok: true, error: null, source: 'Supabase Cloud DB', data: data[0] };
      }
    } catch (err) {
      supabaseError = err.message;
    }
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/lots/${lotId}/dispatch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatch: dispatchData }),
    });
    if (res.ok) {
      return { ok: true, error: null, source: 'Express API Server' };
    }
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Harvest schedule save failed (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }

  return {
    ok: false,
    error: supabaseError || 'Harvest schedule save failed',
    source: 'Supabase Cloud DB',
  };
}

export async function deleteFarmLot(lotId) {
  let supabaseError = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .delete()
        .eq('id', lotId)
        .select();

      if (error) {
        supabaseError = formatSupabaseError(error);
      } else if (!data || data.length === 0) {
        // 0 rows deleted: either the row is already gone (fine, delete is idempotent)
        // or RLS blocked it. Check which, so a replayed delete cannot get stuck forever.
        const { data: stillThere, error: checkError } = await supabase
          .from('farm_lots')
          .select('id')
          .eq('id', lotId)
          .limit(1);
        if (!checkError && Array.isArray(stillThere) && stillThere.length === 0) {
          return { ok: true, error: null, source: 'Supabase Cloud DB' };
        }
        supabaseError = `Delete for ${lotId} blocked by Supabase RLS (missing DELETE policy).`;
      } else {
        return { ok: true, error: null, source: 'Supabase Cloud DB' };
      }
    } catch (err) {
      supabaseError = err.message;
    }
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/lots/${lotId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return { ok: true, error: null, source: 'Express API Server' };
    }
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Delete failed while offline (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }

  return {
    ok: false,
    error: supabaseError || 'Delete failed',
    source: 'Supabase Cloud DB',
  };
}

export async function replayPendingOperations() {
  const queue = getPendingOperations();
  if (queue.length === 0) {
    return { replayed: 0, remaining: 0, errors: [] };
  }

  let replayed = 0;
  const remainingOps = [];
  const errors = [];
  // Lots whose op failed during this replay. An op with `dependsOn` (e.g. deleting a
  // slice that was merged into another lot) waits until that lot has synced first.
  const failedLotIds = new Set();

  for (const op of queue) {
    if (op.dependsOn && failedLotIds.has(String(op.dependsOn))) {
      remainingOps.push(op);
      errors.push({
        lotId: op.lotId,
        type: op.type,
        error: `Waiting for ${op.dependsOn} to sync first`,
      });
      continue;
    }

    let result = { ok: false, error: 'Unknown operation' };

    if (op.type === 'CREATE_LOT') {
      result = await createFarmLot(op.payload);
      if (!result.ok && result.code === '23505') {
        result = { ok: true, error: null };
      }
    } else if (op.type === 'UPDATE_DETAILS') {
      result = await updateLotDetails(op.lotId, op.payload);
    } else if (op.type === 'UPDATE_BOUNDARY') {
      result = await updateLotBoundary(
        op.lotId,
        op.payload.coordinates,
        op.payload.areaHa,
        op.payload.latitude,
        op.payload.longitude
      );
    } else if (op.type === 'UPDATE_DISPATCH') {
      result = await updateLotDispatch(op.lotId, op.payload.dispatch);
    } else if (op.type === 'DELETE_LOT') {
      result = await deleteFarmLot(op.lotId);
    }

    if (result.ok) {
      replayed++;
    } else {
      failedLotIds.add(String(op.lotId));
      remainingOps.push({ ...op, lastError: result.error });
      errors.push({ lotId: op.lotId, type: op.type, error: result.error });
    }
  }

  savePendingOperations(remainingOps);
  return { replayed, remaining: remainingOps.length, errors };
}

export function clearPendingOperations() {
  try {
    Object.keys(localStorage).forEach((key) => {
      const k = key.toLowerCase();
      // Only touch this app's keys (localhost is shared with other projects).
      if (k.startsWith('caneready_') && (k.includes('pending') || k.includes('cache'))) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {}
  return [];
}

export function getSavedMultiPolygonsMap() {
  try {
    const raw = localStorage.getItem(MULTI_POLYGONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveMultiPolygonsForLot(lotId, rings) {
  try {
    const map = getSavedMultiPolygonsMap();
    if (Array.isArray(rings) && rings.length > 1) {
      map[String(lotId)] = rings;
    } else {
      delete map[String(lotId)];
    }
    localStorage.setItem(MULTI_POLYGONS_KEY, JSON.stringify(map));
  } catch {}
}

export function getAbsorbedLotIds() {
  try {
    const raw = localStorage.getItem(ABSORBED_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markLotsAbsorbed(lotIds = []) {
  try {
    const set = getAbsorbedLotIds();
    for (const id of lotIds) {
      set.add(String(id));
    }
    localStorage.setItem(ABSORBED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

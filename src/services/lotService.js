import { createClient } from '@supabase/supabase-js';
import { INITIAL_LOTS } from '../data/initialLots';
import { computeCropAgeMonths } from '../utils/caneCalculations';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const LOTS_CACHE_KEY = 'caneready_lots_v1';
export const PENDING_OPS_KEY = 'caneready_pending_ops_v1';

export const supabase =
  SUPABASE_URL && SUPABASE_KEY && !SUPABASE_KEY.includes('PASTE_YOUR')
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export function safeJsonParse(raw, fallback = null) {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[CaneReadyPH] Corrupted JSON in storage, using fallback:', err.message);
    return fallback;
  }
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
  } catch (err) {
    console.warn('[CaneReadyPH] Failed to cache lots:', err.message);
  }
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
  } catch (err) {
    console.warn('[CaneReadyPH] Failed to persist pending ops:', err.message);
  }
}

export function enqueuePendingOperation(op) {
  const current = getPendingOperations();
  const filtered = current.filter(
    (item) => !(item.lotId === op.lotId && item.type === op.type && op.type !== 'CREATE_LOT')
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

export function generateSequentialLotId(existingLots = [], sector = 'Sector A - North') {
  const sectorMatch = String(sector).match(/Sector\s+([A-Z])/i);
  const letter = sectorMatch ? sectorMatch[1].toUpperCase() : 'A';
  const sectorBase = { A: 100, B: 200, C: 300, D: 400 }[letter] || 100;

  let maxNum = sectorBase;
  const prefixRegex = new RegExp('^LOT-' + letter + '(\\d+)$', 'i');

  for (const lot of existingLots) {
    if (!lot?.id) continue;
    const m = String(lot.id).trim().match(prefixRegex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }

  let candidate = `LOT-${letter}${maxNum + 1}`;
  const existingIds = new Set(existingLots.map((l) => String(l.id).toUpperCase()));
  let step = 2;
  while (existingIds.has(candidate.toUpperCase())) {
    candidate = `LOT-${letter}${maxNum + step}`;
    step++;
  }
  return candidate;
}

function parseCoordinates(row) {
  if (Array.isArray(row.coordinates) && row.coordinates.length >= 3) {
    return row.coordinates;
  }
  if (typeof row.svg_points === 'string' && row.svg_points.trim().startsWith('[')) {
    const parsed = safeJsonParse(row.svg_points, null);
    if (Array.isArray(parsed) && parsed.length >= 3) return parsed;
  }
  const fallback = INITIAL_LOTS.find((l) => l.id === row.id);
  return fallback ? fallback.coordinates : null;
}

function toNullableNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

// 1b & 1c. Preserve null on top_brix / bottom_brix / last_sampled / soil_moisture and compute age from planting_date
function fromSqlRow(row) {
  const plantingDate = row.planting_date ?? row.plantingDate ?? null;
  const storedAge = toNullableNumber(row.crop_age_months ?? row.cropAgeMonths);
  const cropAgeMonths = computeCropAgeMonths(plantingDate, storedAge);

  const topBrix = toNullableNumber(row.top_brix ?? row.topBrix);
  const bottomBrix = toNullableNumber(row.bottom_brix ?? row.bottomBrix);
  const hasSample = topBrix !== null && bottomBrix !== null;

  return {
    id: row.id,
    hacienda: row.hacienda,
    planter: row.planter,
    sector: row.sector,
    variety: row.variety,
    cropClass: row.crop_class ?? row.cropClass,
    areaHa: Number(row.area_ha ?? row.areaHa ?? 0),
    expectedTcHa: Number(row.expected_tc_ha ?? row.expectedTcHa ?? 75),
    plantingDate,
    cropAgeMonths,
    topBrix,
    bottomBrix,
    soilMoisture: row.soil_moisture ?? row.soilMoisture ?? null,
    lastSampled: hasSample ? (row.last_sampled ?? row.lastSampled ?? null) : null,
    sampleVerified: Boolean(row.sampleVerified),
    coordinates: parseCoordinates(row),
    dispatch:
      typeof row.dispatch === 'string'
        ? safeJsonParse(row.dispatch, null)
        : row.dispatch ?? null,
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
      lotMap.set(lotId, { ...fromSqlRow(payload), pendingSync: true, lastSyncError: op.lastError });
    } else if (type === 'DELETE_LOT') {
      lotMap.delete(lotId);
    } else if (lotMap.has(lotId)) {
      const current = lotMap.get(lotId);
      if (type === 'UPDATE_DETAILS') {
        lotMap.set(lotId, { ...current, ...payload, pendingSync: true });
      } else if (type === 'UPDATE_BRIX') {
        lotMap.set(lotId, {
          ...current,
          topBrix: payload.topBrix,
          bottomBrix: payload.bottomBrix,
          lastSampled: payload.lastSampled,
          sampleVerified: true,
          pendingSync: true,
        });
      } else if (type === 'UPDATE_BOUNDARY') {
        lotMap.set(lotId, {
          ...current,
          coordinates: payload.coordinates,
          areaHa: payload.areaHa ?? current.areaHa,
          pendingSync: true,
        });
      } else if (type === 'UPDATE_DISPATCH') {
        lotMap.set(lotId, {
          ...current,
          dispatch: payload.dispatch,
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
  if (error.code === '23502') {
    return `Database NOT NULL constraint triggered (${error.message}). Please run Phase 1b migration in Supabase SQL Editor so Brix/last_sampled are nullable.`;
  }
  if (error.code === '42501') {
    return `Row-Level Security policy blocked write (${error.message}).`;
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
    } else {
      lastErrorMsg = `Express API returned HTTP ${res.status}`;
    }
  } catch (err) {
    if (!lastErrorMsg) {
      lastErrorMsg = `Offline (${err.name === 'AbortError' ? 'Connection timed out' : err.message})`;
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
  const hasBrix =
    newLot.topBrix !== null &&
    newLot.topBrix !== undefined &&
    newLot.bottomBrix !== null &&
    newLot.bottomBrix !== undefined;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .insert([
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
            top_brix: hasBrix ? newLot.topBrix : null,
            bottom_brix: hasBrix ? newLot.bottomBrix : null,
            soil_moisture: newLot.soilMoisture || null,
            last_sampled: hasBrix ? newLot.lastSampled : null,
            svg_points: newLot.coordinates ? JSON.stringify(newLot.coordinates) : null,
            dispatch: newLot.dispatch ?? null,
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
        if (hasBrix) {
          await supabase.from('brix_samples').insert([
            {
              lot_id: newLot.id,
              top_brix: newLot.topBrix,
              bottom_brix: newLot.bottomBrix,
              sampled_at: newLot.lastSampled,
              sampled_by: 'Initial registration sample',
            },
          ]);
        }
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
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        code: '23505',
        error: body.error || `Lot ID "${newLot.id}" already exists (PK conflict).`,
        source: 'Express API Server',
      };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: supabaseError || body.error || `Express POST failed (HTTP ${res.status})`,
        source: 'Express API Server',
      };
    }
    return { ok: true, error: null, source: 'Express API Server' };
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Write failed while offline (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }
}

export async function updateLotDetails(lotId, updates) {
  let supabaseError = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .update({
          hacienda: updates.hacienda,
          planter: updates.planter,
          sector: updates.sector,
          variety: updates.variety,
          crop_class: updates.cropClass,
          area_ha: updates.areaHa,
          expected_tc_ha: updates.expectedTcHa,
          planting_date: updates.plantingDate,
          crop_age_months: updates.cropAgeMonths,
          soil_moisture: updates.soilMoisture || null,
        })
        .eq('id', lotId)
        .select();

      if (error) {
        supabaseError = formatSupabaseError(error);
      } else if (!data || data.length === 0) {
        supabaseError = `Update for ${lotId} blocked by RLS policy or row missing in Supabase.`;
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: supabaseError || body.error || `Express PATCH failed (HTTP ${res.status})`,
        source: 'Express API Server',
      };
    }
    return { ok: true, error: null, source: 'Express API Server' };
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Update failed while offline (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }
}

export async function updateLotBrixSample(lotId, topBrix, bottomBrix, lastSampled) {
  let supabaseError = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .update({
          top_brix: topBrix,
          bottom_brix: bottomBrix,
          last_sampled: lastSampled,
        })
        .eq('id', lotId)
        .select();

      if (error) {
        supabaseError = formatSupabaseError(error);
      } else if (!data || data.length === 0) {
        supabaseError = `Brix update for ${lotId} blocked by RLS policy or lot not found.`;
      } else {
        // Also record in brix_samples history table if migration has been applied
        await supabase.from('brix_samples').insert([
          {
            lot_id: lotId,
            top_brix: topBrix,
            bottom_brix: bottomBrix,
            sampled_at: lastSampled,
            sampled_by: 'Field Officer',
          },
        ]);
        return { ok: true, error: null, source: 'Supabase Cloud DB', data: data[0] };
      }
    } catch (err) {
      supabaseError = err.message;
    }
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/lots/${lotId}/brix`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topBrix, bottomBrix, lastSampled }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: supabaseError || body.error || `Express Brix PATCH failed (HTTP ${res.status})`,
        source: 'Express API Server',
      };
    }
    return { ok: true, error: null, source: 'Express API Server' };
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Brix sample save failed (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }
}

export async function updateLotBoundary(lotId, coordinates, areaHa) {
  let supabaseError = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .update({
          svg_points: JSON.stringify(coordinates),
          area_ha: areaHa,
        })
        .eq('id', lotId)
        .select();

      if (error) {
        supabaseError = formatSupabaseError(error);
      } else if (!data || data.length === 0) {
        supabaseError = `Boundary update for ${lotId} blocked by RLS policy or lot not found.`;
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
      body: JSON.stringify({ coordinates, areaHa }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: supabaseError || body.error || `Express Boundary PATCH failed (HTTP ${res.status})`,
        source: 'Express API Server',
      };
    }
    return { ok: true, error: null, source: 'Express API Server' };
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Boundary save failed (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }
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
        supabaseError = `Dispatch update for ${lotId} blocked by RLS policy or lot not found.`;
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: supabaseError || body.error || `Express Dispatch PATCH failed (HTTP ${res.status})`,
        source: 'Express API Server',
      };
    }
    return { ok: true, error: null, source: 'Express API Server' };
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Dispatch save failed (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }
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
        supabaseError = `Delete for ${lotId} blocked by Supabase RLS (missing DELETE policy) or row not found.`;
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: supabaseError || body.error || `Express DELETE failed (HTTP ${res.status})`,
        source: 'Express API Server',
      };
    }
    return { ok: true, error: null, source: 'Express API Server' };
  } catch (err) {
    return {
      ok: false,
      error: supabaseError || `Delete failed while offline (${err.message})`,
      source: supabase ? 'Supabase Cloud DB' : 'Express API Server',
    };
  }
}

export async function replayPendingOperations() {
  const queue = getPendingOperations();
  if (queue.length === 0) {
    return { replayed: 0, remaining: 0, errors: [] };
  }

  let replayed = 0;
  const remainingOps = [];
  const errors = [];

  for (const op of queue) {
    let result = { ok: false, error: 'Unknown operation' };

    if (op.type === 'CREATE_LOT') {
      result = await createFarmLot(op.payload);
      if (!result.ok && result.code === '23505') {
        result = { ok: true, error: null };
      }
    } else if (op.type === 'UPDATE_DETAILS') {
      result = await updateLotDetails(op.lotId, op.payload);
    } else if (op.type === 'UPDATE_BRIX') {
      result = await updateLotBrixSample(
        op.lotId,
        op.payload.topBrix,
        op.payload.bottomBrix,
        op.payload.lastSampled
      );
    } else if (op.type === 'UPDATE_BOUNDARY') {
      result = await updateLotBoundary(
        op.lotId,
        op.payload.coordinates,
        op.payload.areaHa
      );
    } else if (op.type === 'UPDATE_DISPATCH') {
      result = await updateLotDispatch(op.lotId, op.payload.dispatch);
    } else if (op.type === 'DELETE_LOT') {
      result = await deleteFarmLot(op.lotId);
    }

    if (result.ok) {
      replayed++;
    } else {
      remainingOps.push({ ...op, lastError: result.error });
      errors.push({ lotId: op.lotId, type: op.type, error: result.error });
    }
  }

  savePendingOperations(remainingOps);
  return { replayed, remaining: remainingOps.length, errors };
}

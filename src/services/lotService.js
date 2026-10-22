import { createClient } from '@supabase/supabase-js';
import { INITIAL_LOTS } from '../data/initialLots';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const supabase =
  SUPABASE_URL && SUPABASE_KEY && !SUPABASE_KEY.includes('PASTE_YOUR')
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

function parseCoordinates(row) {
  if (Array.isArray(row.coordinates) && row.coordinates.length >= 3) {
    return row.coordinates;
  }
  if (typeof row.svg_points === 'string' && row.svg_points.trim().startsWith('[')) {
    try {
      return JSON.parse(row.svg_points);
    } catch {}
  }
  const fallback = INITIAL_LOTS.find((l) => l.id === row.id);
  return fallback ? fallback.coordinates : null;
}

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
    coordinates: parseCoordinates(row),
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
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('farm_lots')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data && data.length > 0) {
        return { lots: data.map(fromSqlRow), source: 'Supabase Cloud DB', online: true };
      }
    } catch {}
  }

  try {
    const res = await fetchWithTimeout(API_URL + '/lots');
    if (res.ok) {
      const data = await res.json();
      return { lots: data.map(fromSqlRow), source: 'Express API Server', online: true };
    }
  } catch {}

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
          svg_points: newLot.coordinates ? JSON.stringify(newLot.coordinates) : null,
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

export async function updateLotDetails(lotId, updates) {
  if (supabase) {
    try {
      await supabase
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
          soil_moisture: updates.soilMoisture,
        })
        .eq('id', lotId);
      return;
    } catch {}
  }

  try {
    await fetchWithTimeout(API_URL + '/lots/' + lotId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch {}
}

export async function deleteFarmLot(lotId) {
  if (supabase) {
    try {
      await supabase.from('farm_lots').delete().eq('id', lotId);
      return;
    } catch {}
  }

  try {
    await fetchWithTimeout(API_URL + '/lots/' + lotId, {
      method: 'DELETE',
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

export async function updateLotBoundary(lotId, coordinates, areaHa) {
  if (supabase) {
    try {
      await supabase
        .from('farm_lots')
        .update({
          svg_points: JSON.stringify(coordinates),
          area_ha: areaHa,
        })
        .eq('id', lotId);
      return;
    } catch {}
  }

  try {
    await fetchWithTimeout(API_URL + '/lots/' + lotId + '/boundary', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates, areaHa }),
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

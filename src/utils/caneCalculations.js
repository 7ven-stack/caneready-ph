export const STATUS_PRIORITY = Object.freeze({
  'Harvest Due': 1,
  'Upcoming (30d)': 2,
  'Planned Later': 3,
  'No Date Set': 4,
});

export const PLANTER_ASSOCIATIONS = Object.freeze([
  'APSSI',
  'AHSSI',
  'APP-NEG',
  'SIMAG',
  'NOPA',
  'UNIFED',
  'CONFED',
  'Independent',
]);

export function normalizeAssociation(rawAssoc) {
  if (!rawAssoc || rawAssoc === 'AHPCO') return 'APSSI';
  return String(rawAssoc).trim();
}

export function computeCropAgeMonths(plantingDate, fallbackMonths = null, now = new Date()) {
  if (typeof plantingDate === 'string' && plantingDate.trim()) {
    const parsed = new Date(plantingDate + 'T00:00:00');
    if (!Number.isNaN(parsed.getTime())) {
      const diffMs = now.getTime() - parsed.getTime();
      const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
      return Number(Math.max(0, months).toFixed(1));
    }
  }
  const fallback = Number(fallbackMonths);
  return Number.isFinite(fallback) && fallback >= 0 ? Number(fallback.toFixed(1)) : 0;
}

export function computeCentroidLatLng(lot) {
  if (Array.isArray(lot?.coordinates) && lot.coordinates.length >= 3) {
    let latSum = 0;
    let lngSum = 0;
    let count = 0;
    for (const pt of lot.coordinates) {
      if (Array.isArray(pt) && pt.length >= 2) {
        const lat = Number(pt[0]);
        const lng = Number(pt[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          latSum += lat;
          lngSum += lng;
          count++;
        }
      }
    }
    if (count > 0) {
      return {
        latitude: Number((latSum / count).toFixed(6)),
        longitude: Number((lngSum / count).toFixed(6)),
      };
    }
  }

  const lat = Number(lot?.latitude);
  const lng = Number(lot?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    };
  }

  return {
    latitude: 10.8185,
    longitude: 123.0145,
  };
}

export function buildPolygonFromLatLng(lat, lng, areaHa = 10) {
  const cleanLat = Number(lat) || 10.8185;
  const cleanLng = Number(lng) || 123.0145;
  const halfSideDeg = Math.max(
    0.0006,
    Math.min(0.004, Math.sqrt(Math.max(1, Number(areaHa))) * 0.00045)
  );
  return [
    [Number((cleanLat + halfSideDeg).toFixed(6)), Number((cleanLng - halfSideDeg).toFixed(6))],
    [Number((cleanLat + halfSideDeg).toFixed(6)), Number((cleanLng + halfSideDeg).toFixed(6))],
    [Number((cleanLat - halfSideDeg).toFixed(6)), Number((cleanLng + halfSideDeg).toFixed(6))],
    [Number((cleanLat - halfSideDeg).toFixed(6)), Number((cleanLng - halfSideDeg).toFixed(6))],
  ];
}

export function calculatePolygonAreaHa(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return 0;
  const earthRadius = 6378137;
  let areaSqMeters = 0;

  for (let i = 0; i < coords.length; i++) {
    const [lat1, lng1] = coords[i];
    const [lat2, lng2] = coords[(i + 1) % coords.length];
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dLambda = ((lng2 - lng1) * Math.PI) / 180;
    areaSqMeters += dLambda * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  areaSqMeters = Math.abs((areaSqMeters * earthRadius * earthRadius) / 2.0);
  const hectares = areaSqMeters / 10000;
  return Number(Math.max(0.1, hectares).toFixed(2));
}

export function evaluateLotMetrics(lot, now = new Date()) {
  const areaHa = Number(lot.areaHa) || 0;
  const expectedTcHa = Number(lot.expectedTcHa) || 75;
  const estimatedTons = Math.round(areaHa * expectedTcHa);
  const cropAgeMonths = computeCropAgeMonths(lot.plantingDate, lot.cropAgeMonths, now);

  const contactNumber = lot.contactNumber || lot.dispatch?.contactNumber || 'Not provided';
  const association = normalizeAssociation(lot.association || lot.dispatch?.association);
  const barangay = lot.barangay || lot.dispatch?.barangay || 'Brgy. Hawaiian';
  const city = lot.city || lot.dispatch?.city || 'Silay City';
  const hacienda = lot.hacienda || 'Unnamed Hacienda';

  const plannedHarvestDate =
    lot.plannedHarvestDate || lot.dispatch?.scheduledDate || null;
  const harvestNotes =
    lot.harvestNotes ?? lot.dispatch?.notes ?? lot.dispatch?.brigadeLeader ?? '';

  const { latitude, longitude } = computeCentroidLatLng(lot);
  const coordText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  const fullLocationText = `${hacienda}, ${barangay}, ${city}`;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let daysUntilHarvest = null;
  let harvestTimelineLabel = 'Not scheduled by planter';
  let status = 'No Date Set';

  if (plannedHarvestDate) {
    const targetTime = new Date(plannedHarvestDate + 'T00:00:00').getTime();
    if (!Number.isNaN(targetTime)) {
      daysUntilHarvest = Math.round((targetTime - todayStart) / (1000 * 60 * 60 * 24));

      if (daysUntilHarvest < 0) {
        status = 'Harvest Due';
        harvestTimelineLabel = `${Math.abs(daysUntilHarvest)}d overdue (${plannedHarvestDate})`;
      } else if (daysUntilHarvest === 0) {
        status = 'Harvest Due';
        harvestTimelineLabel = 'Harvesting Today';
      } else if (daysUntilHarvest <= 7) {
        status = 'Harvest Due';
        harvestTimelineLabel = `In ${daysUntilHarvest} day${daysUntilHarvest === 1 ? '' : 's'}`;
      } else if (daysUntilHarvest <= 30) {
        status = 'Upcoming (30d)';
        harvestTimelineLabel = `In ${daysUntilHarvest} days`;
      } else {
        status = 'Planned Later';
        harvestTimelineLabel = `In ${daysUntilHarvest} days`;
      }
    }
  }

  return {
    ...lot,
    hacienda,
    contactNumber,
    association,
    barangay,
    city,
    fullLocationText,
    areaHa,
    expectedTcHa,
    estimatedTons,
    cropAgeMonths,
    plannedHarvestDate,
    harvestNotes,
    daysUntilHarvest,
    harvestTimelineLabel,
    latitude,
    longitude,
    coordText,
    status,
    statusDisplay: status,
    statusPriority: STATUS_PRIORITY[status] ?? 4,
    dispatch: {
      ...(typeof lot.dispatch === 'object' && lot.dispatch ? lot.dispatch : {}),
      scheduledDate: plannedHarvestDate,
      notes: harvestNotes,
      contactNumber,
      association,
      barangay,
      city,
    },
  };
}

export function getStatusStyles(status) {
  switch (status) {
    case 'Harvest Due':
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        bar: 'bg-emerald-600',
        polygonFill: '#10b981',
        polygonStroke: '#047857',
      };
    case 'Upcoming (30d)':
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        bar: 'bg-amber-500',
        polygonFill: '#f59e0b',
        polygonStroke: '#b45309',
      };
    case 'Planned Later':
      return {
        badge: 'bg-sky-50 text-sky-800 border-sky-200',
        dot: 'bg-sky-500',
        bar: 'bg-sky-600',
        polygonFill: '#0ea5e9',
        polygonStroke: '#0369a1',
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
        dot: 'bg-slate-400',
        bar: 'bg-slate-500',
        polygonFill: '#94a3b8',
        polygonStroke: '#475569',
      };
  }
}

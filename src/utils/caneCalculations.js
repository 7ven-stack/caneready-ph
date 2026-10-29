export const DEFAULT_YIELD_TC_HA = 75;

export const PLANTER_ASSOCIATIONS = [
  'APSSI',
  'APP-NEG',
  'AHSSI',
  'Private',
];

export function sanitizeContactNumber(raw) {
  if (raw === null || raw === undefined) return '';
  const cleaned = String(raw)
    .trim()
    .replace(/^['"`’‘]+/, '')
    .replace(/['"`]+$/, '')
    .trim();
  if (!cleaned || cleaned.toLowerCase() === 'not provided' || cleaned === '—') {
    return '';
  }
  return cleaned;
}

export function pointInRing(point, ring = []) {
  if (!point || !Array.isArray(ring) || ring.length < 3) return false;
  const py = Array.isArray(point)
    ? Number(point[0])
    : Number(point?.lat ?? point?.latitude);
  const px = Array.isArray(point)
    ? Number(point[1])
    : Number(point?.lng ?? point?.longitude);
  if (!Number.isFinite(py) || !Number.isFinite(px)) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = Array.isArray(ring[i])
      ? Number(ring[i][0])
      : Number(ring[i]?.lat ?? ring[i]?.latitude);
    const xi = Array.isArray(ring[i])
      ? Number(ring[i][1])
      : Number(ring[i]?.lng ?? ring[i]?.longitude);
    const yj = Array.isArray(ring[j])
      ? Number(ring[j][0])
      : Number(ring[j]?.lat ?? ring[j]?.latitude);
    const xj = Array.isArray(ring[j])
      ? Number(ring[j][1])
      : Number(ring[j]?.lng ?? ring[j]?.longitude);

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getCanonicalStatusBucket(
  lotOrStatus,
  daysUntilHarvest = null,
  plannedHarvestDate = undefined
) {
  if (lotOrStatus && typeof lotOrStatus === 'object') {
    const lot = lotOrStatus;
    const hasDate = Boolean(
      lot.plannedHarvestDate && String(lot.plannedHarvestDate).trim()
    );
    if (!hasDate) return 'No Date Set';

    const days = Number(lot.daysUntilHarvest);
    if (
      lot.daysUntilHarvest !== null &&
      lot.daysUntilHarvest !== undefined &&
      Number.isFinite(days)
    ) {
      if (days <= 7) return 'Harvest Due';
      if (days <= 30) return 'Upcoming';
      return 'Planned Later';
    }
    return getCanonicalStatusBucket(lot.status, null, lot.plannedHarvestDate);
  }

  const rawStatus = String(lotOrStatus || '').trim();
  if (plannedHarvestDate !== undefined && !plannedHarvestDate) {
    return 'No Date Set';
  }
  if (typeof daysUntilHarvest === 'number' && Number.isFinite(daysUntilHarvest)) {
    if (daysUntilHarvest <= 7) return 'Harvest Due';
    if (daysUntilHarvest <= 30) return 'Upcoming';
    return 'Planned Later';
  }

  if (!rawStatus || /no date|unscheduled|none|pending date/i.test(rawStatus)) {
    return 'No Date Set';
  }
  if (/upcoming/i.test(rawStatus)) {
    return 'Upcoming';
  }
  if (/due|overdue|today|urgent|harvesting/i.test(rawStatus)) {
    return 'Harvest Due';
  }
  if (/later|planned|scheduled/i.test(rawStatus)) {
    return 'Planned Later';
  }
  return 'No Date Set';
}

export function computeCentroidLatLng(lotOrCoords) {
  const coords = Array.isArray(lotOrCoords)
    ? lotOrCoords
    : Array.isArray(lotOrCoords?.coordinates)
    ? lotOrCoords.coordinates
    : [];

  if (coords.length >= 3) {
    let latSum = 0;
    let lngSum = 0;
    let validCount = 0;
    for (const pt of coords) {
      const lat = Array.isArray(pt)
        ? Number(pt[0])
        : Number(pt?.lat ?? pt?.latitude);
      const lng = Array.isArray(pt)
        ? Number(pt[1])
        : Number(pt?.lng ?? pt?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        latSum += lat;
        lngSum += lng;
        validCount++;
      }
    }
    if (validCount > 0) {
      const centerLat = Number((latSum / validCount).toFixed(6));
      const centerLng = Number((lngSum / validCount).toFixed(6));
      if (pointInRing([centerLat, centerLng], coords)) {
        return { latitude: centerLat, longitude: centerLng };
      }
      const midPt = coords[Math.floor(coords.length / 2)];
      const midLat = Array.isArray(midPt) ? Number(midPt[0]) : Number(midPt?.lat);
      const midLng = Array.isArray(midPt) ? Number(midPt[1]) : Number(midPt?.lng);
      if (Number.isFinite(midLat) && Number.isFinite(midLng)) {
        const blendedLat = Number(((centerLat + midLat) / 2).toFixed(6));
        const blendedLng = Number(((centerLng + midLng) / 2).toFixed(6));
        if (pointInRing([blendedLat, blendedLng], coords)) {
          return { latitude: blendedLat, longitude: blendedLng };
        }
      }
      return { latitude: centerLat, longitude: centerLng };
    }
  }

  return {
    latitude: Number(lotOrCoords?.latitude) || 10.8185,
    longitude: Number(lotOrCoords?.longitude) || 123.0145,
  };
}

export function computePolygonAreaHa(coords = []) {
  if (!Array.isArray(coords) || coords.length < 3) return 0;
  const pts = coords
    .map((pt) =>
      Array.isArray(pt)
        ? [Number(pt[0]), Number(pt[1])]
        : [Number(pt?.lat ?? pt?.latitude), Number(pt?.lng ?? pt?.longitude)]
    )
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  if (pts.length < 3) return 0;

  const refLatRad = (pts[0][0] * Math.PI) / 180;
  const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * refLatRad);
  const metersPerDegLng = 111412.84 * Math.cos(refLatRad);

  let areaSqMeters = 0;
  for (let i = 0; i < pts.length; i++) {
    const [lat1, lng1] = pts[i];
    const [lat2, lng2] = pts[(i + 1) % pts.length];
    const x1 = lng1 * metersPerDegLng;
    const y1 = lat1 * metersPerDegLat;
    const x2 = lng2 * metersPerDegLng;
    const y2 = lat2 * metersPerDegLat;
    areaSqMeters += x1 * y2 - x2 * y1;
  }

  const ha = Math.abs(areaSqMeters) / 2 / 10000;
  return Number(ha.toFixed(2));
}

export const calculatePolygonAreaHa = computePolygonAreaHa;

export function computeCropAgeMonths(plantingDate, fallbackMonths = 11) {
  if (!plantingDate) return Number(fallbackMonths) || 11;
  const start = new Date(plantingDate);
  if (Number.isNaN(start.getTime())) return Number(fallbackMonths) || 11;
  const now = new Date();
  const diffMonths =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return Math.max(1, diffMonths);
}

export function buildPolygonFromLatLng(lat, lng, areaHa = 5) {
  const centerLat = Number(lat) || 10.8185;
  const centerLng = Number(lng) || 123.0145;
  const safeAreaHa = Math.max(0.2, Number(areaHa) || 5);

  const halfSideMeters = Math.sqrt(safeAreaHa * 10000) / 2;
  const dLat = halfSideMeters / 111132;
  const dLng =
    halfSideMeters / (111412 * Math.cos((centerLat * Math.PI) / 180));

  return [
    [Number((centerLat + dLat).toFixed(6)), Number((centerLng - dLng).toFixed(6))],
    [Number((centerLat + dLat).toFixed(6)), Number((centerLng + dLng).toFixed(6))],
    [Number((centerLat - dLat).toFixed(6)), Number((centerLng + dLng).toFixed(6))],
    [Number((centerLat - dLat).toFixed(6)), Number((centerLng - dLng).toFixed(6))],
  ];
}

export function evaluateLotMetrics(lot, referenceDate = new Date()) {
  const areaHa = Number(lot?.areaHa) || 0;
  const expectedTcHa = Number(lot?.expectedTcHa) || DEFAULT_YIELD_TC_HA;
  const estimatedTons = Math.round(areaHa * expectedTcHa);
  const centroid = computeCentroidLatLng(lot);

  const cleanContact = sanitizeContactNumber(lot?.contactNumber);
  const rawDate = lot?.plannedHarvestDate
    ? String(lot.plannedHarvestDate).trim()
    : null;

  let daysUntilHarvest = null;
  let harvestTimelineLabel = 'No harvest date set';
  let status = 'No Date Set';
  let statusBadgeLabel = 'No Date Set';
  let statusPriority = 4;

  if (rawDate) {
    const todayMidnight = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate()
    );
    const parts = rawDate.split('-').map(Number);
    const targetMidnight =
      parts.length === 3 && parts.every(Number.isFinite)
        ? new Date(parts[0], parts[1] - 1, parts[2])
        : new Date(rawDate);

    if (!Number.isNaN(targetMidnight.getTime())) {
      const diffMs = targetMidnight.getTime() - todayMidnight.getTime();
      daysUntilHarvest = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (daysUntilHarvest < 0) {
        const overdueDays = Math.abs(daysUntilHarvest);
        harvestTimelineLabel =
          overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
        status = 'Harvest Due';
        statusBadgeLabel = 'Harvest Due';
        statusPriority = 1;
      } else if (daysUntilHarvest === 0) {
        harvestTimelineLabel = 'Harvesting Today';
        status = 'Harvest Due';
        statusBadgeLabel = 'Harvest Due';
        statusPriority = 1;
      } else if (daysUntilHarvest === 1) {
        harvestTimelineLabel = 'In 1 day';
        status = 'Harvest Due';
        statusBadgeLabel = 'Harvest Due';
        statusPriority = 1;
      } else if (daysUntilHarvest <= 7) {
        harvestTimelineLabel = `In ${daysUntilHarvest} days`;
        status = 'Harvest Due';
        statusBadgeLabel = 'Harvest Due';
        statusPriority = 1;
      } else if (daysUntilHarvest <= 30) {
        harvestTimelineLabel = `In ${daysUntilHarvest} days`;
        status = 'Upcoming';
        statusBadgeLabel = 'Upcoming (30d)';
        statusPriority = 2;
      } else {
        harvestTimelineLabel = `In ${daysUntilHarvest} days`;
        status = 'Planned Later';
        statusBadgeLabel = 'Planned Later';
        statusPriority = 3;
      }
    }
  }

  return {
    ...lot,
    contactNumber: cleanContact,
    areaHa,
    expectedTcHa,
    estimatedTons,
    latitude: Number(lot?.latitude ?? centroid.latitude),
    longitude: Number(lot?.longitude ?? centroid.longitude),
    plannedHarvestDate: rawDate || null,
    daysUntilHarvest,
    harvestTimelineLabel,
    status,
    statusBadgeLabel,
    statusPriority,
  };
}

export function getStatusStyles(status) {
  const canonical = getCanonicalStatusBucket(status);

  if (canonical === 'Harvest Due') {
    return {
      bar: 'bg-emerald-500',
      badge:
        'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
      dot: 'bg-emerald-500',
      stroke: '#059669',
      fill: '#10b981',
      polygonStroke: '#059669',
      polygonFill: '#10b981',
    };
  }

  if (canonical === 'Upcoming') {
    return {
      bar: 'bg-amber-500',
      badge:
        'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
      dot: 'bg-amber-500',
      stroke: '#d97706',
      fill: '#f59e0b',
      polygonStroke: '#d97706',
      polygonFill: '#f59e0b',
    };
  }

  if (canonical === 'Planned Later') {
    return {
      bar: 'bg-sky-500',
      badge:
        'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/80',
      dot: 'bg-sky-500',
      stroke: '#0284c7',
      fill: '#38bdf8',
      polygonStroke: '#0284c7',
      polygonFill: '#38bdf8',
    };
  }

  return {
    bar: 'bg-slate-400 dark:bg-slate-600',
    badge:
      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400 dark:bg-slate-500',
    stroke: '#64748b',
    fill: '#94a3b8',
    polygonStroke: '#64748b',
    polygonFill: '#94a3b8',
  };
}

export function exportLotsToCsv(
  lots = [],
  filename = 'CaneReadyPH_Planter_Lots.csv'
) {
  if (!Array.isArray(lots) || lots.length === 0) return;
  const headers = [
    'Lot ID',
    'Planter',
    'Contact Number',
    'Association',
    'Hacienda',
    'Barangay',
    'City',
    'Area (ha)',
    'Estimated Tons (MT)',
    'Latitude',
    'Longitude',
    'Planned Harvest Date',
    'Status',
  ];

  const escapeCsv = (val) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = lots.map((lot) => [
    lot.id,
    lot.planter,
    sanitizeContactNumber(lot.contactNumber),
    lot.association || '',
    lot.hacienda || '',
    lot.barangay || '',
    lot.city || '',
    Number(lot.areaHa || 0).toFixed(2),
    Math.round(Number(lot.estimatedTons || 0)),
    Number(lot.latitude || 0).toFixed(6),
    Number(lot.longitude || 0).toFixed(6),
    lot.plannedHarvestDate || 'Unscheduled',
    lot.statusBadgeLabel || lot.status || 'No Date Set',
  ]);

  const csvContent =
    '\uFEFF' +
    [
      headers.map(escapeCsv).join(','),
      ...rows.map((r) => r.map(escapeCsv).join(',')),
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
import fs from 'fs';
import path from 'path';

const files = {
  'src/utils/caneCalculations.js': `export function evaluateLotMetrics(lot) {
  const topBrix = Number(lot.topBrix) || 0;
  const bottomBrix = Number(lot.bottomBrix) || 0;
  const avgBrix = Number(((topBrix + bottomBrix) / 2).toFixed(1));
  const brixDelta = Number((topBrix - bottomBrix).toFixed(1));
  const maturityRatio = bottomBrix > 0
    ? Number((topBrix / bottomBrix).toFixed(2))
    : 0;

  const ageScore = Math.round(Math.min(100, Math.max(0, ((lot.cropAgeMonths - 6) / 6) * 100)));
  const brixScore = Math.round(Math.min(100, Math.max(0, ((avgBrix - 13) / 8) * 100)));
  const ratioDiff = Math.abs(1.0 - maturityRatio);
  const ratioScore = Math.round(Math.max(0, 100 - ratioDiff * 260));

  const readinessScore = Math.round(brixScore * 0.45 + ratioScore * 0.35 + ageScore * 0.2);

  const estimatedLkgTc = Number(Math.max(0.8, (avgBrix * 0.115 * Math.min(1.05, maturityRatio))).toFixed(2));
  const estimatedTons = Math.round(Number(lot.areaHa) * Number(lot.expectedTcHa || 75));
  const totalSugarBagsLkg = Math.round(estimatedTons * estimatedLkgTc);
  const planterShareBags = Math.round(totalSugarBagsLkg * 0.70);
  const millShareBags = totalSugarBagsLkg - planterShareBags;
  const estimatedTruckLoads = Math.max(1, Math.ceil(estimatedTons / 18));
  const apparentPurity = Number(Math.min(92.5, Math.max(72.0, 74 + (avgBrix - 15) * 2.1 - ratioDiff * 12)).toFixed(1));

  let status = 'Immature';
  let recommendation = 'Continue vegetative growth and monitor foliar nutrition. Schedule first refractometer check at 9.5 months.';
  let harvestWindow = 'In 60–90 Days';

  if (lot.cropAgeMonths > 13.5 || maturityRatio > 1.08) {
    status = 'Over-mature Risk';
    recommendation = 'URGENT: Top Brix exceeds Bottom Brix (Ratio > 1.08), indicating sucrose inversion risk. Issue priority cutting permit immediately.';
    harvestWindow = 'Immediate (Within 3–5 Days)';
  } else if (avgBrix >= 19.5 && maturityRatio >= 0.94 && maturityRatio <= 1.05 && lot.cropAgeMonths >= 10.5) {
    status = 'OK to Harvest';
    recommendation = 'Stalk sucrose concentration is uniform from bottom to top internodes. Optimal maturity reached for peak LKg/TC recovery.';
    harvestWindow = 'Optimal Now (Next 7–14 Days)';
  } else if (avgBrix >= 17.5 && maturityRatio >= 0.85 && lot.cropAgeMonths >= 9.5) {
    status = 'Approaching';
    recommendation = 'Bottom stalk has accumulated high sucrose while top internodes are still ripening. Withhold irrigation and re-sample in 7–10 days.';
    harvestWindow = 'In 10–21 Days';
  }

  return {
    ...lot,
    avgBrix,
    brixDelta,
    maturityRatio,
    brixScore,
    ratioScore,
    ageScore,
    readinessScore,
    estimatedLkgTc,
    estimatedTons,
    totalSugarBagsLkg,
    planterShareBags,
    millShareBags,
    estimatedTruckLoads,
    apparentPurity,
    recommendation,
    harvestWindow,
    status,
  };
}

// Geodesic polygon area calculation in Hectares (ha) from [[lat, lng], ...]
export function calculatePolygonAreaHa(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return 0;
  const earthRadius = 6378137; // meters
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

export function getStatusStyles(status) {
  switch (status) {
    case 'OK to Harvest':
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        bar: 'bg-emerald-600',
        polygonFill: '#10b981',
        polygonStroke: '#047857',
      };
    case 'Approaching':
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        bar: 'bg-amber-500',
        polygonFill: '#f59e0b',
        polygonStroke: '#b45309',
      };
    case 'Over-mature Risk':
      return {
        badge: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-500',
        bar: 'bg-rose-600',
        polygonFill: '#f43f5e',
        polygonStroke: '#be123c',
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
`,

  'src/services/lotService.js': `import { createClient } from '@supabase/supabase-js';
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
`,

  'src/components/ParcelMapView.jsx': `import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Globe,
  Maximize2,
  Minimize2,
  Upload,
  Layers,
  Pencil,
  Plus,
  Check,
  X,
  RotateCcw,
  Trash2,
  Crosshair,
} from 'lucide-react';
import { getStatusStyles, calculatePolygonAreaHa } from '../utils/caneCalculations';

const BASEMAPS = {
  googleHybrid: {
    name: 'Google Earth',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: 'Imagery &copy; Google Earth',
    maxZoom: 21,
  },
  esriWorld: {
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl:
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  googleSat: {
    name: 'Clean Sat',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: 'Imagery &copy; Google Satellite',
    maxZoom: 21,
  },
};

function getLotCoordinates(lot, index) {
  if (lot.coordinates && Array.isArray(lot.coordinates) && lot.coordinates.length >= 3) {
    return lot.coordinates;
  }
  const row = Math.floor(index / 3);
  const col = index % 3;
  const baseLat = 10.8215 - row * 0.0035;
  const baseLng = 123.0085 + col * 0.0038;
  return [
    [baseLat, baseLng],
    [baseLat + 0.0003, baseLng + 0.0034],
    [baseLat - 0.0028, baseLng + 0.0036],
    [baseLat - 0.0030, baseLng + 0.0002],
  ];
}

export default function ParcelMapView({
  lots,
  onSelectLot,
  onUpdateLotBoundary,
  onCreateLotFromPolygon,
}) {
  const [selectedLot, setSelectedLot] = useState(lots[0] || null);
  const [basemapKey, setBasemapKey] = useState('googleHybrid');
  const [isExpanded, setIsExpanded] = useState(false);
  const [customGeoJsonCount, setCustomGeoJsonCount] = useState(0);

  // GIS Digitizer Mode: 'view' | 'edit' | 'draw'
  const [mapMode, setMapMode] = useState('view');
  const [draftCoords, setDraftCoords] = useState([]);
  const [autoUpdateArea, setAutoUpdateArea] = useState(true);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const labelOverlayRef = useRef(null);
  const polygonsGroupRef = useRef(null);
  const editLayerGroupRef = useRef(null);
  const customGeoJsonGroupRef = useRef(null);
  const fileInputRef = useRef(null);

  const draftAreaHa = calculatePolygonAreaHa(draftCoords);

  // Sync selected lot when lots list updates
  useEffect(() => {
    if (lots.length > 0) {
      const updated = selectedLot ? lots.find((l) => l.id === selectedLot.id) : null;
      setSelectedLot(updated || lots[0]);
    }
  }, [lots]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.8185, 123.0145],
      zoom: 16,
      zoomControl: false,
      doubleClickZoom: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    polygonsGroupRef.current = L.featureGroup().addTo(map);
    editLayerGroupRef.current = L.featureGroup().addTo(map);
    customGeoJsonGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Invalidate map size when expanding/collapsing container
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 180);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Switch satellite basemap
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const config = BASEMAPS[basemapKey] || BASEMAPS.googleHybrid;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    if (labelOverlayRef.current) {
      map.removeLayer(labelOverlayRef.current);
      labelOverlayRef.current = null;
    }

    tileLayerRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map);

    if (config.overlayUrl) {
      labelOverlayRef.current = L.tileLayer(config.overlayUrl, {
        maxZoom: config.maxZoom,
        pane: 'overlayPane',
      }).addTo(map);
    }
  }, [basemapKey]);

  // Map click handler for drawing or adding vertices
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (mapMode === 'draw' || mapMode === 'edit') {
        const pt = [
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        ];
        setDraftCoords((prev) => [...prev, pt]);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapMode]);

  // Render static lot polygons (dimmed when editing/drawing)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    lots.forEach((lot, idx) => {
      // Hide the active lot's static polygon while editing it so only the editable layer shows
      if (mapMode === 'edit' && selectedLot && selectedLot.id === lot.id) {
        return;
      }

      const style = getStatusStyles(lot.status);
      const coords = getLotCoordinates(lot, idx);
      const isSelected = selectedLot && selectedLot.id === lot.id && mapMode === 'view';

      const polygon = L.polygon(coords, {
        color: isSelected ? '#ffffff' : style.polygonStroke,
        weight: isSelected ? 3.5 : 2,
        fillColor: style.polygonFill,
        fillOpacity: mapMode !== 'view' ? 0.25 : isSelected ? 0.65 : 0.45,
      });

      polygon.bindTooltip(
        '<div style="text-align:center;line-height:1.25;">' +
          '<div style="font-family:monospace;font-weight:800;font-size:11px;color:#ffffff;text-shadow:0 1px 3px rgba(0,0,0,0.95);">' +
          lot.id +
          '</div>' +
          '<div style="font-weight:700;font-size:10px;color:#f8fafc;text-shadow:0 1px 3px rgba(0,0,0,0.95);">' +
          lot.avgBrix +
          '° Brix (' +
          lot.areaHa +
          'ha)</div>' +
          '</div>',
        {
          permanent: true,
          direction: 'center',
          className: 'cane-lot-label',
        }
      );

      if (mapMode === 'view') {
        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedLot(lot);
        });

        polygon.on('mouseover', () => {
          polygon.setStyle({ weight: 3.5, fillOpacity: 0.72, color: '#ffffff' });
        });

        polygon.on('mouseout', () => {
          const stillSelected = selectedLot && selectedLot.id === lot.id;
          polygon.setStyle({
            weight: stillSelected ? 3.5 : 2,
            fillOpacity: stillSelected ? 0.65 : 0.45,
            color: stillSelected ? '#ffffff' : style.polygonStroke,
          });
        });
      }

      polygon.addTo(group);
    });
  }, [lots, selectedLot, mapMode]);

  // Render active editable/drawable polygon + draggable vertex & midpoint handles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const editGroup = editLayerGroupRef.current;
    if (!map || !editGroup) return;

    editGroup.clearLayers();

    if (mapMode === 'view' || draftCoords.length === 0) return;

    // 1. Draw polygon or polyline preview
    if (draftCoords.length >= 3) {
      L.polygon(draftCoords, {
        color: '#34d399',
        weight: 3,
        dashArray: '6, 4',
        fillColor: '#10b981',
        fillOpacity: 0.35,
      }).addTo(editGroup);
    } else if (draftCoords.length === 2) {
      L.polyline(draftCoords, {
        color: '#34d399',
        weight: 3,
        dashArray: '6, 4',
      }).addTo(editGroup);
    }

    // 2. Render draggable corner vertex markers
    draftCoords.forEach((pt, idx) => {
      const vertexIcon = L.divIcon({
        className: 'cane-vertex-handle',
        html:
          '<div title="Drag to move corner • Right-click to delete" style="' +
          'width:14px;height:14px;border-radius:9999px;background:#ffffff;' +
          'border:3px solid #059669;box-shadow:0 1px 4px rgba(0,0,0,0.6);cursor:grab;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker(pt, {
        icon: vertexIcon,
        draggable: true,
      });

      marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        const updatedPoint = [
          Number(pos.lat.toFixed(6)),
          Number(pos.lng.toFixed(6)),
        ];
        setDraftCoords((prev) =>
          prev.map((coord, i) => (i === idx ? updatedPoint : coord))
        );
      });

      // Right-click vertex to remove it
      marker.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        setDraftCoords((prev) => {
          if (prev.length <= 3 && mapMode === 'edit') return prev;
          return prev.filter((_, i) => i !== idx);
        });
      });

      marker.addTo(editGroup);

      // 3. Render midpoint "+" handle between edges to insert a new corner
      if (draftCoords.length >= 3) {
        const nextPt = draftCoords[(idx + 1) % draftCoords.length];
        const midPt = [
          Number(((pt[0] + nextPt[0]) / 2).toFixed(6)),
          Number(((pt[1] + nextPt[1]) / 2).toFixed(6)),
        ];

        const midIcon = L.divIcon({
          className: 'cane-midpoint-handle',
          html:
            '<div title="Click or drag to insert a new corner vertex" style="' +
            'width:12px;height:12px;border-radius:9999px;background:rgba(16,185,129,0.9);' +
            'border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.5);cursor:pointer;"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const midMarker = L.marker(midPt, {
          icon: midIcon,
          draggable: true,
        });

        midMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setDraftCoords((prev) => {
            const copy = [...prev];
            copy.splice(idx + 1, 0, midPt);
            return copy;
          });
        });

        midMarker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          const newPt = [
            Number(pos.lat.toFixed(6)),
            Number(pos.lng.toFixed(6)),
          ];
          setDraftCoords((prev) => {
            const copy = [...prev];
            copy.splice(idx + 1, 0, newPt);
            return copy;
          });
        });

        midMarker.addTo(editGroup);
      }
    });
  }, [mapMode, draftCoords]);

  // Start editing the currently selected lot's polygon
  const handleStartEditSelected = () => {
    if (!selectedLot) return;
    const idx = lots.findIndex((l) => l.id === selectedLot.id);
    const coords = getLotCoordinates(selectedLot, idx >= 0 ? idx : 0);
    setDraftCoords(coords.map((c) => [...c]));
    setMapMode('edit');

    const map = mapInstanceRef.current;
    if (map && coords.length >= 3) {
      map.flyToBounds(L.polygon(coords).getBounds(), {
        padding: [70, 70],
        maxZoom: 18,
        duration: 0.5,
      });
    }
  };

  // Start drawing a brand new polygon from scratch
  const handleStartDrawNew = () => {
    setDraftCoords([]);
    setMapMode('draw');
  };

  const handleCancelDigitize = () => {
    setMapMode('view');
    setDraftCoords([]);
  };

  const handleSaveBoundaryToSelectedLot = () => {
    if (!selectedLot || draftCoords.length < 3) return;
    const finalArea = autoUpdateArea ? draftAreaHa : selectedLot.areaHa;
    onUpdateLotBoundary(selectedLot.id, draftCoords, finalArea);
    setMapMode('view');
    setDraftCoords([]);
  };

  const handleCreateNewLotFromDrawn = () => {
    if (draftCoords.length < 3) return;
    onCreateLotFromPolygon(draftCoords, draftAreaHa);
    setMapMode('view');
    setDraftCoords([]);
  };

  const handleFitAllBounds = () => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    if (map && group && group.getLayers().length > 0) {
      map.flyToBounds(group.getBounds(), { padding: [40, 40], duration: 0.7 });
    }
  };

  const handleFocusLot = (lot) => {
    setSelectedLot(lot);
    const map = mapInstanceRef.current;
    if (!map) return;
    const idx = lots.findIndex((l) => l.id === lot.id);
    const coords = getLotCoordinates(lot, idx >= 0 ? idx : 0);
    if (coords && coords.length >= 3) {
      map.flyToBounds(L.polygon(coords).getBounds(), {
        padding: [60, 60],
        maxZoom: 17,
        duration: 0.6,
      });
    }
  };

  // Upload QGIS .geojson file
  const handleGeoJsonUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const geojson = JSON.parse(event.target.result);
        const map = mapInstanceRef.current;
        const customGroup = customGeoJsonGroupRef.current;
        if (!map || !customGroup) return;

        customGroup.clearLayers();
        const geoLayer = L.geoJSON(geojson, {
          style: {
            color: '#38bdf8',
            weight: 2.5,
            fillColor: '#0284c7',
            fillOpacity: 0.35,
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            const title =
              props.id || props.LOT_ID || props.Name || props.hacienda || 'QGIS Parcel';
            layer.bindPopup(
              '<strong>' +
                title +
                '</strong><br/><pre style="font-size:10px;max-height:120px;overflow:auto;">' +
                JSON.stringify(props, null, 2) +
                '</pre>'
            );
          },
        }).addTo(customGroup);

        const count = geoLayer.getLayers().length;
        setCustomGeoJsonCount(count);
        if (count > 0) {
          map.flyToBounds(customGroup.getBounds(), { padding: [30, 30] });
        }
      } catch {
        alert('Invalid GeoJSON file. Make sure it is exported in EPSG:4326 (WGS 84).');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      <style>{
        '.cane-lot-label { background: transparent !important; border: none !important; box-shadow: none !important; pointer-events: none; }' +
        '.cane-lot-label::before { display: none !important; }' +
        '.leaflet-container { cursor: ' +
        (mapMode === 'view' ? 'grab' : 'crosshair') +
        ' !important; }'
      }</style>

      {/* Left Column: Larger Interactive Satellite Map (9 of 12 cols on desktop, or 12 when expanded) */}
      <div
        className={
          (isExpanded ? 'xl:col-span-12 ' : 'xl:col-span-8 2xl:col-span-9 ') +
          'bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-2xs transition-all'
        }
      >
        {/* Top GIS & Digitizer Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                District Spatial Parcel Map & Polygon Digitizer
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Globe className="w-3 h-3" />
                Live Satellite GIS
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a lot and click <strong>Edit Boundary</strong> to snap corners onto real sugarcane fields, or click <strong>+ Draw New Polygon</strong>
            </p>
          </div>

          {/* Basemap Switcher + Map Utilities */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setBasemapKey('googleHybrid')}
                className={
                  'px-2.5 py-1 rounded-md font-semibold transition-all ' +
                  (basemapKey === 'googleHybrid'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900')
                }
              >
                Google Earth
              </button>
              <button
                type="button"
                onClick={() => setBasemapKey('esriWorld')}
                className={
                  'px-2.5 py-1 rounded-md font-semibold transition-all ' +
                  (basemapKey === 'esriWorld'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900')
                }
              >
                Esri World Imagery
              </button>
              <button
                type="button"
                onClick={() => setBasemapKey('googleSat')}
                className={
                  'px-2.5 py-1 rounded-md font-semibold transition-all ' +
                  (basemapKey === 'googleSat'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900')
                }
              >
                Clean Sat
              </button>
            </div>

            <button
              type="button"
              onClick={handleFitAllBounds}
              title="Zoom to fit all farm lots"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <Crosshair className="w-3.5 h-3.5 text-slate-500" />
              <span>Fit All</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json"
              onChange={handleGeoJsonUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700" />
              <span>QGIS .geojson</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white"
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Split View</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Full Width Map</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Polygon Digitizer Action Bar */}
        <div className="mb-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
          {mapMode === 'view' ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block border border-emerald-700" />
                  OK to Harvest
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block border border-amber-700" />
                  Approaching
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block border border-rose-700" />
                  Over-mature
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-xs bg-slate-400 inline-block border border-slate-600" />
                  Immature
                </span>
                {customGeoJsonCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    <Layers className="w-3 h-3" />
                    {customGeoJsonCount} QGIS features
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedLot && (
                  <button
                    type="button"
                    onClick={handleStartEditSelected}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs font-bold transition-colors shadow-2xs"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit {selectedLot.id} Boundary</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStartDrawNew}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Draw New Polygon</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-emerald-700 text-white font-bold">
                  {mapMode === 'edit'
                    ? 'Editing ' + (selectedLot ? selectedLot.id : 'Polygon')
                    : 'Drawing New Field Polygon'}
                </span>
                <span className="text-slate-600">
                  Click map to add points • Drag white handles to reshape • Right-click handle to delete
                </span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono font-bold text-slate-900">
                  {draftCoords.length} pts • {draftAreaHa} ha
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <label className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 mr-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoUpdateArea}
                    onChange={(e) => setAutoUpdateArea(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Sync {draftAreaHa} ha</span>
                </label>

                <button
                  type="button"
                  onClick={() => setDraftCoords((prev) => prev.slice(0, -1))}
                  disabled={draftCoords.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo Pt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDraftCoords([])}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear & Redraw</span>
                </button>

                {selectedLot && (
                  <button
                    type="button"
                    disabled={draftCoords.length < 3}
                    onClick={handleSaveBoundaryToSelectedLot}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save to {selectedLot.id}</span>
                  </button>
                )}

                {mapMode === 'draw' && (
                  <button
                    type="button"
                    disabled={draftCoords.length < 3}
                    onClick={handleCreateNewLotFromDrawn}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register New Lot ({draftAreaHa} ha)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCancelDigitize}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 font-semibold"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Larger Map Container: 650px default, 80vh when expanded */}
        <div
          className={
            'relative w-full rounded-xl overflow-hidden border border-slate-300 shadow-inner z-0 transition-all ' +
            (isExpanded ? 'h-[78vh] min-h-[680px]' : 'h-[650px]')
          }
        >
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        </div>
      </div>

      {/* Right Column: Selected Parcel Inspector & Quick Switcher */}
      <div
        className={
          (isExpanded ? 'xl:col-span-12 ' : 'xl:col-span-4 2xl:col-span-3 ') +
          'bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between shadow-2xs'
        }
      >
        {selectedLot ? (
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {selectedLot.id}
                </span>
                <h4 className="text-lg font-extrabold text-slate-900">
                  {selectedLot.hacienda}
                </h4>
              </div>
              <span
                className={
                  'px-2.5 py-1 rounded-full text-xs font-bold border ' +
                  getStatusStyles(selectedLot.status).badge
                }
              >
                {selectedLot.status}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <dt className="text-slate-500">Planter</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {selectedLot.planter}
                </dd>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <dt className="text-slate-500">Variety & Class</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {selectedLot.variety} ({selectedLot.cropClass})
                </dd>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <dt className="text-slate-500">Top / Bottom Brix</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {selectedLot.topBrix}° / {selectedLot.bottomBrix}° (Avg {selectedLot.avgBrix}°)
                </dd>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <dt className="text-slate-500">Maturity Ratio</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {selectedLot.maturityRatio} T/B
                </dd>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <dt className="text-slate-500">Est. Cane Tonnage</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {selectedLot.estimatedTons.toLocaleString()} MT ({selectedLot.areaHa} ha)
                </dd>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <dt className="text-slate-500">Est. Sugar Yield</dt>
                <dd className="font-bold text-emerald-700 mt-0.5">
                  {selectedLot.estimatedLkgTc} LKg/TC
                </dd>
              </div>
            </dl>

            {/* Quick Polygon Actions */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleStartEditSelected}
                className="w-full py-2 px-3 rounded-lg border border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Reshape {selectedLot.id} Polygon on Satellite</span>
              </button>
            </div>

            {/* Quick Jump to Parcel */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-500 mb-2">
                Quick Jump to Parcel:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lots.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleFocusLot(l)}
                    className={
                      'px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-all ' +
                      (selectedLot.id === l.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100')
                    }
                  >
                    {l.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Select a parcel on the satellite map.</p>
        )}

        {selectedLot && (
          <button
            onClick={() => onSelectLot(selectedLot)}
            className="mt-5 w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            Open Full Lot Inspector & Harvest Dispatch
          </button>
        )}
      </div>
    </div>
  );
}
`,

  'src/components/Modals.jsx': `import React, { useState, useEffect } from 'react';
import { X, MapPin } from 'lucide-react';

export function QuickBrixModal({ isOpen, onClose, lots, onUpdateBrix }) {
  const [selectedLotId, setSelectedLotId] = useState(lots[0] ? lots[0].id : '');
  const [topBrix, setTopBrix] = useState('20.2');
  const [bottomBrix, setBottomBrix] = useState('20.6');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedLotId) return;
    onUpdateBrix(selectedLotId, parseFloat(topBrix), parseFloat(bottomBrix));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-900">
            Log Field Refractometer Sample
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Farm Lot
            </label>
            <select
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} — {l.hacienda} ({l.planter})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Top Stalk Brix (°Bx)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={topBrix}
                onChange={(e) => setTopBrix(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bottom Stalk Brix (°Bx)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={bottomBrix}
                onChange={(e) => setBottomBrix(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
            >
              Save Sample
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RegisterLotModal({
  isOpen,
  onClose,
  onAddLot,
  initialCoordinates,
  initialAreaHa,
}) {
  const [hacienda, setHacienda] = useState('');
  const [planter, setPlanter] = useState('');
  const [sector, setSector] = useState('Sector A - North');
  const [variety, setVariety] = useState('Phil 2006-2289');
  const [cropClass, setCropClass] = useState('Plant Cane');
  const [areaHa, setAreaHa] = useState('10.5');
  const [cropAgeMonths, setCropAgeMonths] = useState('11.8');
  const [topBrix, setTopBrix] = useState('20.0');
  const [bottomBrix, setBottomBrix] = useState('20.5');

  useEffect(() => {
    if (initialAreaHa) {
      setAreaHa(String(initialAreaHa));
    }
  }, [initialAreaHa]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddLot({
      id: 'LOT-' + Math.floor(100 + Math.random() * 899),
      hacienda,
      planter,
      sector,
      variety,
      cropClass,
      areaHa: parseFloat(areaHa),
      expectedTcHa: 75,
      plantingDate: '2025-10-25',
      cropAgeMonths: parseFloat(cropAgeMonths),
      topBrix: parseFloat(topBrix),
      bottomBrix: parseFloat(bottomBrix),
      soilMoisture: 'Optimal (18%)',
      lastSampled: new Date().toISOString().split('T')[0],
      coordinates: initialCoordinates || null,
      dispatch: null,
    });
    setHacienda('');
    setPlanter('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Register New Sugarcane Lot
            </h3>
            {initialCoordinates && initialCoordinates.length >= 3 && (
              <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                Attached Drawn Polygon ({initialCoordinates.length} vertices • {initialAreaHa} ha)
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hacienda / Farm Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Hda. Sta. Teresa"
                value={hacienda}
                onChange={(e) => setHacienda(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Planter Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rafael Lacson"
                value={planter}
                onChange={(e) => setPlanter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sector
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option>Sector A - North</option>
                <option>Sector B - Central</option>
                <option>Sector C - Upland</option>
                <option>Sector D - Mill District</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Cane Variety
              </label>
              <select
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option>Phil 2006-2289</option>
                <option>VMC 84-524</option>
                <option>Phil 99-1793</option>
                <option>Phil 8013</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Crop Class
              </label>
              <select
                value={cropClass}
                onChange={(e) => setCropClass(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option>Plant Cane</option>
                <option>Ratoon 1</option>
                <option>Ratoon 2</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Area (ha)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Age (mos)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={cropAgeMonths}
                onChange={(e) => setCropAgeMonths(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Top Brix
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={topBrix}
                onChange={(e) => setTopBrix(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bot. Brix
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={bottomBrix}
                onChange={(e) => setBottomBrix(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
            >
              Register Lot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
`,

  'src/App.jsx': `import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { INITIAL_LOTS } from './data/initialLots';
import { evaluateLotMetrics } from './utils/caneCalculations';
import {
  fetchAllLots,
  createFarmLot,
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
  const [isBrixModalOpen, setIsBrixModalOpen] = useState(false);
  const [isNewLotModalOpen, setIsNewLotModalOpen] = useState(false);
  const [pendingPolygonCoords, setPendingPolygonCoords] = useState(null);
  const [pendingPolygonAreaHa, setPendingPolygonAreaHa] = useState(null);

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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
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
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
          />
        )}

        {viewMode === 'map' && (
          <ParcelMapView
            lots={filteredLots}
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
            onUpdateLotBoundary={handleUpdateLotBoundary}
            onCreateLotFromPolygon={handleCreateLotFromPolygon}
          />
        )}

        {viewMode === 'table' && (
          <PlanterTableView
            lots={filteredLots}
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
          />
        )}
      </main>

      <LotInspectorDrawer
        lot={selectedLot}
        onClose={() => setSelectedLotId(null)}
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

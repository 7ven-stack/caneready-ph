import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Upload,
  Pencil,
  Plus,
  Check,
  X,
  RotateCcw,
  RotateCw,
  Trash2,
  Crosshair,
  ExternalLink,
  Calendar,
  Compass,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Search,
  MapPin,
  GripVertical,
  ChevronsUpDown,
  Layers,
  Eye,
  EyeOff,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import {
  getStatusStyles,
  calculatePolygonAreaHa,
  computeCentroidLatLng,
  pointInRing,
  PLANTER_ASSOCIATIONS,
} from '../utils/caneCalculations';

const KML_STORAGE_KEY = 'caneready_kml_overlays_v1';
const PANEL_WIDTH_KEY = 'caneready_map_panel_width_v1';
const KML_DEFAULTS_KEY = 'caneready_kml_quick_defaults_v1';

// ---- Performance tuning knobs -------------------------------------------------
const KML_PERSIST_MAX_CHARS = 3000000;
const KML_DRAW_CHUNK = 300;
const LABEL_MIN_ZOOM_LOTS = 14;
const LABEL_MIN_ZOOM_KML = 16;
const MAX_VISIBLE_LABELS = 110;
const LABEL_BOX_W = 122;
const LABEL_BOX_H = 34;
const MAX_MIDPOINT_HANDLES = 150;
const KML_FOLDER_AUTO_COLLAPSE = 40;
const KML_PAGE_SIZE = 150;

const BASEMAPS = {
  googleHybrid: {
    name: 'Google Earth',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Imagery &copy; Google Earth',
    maxNativeZoom: 20,
    maxZoom: 22,
  },
  esriWorld: {
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl:
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 19,
    maxZoom: 22,
  },
  googleSat: {
    name: 'Clean Sat',
    url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Imagery &copy; Google Satellite',
    maxNativeZoom: 20,
    maxZoom: 22,
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value, max = 24) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function normalizePlanterKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\(\d+\)$/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function formatPlanterTitleCase(rawName) {
  const cleaned = String(rawName ?? '')
    .replace(/\(\d+\)$/g, '')
    .trim();
  if (!cleaned) return 'Unnamed Planter';
  return cleaned
    .split(/\s+/)
    .map((w) =>
      w.length <= 2 && w === w.toUpperCase()
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(' ');
}

function generateUniqueLotId(planterName, existingIdsSet) {
  const clean = String(planterName || 'P')
    .trim()
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  const prefix = clean.charAt(0) || 'L';
  let num = 100;
  while (existingIdsSet.has(`LOT-${prefix}${num}`)) {
    num++;
  }
  const newId = `LOT-${prefix}${num}`;
  existingIdsSet.add(newId);
  return newId;
}

// 2D rotation-only drag patch
function patchDraggableForRotation(draggable, bearingRef) {
  if (!draggable || draggable._rotationPatched) return;
  draggable._rotationPatched = true;
  const origUpdate = draggable._updatePosition.bind(draggable);
  draggable._updatePosition = function () {
    const deg = bearingRef.current || 0;
    if (deg !== 0 && this._startPos && this._newPos && !this._newPos._rotAdjusted) {
      const rawOffset = this._newPos.subtract(this._startPos);
      const rad = (-deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rx = rawOffset.x * cos - rawOffset.y * sin;
      const ry = rawOffset.x * sin + rawOffset.y * cos;
      const nextPt = this._startPos.add(new L.Point(rx, ry));
      nextPt._rotAdjusted = true;
      this._newPos = nextPt;
    }
    return origUpdate();
  };
}

const PolygonNodeIcon = React.memo(function PolygonNodeIcon({
  color = '#10b981',
  className = 'w-4 h-4 shrink-0',
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 6L18 5L19 17L5 18L6 6Z"
        stroke={color}
        strokeWidth="2"
        fill={color}
        fillOpacity="0.18"
      />
      <circle cx="6" cy="6" r="2.5" fill="#ffffff" stroke={color} strokeWidth="1.8" />
      <circle cx="18" cy="5" r="2.5" fill="#ffffff" stroke={color} strokeWidth="1.8" />
      <circle cx="19" cy="17" r="2.5" fill="#ffffff" stroke={color} strokeWidth="1.8" />
      <circle cx="5" cy="18" r="2.5" fill="#ffffff" stroke={color} strokeWidth="1.8" />
    </svg>
  );
});

function getLotCoordinates(lot, index) {
  if (lot.coordinates && Array.isArray(lot.coordinates) && lot.coordinates.length >= 3) {
    return lot.coordinates;
  }
  if (lot.polygon && Array.isArray(lot.polygon) && lot.polygon.length >= 3) {
    return lot.polygon;
  }
  const lat = Number(lot.latitude) || 10.8185;
  const lng = Number(lot.longitude) || 123.0145;
  const areaHa = Math.max(0.5, Number(lot.areaHa) || 6);
  const halfSideDeg = Math.sqrt(areaHa * 10000) / 2 / 111320;
  const skew = ((index % 5) - 2) * 0.00018;
  return [
    [Number((lat + halfSideDeg + skew).toFixed(6)), Number((lng - halfSideDeg).toFixed(6))],
    [Number((lat + halfSideDeg).toFixed(6)), Number((lng + halfSideDeg + skew).toFixed(6))],
    [Number((lat - halfSideDeg - skew).toFixed(6)), Number((lng + halfSideDeg).toFixed(6))],
    [Number((lat - halfSideDeg).toFixed(6)), Number((lng - halfSideDeg - skew).toFixed(6))],
  ];
}

function isMultiRingLot(lot) {
  return Boolean(lot) && Array.isArray(lot.multiCoordinates) && lot.multiCoordinates.length > 1;
}

function getLotRings(lot, index) {
  if (isMultiRingLot(lot)) {
    const rings = lot.multiCoordinates.filter((r) => Array.isArray(r) && r.length >= 3);
    if (rings.length > 1) return rings;
  }
  return [getLotCoordinates(lot, index)];
}

function ringsToLatLngs(rings) {
  return rings.length > 1 ? rings.map((r) => [r]) : rings[0];
}

function getRingsBounds(rings) {
  return L.latLngBounds(rings.flat());
}

function getFeaturesBounds(features) {
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const feat of features) {
    const coords = feat.coordinates;
    if (!Array.isArray(coords)) continue;
    for (let i = 0; i < coords.length; i++) {
      const lat = coords[i][0];
      const lng = coords[i][1];
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
    }
  }
  if (south > north || west > east) return null;
  return L.latLngBounds([
    [south, west],
    [north, east],
  ]);
}

function ringCentroid(ring) {
  const n = ring.length;
  const [oy, ox] = ring[0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const x1 = ring[i][1] - ox;
    const y1 = ring[i][0] - oy;
    const x2 = ring[(i + 1) % n][1] - ox;
    const y2 = ring[(i + 1) % n][0] - oy;
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-14) {
    let sy = 0;
    let sx = 0;
    for (let i = 0; i < n; i++) {
      sy += ring[i][0];
      sx += ring[i][1];
    }
    return [sy / n, sx / n];
  }
  return [oy + cy / (3 * a), ox + cx / (3 * a)];
}

function getLotStyle(lot, sel) {
  const base = getStatusStyles(lot.status);
  const isMergeSel = Boolean(sel.isMergeMode && sel.mergeSet.has(lot.id));
  const isMultiSel = Boolean(sel.multiLotSet && sel.multiLotSet.has(lot.id));
  const isPopupSel = Boolean(sel.mapMode === 'view' && sel.popupId === lot.id);
  const selected = isMergeSel || isMultiSel || isPopupSel;
  return {
    selected,
    style: {
      color: isMergeSel
        ? '#7c3aed'
        : isMultiSel
        ? '#f43f5e'
        : selected
        ? '#ffffff'
        : base.polygonStroke,
      weight: isMergeSel || isMultiSel ? 3.5 : selected ? 3 : 1.8,
      fillColor: isMergeSel
        ? '#8b5cf6'
        : isMultiSel
        ? '#fb7185'
        : base.polygonFill,
      fillOpacity:
        sel.mapMode !== 'view'
          ? 0.25
          : isMultiSel
          ? 0.62
          : selected
          ? 0.68
          : 0.44,
      smoothFactor: 1.2,
    },
  };
}

function styleKey(style) {
  return style.color + '|' + style.weight + '|' + style.fillColor + '|' + style.fillOpacity;
}

function getKmlStyle(isActive, isMultiSel = false) {
  if (isMultiSel) {
    return {
      color: '#fda4af',
      weight: 3,
      fillColor: '#f43f5e',
      fillOpacity: 0.58,
      smoothFactor: 1.5,
    };
  }
  return {
    color: isActive ? '#ffffff' : '#38bdf8',
    weight: isActive ? 3.2 : 1.8,
    fillColor: '#0284c7',
    fillOpacity: isActive ? 0.62 : 0.35,
    smoothFactor: 1.5,
  };
}

// Restored dark pill background container (rendered in unrotated screen space so it never blurs or spins)
function lotLabelHtml(lot, slices) {
  const note = slices > 1 ? ` • ${slices} slices` : '';
  return (
    '<div class="cane-map-label-pill">' +
    '<div class="cane-map-label-title">' +
    escapeHtml(truncate(lot.planter, 24)) +
    '</div>' +
    '<div class="cane-map-label-sub">' +
    escapeHtml(lot.id) +
    ' (' +
    escapeHtml(Number(lot.areaHa).toFixed(2)) +
    ' ha' +
    note +
    ')</div></div>'
  );
}

function kmlLabelHtml(feat) {
  return (
    '<div class="cane-map-label-pill cane-map-label-pill-kml">' +
    '<div class="cane-map-label-title" style="color:#e0f2fe;">' +
    escapeHtml(truncate(feat.name, 24)) +
    '</div>' +
    '<div class="cane-map-label-sub">' +
    escapeHtml(feat.areaHa) +
    ' ha</div></div>'
  );
}

function parseCoordinateInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const text = rawInput.trim();

  const urlMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlMatch) {
    return {
      lat: Number(parseFloat(urlMatch[1]).toFixed(6)),
      lng: Number(parseFloat(urlMatch[2]).toFixed(6)),
    };
  }

  const dmsRegex =
    /(\d+)[°\s]+(\d+)['’\s]+(\d+(?:\.\d+)?)["”\s]*([NSns])[\s,;/]+(\d+)[°\s]+(\d+)['’\s]+(\d+(?:\.\d+)?)["”\s]*([EWew])/;
  const dmsMatch = text.match(dmsRegex);
  if (dmsMatch) {
    let lat =
      Number(dmsMatch[1]) +
      Number(dmsMatch[2]) / 60 +
      Number(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;

    let lng =
      Number(dmsMatch[5]) +
      Number(dmsMatch[6]) / 60 +
      Number(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;

    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
  }

  const numMatches = text.match(/-?\d+(?:\.\d+)?/g);
  if (numMatches && numMatches.length >= 2) {
    const first = parseFloat(numMatches[0]);
    const second = parseFloat(numMatches[1]);

    if (Number.isFinite(first) && Number.isFinite(second)) {
      if (Math.abs(first) > 90 && Math.abs(second) <= 90) {
        return { lat: Number(second.toFixed(6)), lng: Number(first.toFixed(6)) };
      }
      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
        return { lat: Number(first.toFixed(6)), lng: Number(second.toFixed(6)) };
      }
    }
  }

  return null;
}

function parseKmlDocument(xmlText, fileName = 'Imported KML') {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid KML XML structure.');
  }

  const features = [];
  let counter = 1;
  const batchStamp = Date.now();

  function parseCoordsText(coordStr) {
    if (!coordStr) return [];
    const tuples = coordStr
      .trim()
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    const coords = [];
    for (const tuple of tuples) {
      const parts = tuple.split(',').map((n) => parseFloat(n));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        coords.push([Number(parts[1].toFixed(6)), Number(parts[0].toFixed(6))]);
      }
    }
    if (
      coords.length > 3 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
    ) {
      coords.pop();
    }
    return coords;
  }

  function getDirectChildText(parent, tagName) {
    for (const child of Array.from(parent.children || [])) {
      if (child.localName === tagName) {
        return child.textContent.trim();
      }
    }
    return '';
  }

  function traverseNode(node, folderPath = []) {
    if (!node || !node.children) return;

    for (const child of Array.from(node.children)) {
      const tag = child.localName;

      if (tag === 'Document' || tag === 'kml') {
        const docName = getDirectChildText(child, 'name');
        const nextPath = docName ? [...folderPath, docName] : folderPath;
        traverseNode(child, nextPath);
      } else if (tag === 'Folder') {
        const folderName = getDirectChildText(child, 'name') || 'Unnamed Folder';
        traverseNode(child, [...folderPath, folderName]);
      } else if (tag === 'Placemark') {
        const name =
          getDirectChildText(child, 'name') || `KML Parcel ${counter}`;
        const description = getDirectChildText(child, 'description') || '';
        const folderLabel =
          folderPath.length > 0
            ? folderPath.join(' / ')
            : fileName.replace(/\.kml$/i, '');

        const polygons = child.getElementsByTagNameNS('*', 'Polygon');
        if (polygons.length > 0) {
          for (let i = 0; i < polygons.length; i++) {
            const polyNode = polygons[i];
            const coordNodes = polyNode.getElementsByTagNameNS('*', 'coordinates');
            if (coordNodes.length > 0) {
              const ringCoords = parseCoordsText(coordNodes[0].textContent);
              if (ringCoords.length >= 3) {
                const areaHa = calculatePolygonAreaHa(ringCoords);
                const centroid = computeCentroidLatLng({ coordinates: ringCoords });
                features.push({
                  id: `KML-${batchStamp}-${counter++}`,
                  name: polygons.length > 1 ? `${name} (${i + 1})` : name,
                  folder: folderLabel,
                  description,
                  type: 'polygon',
                  coordinates: ringCoords,
                  areaHa,
                  latitude: centroid.latitude,
                  longitude: centroid.longitude,
                });
              }
            }
          }
          continue;
        }

        const points = child.getElementsByTagNameNS('*', 'Point');
        if (points.length > 0) {
          const coordNodes = points[0].getElementsByTagNameNS('*', 'coordinates');
          if (coordNodes.length > 0) {
            const ptCoords = parseCoordsText(coordNodes[0].textContent);
            if (ptCoords.length >= 1) {
              const [lat, lng] = ptCoords[0];
              features.push({
                id: `KML-PT-${batchStamp}-${counter++}`,
                name,
                folder: folderLabel,
                description,
                type: 'point',
                coordinates: [
                  [Number((lat + 0.0008).toFixed(6)), Number((lng - 0.0008).toFixed(6))],
                  [Number((lat + 0.0008).toFixed(6)), Number((lng + 0.0008).toFixed(6))],
                  [Number((lat - 0.0008).toFixed(6)), Number((lng + 0.0008).toFixed(6))],
                  [Number((lat - 0.0008).toFixed(6)), Number((lng - 0.0008).toFixed(6))],
                ],
                areaHa: 3.1,
                latitude: lat,
                longitude: lng,
              });
            }
          }
        }
      }
    }
  }

  traverseNode(xmlDoc, []);
  return features;
}

function parseGeoJsonDocument(jsonText, fileName = 'Imported GeoJSON') {
  const geo = JSON.parse(jsonText);
  const features = [];
  let counter = 1;
  const batchStamp = Date.now();
  const rawFeatures =
    geo.type === 'FeatureCollection'
      ? geo.features || []
      : geo.type === 'Feature'
      ? [geo]
      : [];

  const folderName = fileName.replace(/\.(geo)?json$/i, '');

  for (const f of rawFeatures) {
    const props = f.properties || {};
    const name =
      props.Name ||
      props.name ||
      props.planter ||
      props.hacienda ||
      props.LOT_ID ||
      props.id ||
      `Parcel ${counter}`;
    const folder = props.folder || props.Folder || props.sector || folderName;
    const geom = f.geometry;
    if (!geom) continue;

    const addRing = (lngLatRing) => {
      const coords = lngLatRing
        .map((pt) => [Number(pt[1].toFixed(6)), Number(pt[0].toFixed(6))])
        .filter((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
      if (coords.length >= 3) {
        const areaHa = calculatePolygonAreaHa(coords);
        const centroid = computeCentroidLatLng({ coordinates: coords });
        features.push({
          id: `GEO-${batchStamp}-${counter++}`,
          name: String(name),
          folder: String(folder),
          description: '',
          type: 'polygon',
          coordinates: coords,
          areaHa,
          latitude: centroid.latitude,
          longitude: centroid.longitude,
        });
      }
    };

    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
      addRing(geom.coordinates[0]);
    } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
      geom.coordinates.forEach((poly) => {
        if (Array.isArray(poly?.[0])) addRing(poly[0]);
      });
    }
  }

  return features;
}

// ---------------------------------------------------------------------------------
// Imported KML tree
// ---------------------------------------------------------------------------------
const KmlTreeSection = React.memo(function KmlTreeSection({
  groups,
  totalCount,
  activeId,
  multiKmlSet,
  hiddenKmlSet,
  openFolders,
  onToggleFolder,
  onFocus,
  onQuickRegisterSingleKml,
  onQuickRegisterKmlFolder,
  onToggleHideKml,
  onToggleHideKmlFolder,
  onClear,
  notPersisted,
}) {
  const [limits, setLimits] = useState({});
  const folderEntries = Object.entries(groups);

  if (folderEntries.length === 0) return null;

  return (
    <div className="pb-2">
      <div className="px-3 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
        <span>Imported KML Layers ({totalCount.toLocaleString()})</span>
        <button
          type="button"
          onClick={onClear}
          className="text-rose-600 hover:underline font-semibold cursor-pointer"
        >
          Clear KML
        </button>
      </div>

      {notPersisted && (
        <div className="px-3 pb-1 text-[10px] font-semibold text-amber-600">
          Layer is too large to remember after a refresh.
        </div>
      )}

      {folderEntries.map(([folderName, feats]) => {
        const fKey = `kml:${folderName}`;
        const stored = openFolders[fKey];
        const expanded =
          stored === undefined ? feats.length <= KML_FOLDER_AUTO_COLLAPSE : stored;
        const limit = limits[fKey] || KML_PAGE_SIZE;
        const shown = expanded ? feats.slice(0, limit) : [];
        const allFolderHidden =
          feats.length > 0 && feats.every((f) => hiddenKmlSet.has(f.id));

        return (
          <div key={fKey} className="mt-0.5">
            <div className="w-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 text-left group">
              <button
                type="button"
                onClick={() => onToggleFolder(fKey, expanded)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                {expanded ? (
                  <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span
                  className={
                    'truncate flex-1 ' + (allFolderHidden ? 'opacity-45 line-through' : '')
                  }
                >
                  {folderName}
                </span>
              </button>

              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                {feats.length.toLocaleString()}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickRegisterKmlFolder(folderName, feats);
                }}
                title={`1-Click Register all ${feats.length} plot(s) in "${folderName}" (auto-merges slices by planter name)`}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-opacity cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHideKmlFolder(feats, !allFolderHidden);
                }}
                title={allFolderHidden ? 'Show folder on map' : 'Hide folder on map'}
                className={
                  'p-1 rounded transition-opacity cursor-pointer shrink-0 ' +
                  (allFolderHidden
                    ? 'opacity-100 text-slate-400 hover:text-white'
                    : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white')
                }
              >
                {allFolderHidden ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {expanded && (
              <div className="pl-5 pr-2 space-y-0.5 mt-0.5">
                {shown.map((feat) => {
                  const isMulti = multiKmlSet && multiKmlSet.has(feat.id);
                  const isHidden = hiddenKmlSet && hiddenKmlSet.has(feat.id);
                  const isSel = isMulti || activeId === feat.id;
                  return (
                    <div
                      key={feat.id}
                      onMouseDown={(e) => {
                        if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault();
                      }}
                      onClick={(e) => onFocus(feat, e, shown)}
                      title="Click to inspect • Ctrl/Shift+Click to multi-select • + to instant register • Eye to hide"
                      className={
                        'group w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ' +
                        (isMulti
                          ? 'bg-sky-700/90 text-white font-bold ring-1 ring-sky-400/50'
                          : isSel
                          ? 'bg-sky-600 text-white font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200')
                      }
                    >
                      <div
                        className={
                          'flex items-center gap-2 min-w-0 flex-1 ' +
                          (isHidden ? 'opacity-45' : '')
                        }
                      >
                        <PolygonNodeIcon
                          color={
                            isHidden
                              ? '#64748b'
                              : isSel
                              ? '#ffffff'
                              : '#0284c7'
                          }
                        />
                        <span
                          className={
                            'truncate uppercase font-semibold ' +
                            (isHidden ? 'line-through' : '')
                          }
                        >
                          {feat.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={
                            'text-[10px] font-mono tabular-nums ' +
                            (isHidden ? 'opacity-45 ' : '') +
                            (isSel ? 'text-sky-100' : 'text-slate-400')
                          }
                        >
                          {feat.areaHa} ha
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickRegisterSingleKml(feat);
                          }}
                          title={`1-Click Register "${feat.name}" (${feat.areaHa} ha) as Planter Lot`}
                          className={
                            'p-0.5 rounded transition-opacity cursor-pointer ' +
                            (isSel
                              ? 'opacity-90 hover:opacity-100 text-white hover:bg-white/20'
                              : 'opacity-0 group-hover:opacity-100 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15')
                          }
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleHideKml(feat);
                          }}
                          title={isHidden ? 'Show plotted area' : 'Hide plotted area'}
                          className={
                            'p-0.5 rounded transition-opacity cursor-pointer ' +
                            (isHidden
                              ? 'opacity-100 ' +
                                (isSel
                                  ? 'text-white hover:text-sky-200'
                                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white')
                              : isSel
                              ? 'opacity-90 hover:opacity-100 text-white'
                              : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white')
                          }
                        >
                          {isHidden ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {feats.length > limit && (
                  <button
                    type="button"
                    onClick={() =>
                      setLimits((prev) => ({ ...prev, [fKey]: limit + KML_PAGE_SIZE }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                  >
                    Show {Math.min(KML_PAGE_SIZE, feats.length - limit)} more (
                    {(feats.length - limit).toLocaleString()} hidden)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------------
// Registered Planter Lots Tree
// ---------------------------------------------------------------------------------
const PlanterTreeSection = React.memo(function PlanterTreeSection({
  groups,
  totalLotsCount,
  isMergeMode,
  mergeSet,
  multiLotSet,
  hiddenLotSet,
  activePopupLotId,
  openFolders,
  onToggleFolder,
  onToggleAllFolders,
  onLotClick,
  onToggleHideLot,
  onToggleHideLotFolder,
}) {
  const folderEntries = Object.entries(groups);
  const allExpanded = folderEntries.every(
    ([name]) => openFolders[`lot:${name}`] !== false
  );

  const visibleLotsFlat = useMemo(() => {
    const list = [];
    folderEntries.forEach(([folderName, groupLots]) => {
      const fKey = `lot:${folderName}`;
      const expanded = openFolders[fKey] === undefined ? true : openFolders[fKey];
      if (expanded) {
        list.push(...groupLots);
      }
    });
    return list;
  }, [folderEntries, openFolders]);

  return (
    <div className="pt-1">
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>Registered Planter Lots ({totalLotsCount})</span>
        {folderEntries.length > 1 && onToggleAllFolders && (
          <button
            type="button"
            onClick={() => onToggleAllFolders(!allExpanded)}
            title={allExpanded ? 'Collapse all folders' : 'Expand all folders'}
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
          >
            <ChevronsUpDown className="w-3 h-3" />
            <span>{allExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
        )}
      </div>

      {folderEntries.map(([folderName, groupLots]) => {
        const fKey = `lot:${folderName}`;
        const expanded =
          openFolders[fKey] === undefined ? true : openFolders[fKey];
        const allFolderHidden =
          groupLots.length > 0 && groupLots.every((l) => hiddenLotSet.has(l.id));

        return (
          <div key={fKey} className="mt-0.5">
            <div className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-bold text-slate-800 dark:text-slate-100 text-left group">
              <button
                type="button"
                onClick={() => onToggleFolder(fKey, expanded)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                {expanded ? (
                  <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
                )}
                <span
                  className={
                    'truncate flex-1 ' + (allFolderHidden ? 'opacity-45 line-through' : '')
                  }
                >
                  {folderName}
                </span>
              </button>

              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                {groupLots.length}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHideLotFolder(groupLots, !allFolderHidden);
                }}
                title={allFolderHidden ? 'Show folder lots on map' : 'Hide folder lots on map'}
                className={
                  'p-1 rounded transition-opacity cursor-pointer shrink-0 ' +
                  (allFolderHidden
                    ? 'opacity-100 text-slate-400 hover:text-white'
                    : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white')
                }
              >
                {allFolderHidden ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {expanded && (
              <div className="pl-5 pr-2 space-y-0.5 mt-0.5 pb-1">
                {groupLots.map((lot) => {
                  const isMulti = multiLotSet && multiLotSet.has(lot.id);
                  const isHidden = hiddenLotSet && hiddenLotSet.has(lot.id);
                  const isSel = isMergeMode
                    ? mergeSet.has(lot.id)
                    : isMulti || activePopupLotId === lot.id;
                  const st = getStatusStyles(lot.status);

                  return (
                    <div
                      key={lot.id}
                      onMouseDown={(e) => {
                        if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault();
                      }}
                      onClick={(e) => onLotClick(lot, e, visibleLotsFlat)}
                      title={`${lot.planter} — ${lot.id} • ${lot.hacienda} (${Number(lot.areaHa).toFixed(2)} ha) • Ctrl/Shift+Click to multi-select`}
                      className={
                        'group w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ' +
                        (isSel
                          ? (isMergeMode
                              ? 'bg-violet-700'
                              : isMulti
                              ? 'bg-sky-700 ring-1 ring-sky-400/50'
                              : 'bg-emerald-800') + ' text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200')
                      }
                    >
                      <div
                        className={
                          'flex items-center gap-2 min-w-0 flex-1 ' +
                          (isHidden ? 'opacity-45' : '')
                        }
                      >
                        <PolygonNodeIcon
                          color={
                            isHidden
                              ? '#64748b'
                              : isSel
                              ? '#ffffff'
                              : st.polygonFill
                          }
                        />
                        <span
                          className={
                            'truncate uppercase font-bold tracking-tight text-xs ' +
                            (isHidden ? 'line-through' : '')
                          }
                        >
                          {lot.planter}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={
                            'text-[11px] font-mono font-semibold tabular-nums ' +
                            (isHidden ? 'opacity-45 ' : '') +
                            (isSel
                              ? 'text-white'
                              : 'text-slate-400 dark:text-slate-400')
                          }
                        >
                          {Number(lot.areaHa).toFixed(2)} ha
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleHideLot(lot);
                          }}
                          title={isHidden ? 'Show plotted area' : 'Hide plotted area'}
                          className={
                            'p-0.5 rounded transition-opacity cursor-pointer ' +
                            (isHidden
                              ? 'opacity-100 ' +
                                (isSel
                                  ? 'text-white hover:text-emerald-200'
                                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white')
                              : isSel
                              ? 'opacity-90 hover:opacity-100 text-white'
                              : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white')
                          }
                        >
                          {isHidden ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default function ParcelMapView({
  lots = [],
  onSelectLot,
  isMergeMode = false,
  mergeSelectedIds = [],
  onToggleMergeMode,
  onUpdateLotBoundary,
  onCreateLotFromPolygon,
  onQuickAddLot,
  onBatchAddLots,
  isActive = true,
}) {
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
      return saved >= 220 && saved <= 680 ? saved : 330;
    } catch {
      return 330;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');
  const [openFolders, setOpenFolders] = useState({});

  const [importedFeatures, setImportedFeatures] = useState(() => {
    try {
      const saved = localStorage.getItem(KML_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeKmlFeature, setActiveKmlFeature] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [renderProgress, setRenderProgress] = useState(null);
  const [kmlNotPersisted, setKmlNotPersisted] = useState(false);

  const [kmlDefaults, setKmlDefaults] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KML_DEFAULTS_KEY) || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch {}
    return {
      hacienda: 'Hda. San Juan',
      barangay: 'Brgy. Dos Hermanas',
      city: 'Talisay City',
      association: 'Private',
      plannedHarvestDate: '',
    };
  });
  const [quickPlanterName, setQuickPlanterName] = useState('');
  const [showKmlDefaultsForm, setShowKmlDefaultsForm] = useState(false);

  // Ctrl / Shift multi-selection state
  const [multiSelectedLotIds, setMultiSelectedLotIds] = useState([]);
  const [multiSelectedKmlIds, setMultiSelectedKmlIds] = useState([]);
  const [isMultiBreakdownOpen, setIsMultiBreakdownOpen] = useState(false);
  const lastClickedLotIdRef = useRef(null);
  const lastClickedKmlIdRef = useRef(null);

  // Hidden plotted areas state
  const [hiddenLotIds, setHiddenLotIds] = useState([]);
  const [hiddenKmlIds, setHiddenKmlIds] = useState([]);

  // 2D Map Rotation Only (Bearing 0-360°)
  const [mapBearing, setMapBearing] = useState(0);
  const [isRotatingMap, setIsRotatingMap] = useState(false);
  const bearingRef = useRef(0);
  const rotAnimFrameRef = useRef(0);
  const zoomTrackRafRef = useRef(0);
  const suppressContextMenuRef = useRef(false);

  // Dynamic diagonal square geometry so rotating NEVER shows empty dark corners on left/right
  const [canvasBox, setCanvasBox] = useState({
    size: 2200,
    left: -400,
    top: -600,
  });

  const [coordQuery, setCoordQuery] = useState('');
  const [coordError, setCoordError] = useState('');
  const [searchedPin, setSearchedPin] = useState(null);

  const [activePopupLotId, setActivePopupLotId] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 320, y: 24 });
  const [basemapKey, setBasemapKey] = useState('googleHybrid');

  const [mapMode, setMapMode] = useState('view');
  const [editingLotId, setEditingLotId] = useState(null);
  const [draftCoords, setDraftCoords] = useState([]);
  const [autoUpdateArea, setAutoUpdateArea] = useState(true);

  const splitWrapperRef = useRef(null);
  const mapViewportRef = useRef(null);
  const mapContainerRef = useRef(null);
  const screenLabelsContainerRef = useRef(null);
  const compassBtnRef = useRef(null);
  const popupCardRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const labelOverlayRef = useRef(null);
  const polygonsGroupRef = useRef(null);
  const kmlGroupRef = useRef(null);
  const labelLayerRef = useRef(null);
  const searchPinGroupRef = useRef(null);
  const editLayerGroupRef = useRef(null);
  const fileInputRef = useRef(null);

  // Persistent layer & label registries
  const lotLayersRef = useRef(new Map());
  const kmlLayersRef = useRef(new Map());
  // key -> { anchorMarker, screenEl, lat, lng }
  const activeLabelMarkersRef = useRef(new Map());
  const labelItemsRef = useRef({ lots: [], kml: [] });
  const labelTimerRef = useRef(0);

  const isMergeModeRef = useRef(isMergeMode);
  const onSelectLotRef = useRef(onSelectLot);
  const activePopupLotIdRef = useRef(activePopupLotId);
  const activeKmlFeatureRef = useRef(activeKmlFeature);
  useEffect(() => {
    isMergeModeRef.current = isMergeMode;
    onSelectLotRef.current = onSelectLot;
    activePopupLotIdRef.current = activePopupLotId;
    activeKmlFeatureRef.current = activeKmlFeature;
  }, [isMergeMode, onSelectLot, activePopupLotId, activeKmlFeature]);

  // Convert inner containerPoint to outer viewport (screen) pixel coordinates (pure 2D rotation)
  const containerPtToViewportPt = useCallback((pt) => {
    const container = mapContainerRef.current;
    const viewport = mapViewportRef.current;
    if (!container || !viewport) return pt;

    const w = container.clientWidth || 1800;
    const h = container.clientHeight || 1800;
    const vw = viewport.clientWidth || 1200;
    const vh = viewport.clientHeight || 800;

    const dx = pt.x - w / 2;
    const dy = pt.y - h / 2;
    const deg = bearingRef.current || 0;
    if (deg === 0) {
      return {
        x: vw / 2 + dx,
        y: vh / 2 + dy,
      };
    }

    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return {
      x: vw / 2 + (dx * cos - dy * sin),
      y: vh / 2 + (dx * sin + dy * cos),
    };
  }, []);

  // Batched Read-Then-Write screen label position sync using Leaflet's native invisible anchors
  // Guarantees 0 spin, 100% crisp unrotated pill backgrounds, and smooth tracking during zoom/pan/rotate
  const syncScreenLabelsPosition = useCallback(() => {
    const vp = mapViewportRef.current;
    const activeMap = activeLabelMarkersRef.current;
    if (!vp || activeMap.size === 0) return;

    const vpRect = vp.getBoundingClientRect();
    const updates = [];

    // Pass 1: Read all anchor bounding rects in one batch (zero layout thrash)
    activeMap.forEach((entry) => {
      const anchorEl = entry.anchorMarker.getElement();
      if (anchorEl) {
        const r = anchorEl.getBoundingClientRect();
        updates.push({
          screenEl: entry.screenEl,
          x: r.left - vpRect.left,
          y: r.top - vpRect.top,
        });
      }
    });

    // Pass 2: Write positions to unrotated screen-space pill elements
    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      u.screenEl.style.left = `${u.x.toFixed(1)}px`;
      u.screenEl.style.top = `${u.y.toFixed(1)}px`;
    }
  }, []);

  // Direct 2D DOM rotation updater (updates map container & syncs unrotated screen labels in same frame)
  const applyLiveRotationDom = useCallback(
    (nextBearing) => {
      const normBearing = ((nextBearing % 360) + 360) % 360;
      bearingRef.current = normBearing;

      if (mapContainerRef.current) {
        mapContainerRef.current.style.transform =
          normBearing === 0 ? 'none' : `rotate(${normBearing.toFixed(2)}deg)`;
      }
      syncScreenLabelsPosition();
    },
    [syncScreenLabelsPosition]
  );

  useEffect(() => {
    try {
      localStorage.setItem(KML_DEFAULTS_KEY, JSON.stringify(kmlDefaults));
    } catch {}
  }, [kmlDefaults]);

  const findNearestLotDefaults = useCallback(
    (lat, lng) => {
      if (!Array.isArray(lots) || lots.length === 0) return kmlDefaults;
      let bestLot = null;
      let bestDist = Infinity;
      for (const l of lots) {
        const dLat = (Number(l.latitude) || 0) - lat;
        const dLng = (Number(l.longitude) || 0) - lng;
        const d2 = dLat * dLat + dLng * dLng;
        if (d2 < bestDist) {
          bestDist = d2;
          bestLot = l;
        }
      }
      if (bestLot && bestDist < 0.002) {
        return {
          hacienda: bestLot.hacienda || kmlDefaults.hacienda,
          barangay: bestLot.barangay || kmlDefaults.barangay,
          city: bestLot.city || kmlDefaults.city,
          association: bestLot.association || kmlDefaults.association,
          plannedHarvestDate: kmlDefaults.plannedHarvestDate || '',
        };
      }
      return kmlDefaults;
    },
    [lots, kmlDefaults]
  );

  useEffect(() => {
    if (activeKmlFeature) {
      setQuickPlanterName(formatPlanterTitleCase(activeKmlFeature.name));
      const nearest = findNearestLotDefaults(
        activeKmlFeature.latitude,
        activeKmlFeature.longitude
      );
      setKmlDefaults((prev) => ({
        ...prev,
        hacienda: nearest.hacienda,
        barangay: nearest.barangay,
        city: nearest.city,
        association: nearest.association,
      }));
    } else if (multiSelectedKmlIds.length > 0) {
      const firstKml = importedFeatures.find((f) => f.id === multiSelectedKmlIds[0]);
      if (firstKml) {
        setQuickPlanterName(formatPlanterTitleCase(firstKml.name));
      }
    }
  }, [activeKmlFeature, multiSelectedKmlIds, importedFeatures, findNearestLotDefaults]);

  const mergeSet = useMemo(
    () => new Set(Array.isArray(mergeSelectedIds) ? mergeSelectedIds : []),
    [mergeSelectedIds]
  );
  const multiLotSet = useMemo(
    () => new Set(multiSelectedLotIds),
    [multiSelectedLotIds]
  );
  const multiKmlSet = useMemo(
    () => new Set(multiSelectedKmlIds),
    [multiSelectedKmlIds]
  );
  const hiddenLotSet = useMemo(
    () => new Set(hiddenLotIds),
    [hiddenLotIds]
  );
  const hiddenKmlSet = useMemo(
    () => new Set(hiddenKmlIds),
    [hiddenKmlIds]
  );

  const hiddenLotSetRef = useRef(hiddenLotSet);
  hiddenLotSetRef.current = hiddenLotSet;
  const hiddenKmlSetRef = useRef(hiddenKmlSet);
  hiddenKmlSetRef.current = hiddenKmlSet;

  const selectionRef = useRef(null);
  selectionRef.current = {
    popupId: activePopupLotId,
    mergeSet,
    multiLotSet,
    isMergeMode,
    mapMode,
  };
  const activeKmlIdRef = useRef(null);
  activeKmlIdRef.current = activeKmlFeature ? activeKmlFeature.id : null;
  const multiKmlSetRef = useRef(multiKmlSet);
  multiKmlSetRef.current = multiKmlSet;

  const activePopupLot = useMemo(
    () => lots.find((l) => l.id === activePopupLotId) || null,
    [lots, activePopupLotId]
  );
  const editingLot = useMemo(
    () => lots.find((l) => l.id === editingLotId) || null,
    [lots, editingLotId]
  );
  const draftAreaHa = useMemo(() => calculatePolygonAreaHa(draftCoords), [draftCoords]);

  const totalHiddenCount = hiddenLotIds.length + hiddenKmlIds.length;

  const samePlanterKmlGroup = useMemo(() => {
    if (!activeKmlFeature) return [];
    const targetKey = normalizePlanterKey(activeKmlFeature.name);
    if (!targetKey) return [activeKmlFeature];
    return importedFeatures.filter(
      (f) =>
        f.folder === activeKmlFeature.folder &&
        normalizePlanterKey(f.name) === targetKey
    );
  }, [activeKmlFeature, importedFeatures]);

  const samePlanterKmlTotalHa = useMemo(
    () =>
      Number(
        samePlanterKmlGroup
          .reduce((sum, f) => sum + (Number(f.areaHa) || 0), 0)
          .toFixed(2)
      ),
    [samePlanterKmlGroup]
  );

  const buildLotFromKmlFeatures = useCallback(
    (kmlFeats = [], customPlanterName = null, existingIdsSet = new Set()) => {
      if (!Array.isArray(kmlFeats) || kmlFeats.length === 0) return null;
      const validFeats = kmlFeats.filter(
        (f) => Array.isArray(f.coordinates) && f.coordinates.length >= 3
      );
      if (validFeats.length === 0) return null;

      const sortedFeats = [...validFeats].sort(
        (a, b) => (Number(b.areaHa) || 0) - (Number(a.areaHa) || 0)
      );
      const primaryFeat = sortedFeats[0];
      const allRings = sortedFeats.map((f) => f.coordinates);
      const totalAreaHa = Number(
        sortedFeats.reduce((s, f) => s + (Number(f.areaHa) || 0), 0).toFixed(2)
      );
      const centroid = computeCentroidLatLng({ coordinates: allRings[0] });
      const locDefaults = findNearestLotDefaults(
        centroid.latitude,
        centroid.longitude
      );

      const finalPlanter =
        (customPlanterName && customPlanterName.trim()) ||
        formatPlanterTitleCase(primaryFeat.name);

      const newLotId = generateUniqueLotId(finalPlanter, existingIdsSet);
      const city = kmlDefaults.city?.trim() || locDefaults.city || 'Talisay City';
      const barangay =
        kmlDefaults.barangay?.trim() || locDefaults.barangay || 'Brgy. Dos Hermanas';
      const hacienda =
        kmlDefaults.hacienda?.trim() ||
        locDefaults.hacienda ||
        `Hda. ${primaryFeat.folder.replace(/^[*._,-]+/, '').trim() || 'San Juan'}`;
      const association =
        kmlDefaults.association || locDefaults.association || 'Private';

      return {
        id: newLotId,
        planter: finalPlanter,
        contactNumber: '',
        association,
        hacienda,
        barangay,
        city,
        sector: `${city} - ${barangay}`,
        areaHa: totalAreaHa,
        coordinates: allRings[0],
        multiCoordinates: allRings.length > 1 ? allRings : null,
        parcelCount: allRings.length,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        plannedHarvestDate: kmlDefaults.plannedHarvestDate || null,
        harvestNotes:
          allRings.length > 1
            ? `Imported & merged ${allRings.length} KML slices (${primaryFeat.folder})`
            : `Imported from KML (${primaryFeat.folder})`,
        variety: 'Phil 2006-2289',
        cropClass: 'Plant Cane',
        plantingDate: '2025-11-15',
        cropAgeMonths: 11,
      };
    },
    [kmlDefaults, findNearestLotDefaults]
  );

  const executeQuickRegisterKml = useCallback(
    async (kmlFeatsToRegister = [], mergeIntoOne = true, overridePlanterName = null) => {
      if (!Array.isArray(kmlFeatsToRegister) || kmlFeatsToRegister.length === 0) return;

      const existingIdsSet = new Set(lots.map((l) => String(l.id).toUpperCase()));
      const createdLots = [];

      if (mergeIntoOne) {
        const mergedLot = buildLotFromKmlFeatures(
          kmlFeatsToRegister,
          overridePlanterName,
          existingIdsSet
        );
        if (mergedLot) createdLots.push(mergedLot);
      } else {
        for (const feat of kmlFeatsToRegister) {
          const singleLot = buildLotFromKmlFeatures(
            [feat],
            overridePlanterName,
            existingIdsSet
          );
          if (singleLot) createdLots.push(singleLot);
        }
      }

      if (createdLots.length === 0) return;

      const consumedKmlIds = new Set(kmlFeatsToRegister.map((f) => f.id));
      setImportedFeatures((prev) => prev.filter((f) => !consumedKmlIds.has(f.id)));
      setMultiSelectedKmlIds((prev) => prev.filter((id) => !consumedKmlIds.has(id)));
      setHiddenKmlIds((prev) => prev.filter((id) => !consumedKmlIds.has(id)));
      if (activeKmlFeature && consumedKmlIds.has(activeKmlFeature.id)) {
        setActiveKmlFeature(null);
      }

      if (createdLots.length === 1 && onQuickAddLot) {
        await onQuickAddLot(createdLots[0]);
        setActivePopupLotId(createdLots[0].id);
      } else if (onBatchAddLots) {
        await onBatchAddLots(createdLots);
        setActivePopupLotId(createdLots[0].id);
      } else if (onQuickAddLot) {
        for (const l of createdLots) {
          await onQuickAddLot(l);
        }
        setActivePopupLotId(createdLots[0].id);
      } else if (onCreateLotFromPolygon) {
        const first = createdLots[0];
        onCreateLotFromPolygon(
          first.coordinates,
          first.areaHa,
          first.latitude,
          first.longitude
        );
      }
    },
    [
      lots,
      buildLotFromKmlFeatures,
      activeKmlFeature,
      onQuickAddLot,
      onBatchAddLots,
      onCreateLotFromPolygon,
    ]
  );

  const handleQuickRegisterKmlFolder = useCallback(
    async (folderName, folderFeats = []) => {
      if (!Array.isArray(folderFeats) || folderFeats.length === 0) return;

      const byPlanter = new Map();
      folderFeats.forEach((feat) => {
        const key = normalizePlanterKey(feat.name) || feat.id;
        if (!byPlanter.has(key)) byPlanter.set(key, []);
        byPlanter.get(key).push(feat);
      });

      const existingIdsSet = new Set(lots.map((l) => String(l.id).toUpperCase()));
      const newLots = [];

      byPlanter.forEach((groupFeats) => {
        const lotObj = buildLotFromKmlFeatures(groupFeats, null, existingIdsSet);
        if (lotObj) newLots.push(lotObj);
      });

      if (newLots.length === 0) return;

      const consumedIds = new Set(folderFeats.map((f) => f.id));
      setImportedFeatures((prev) => prev.filter((f) => !consumedIds.has(f.id)));
      setMultiSelectedKmlIds((prev) => prev.filter((id) => !consumedIds.has(id)));
      setHiddenKmlIds((prev) => prev.filter((id) => !consumedIds.has(id)));
      if (activeKmlFeature && consumedIds.has(activeKmlFeature.id)) {
        setActiveKmlFeature(null);
      }

      if (onBatchAddLots) {
        await onBatchAddLots(newLots);
      } else if (onQuickAddLot) {
        for (const l of newLots) {
          await onQuickAddLot(l);
        }
      }
    },
    [lots, buildLotFromKmlFeatures, activeKmlFeature, onBatchAddLots, onQuickAddLot]
  );

  const multiSelectionSummary = useMemo(() => {
    const selectedLots = lots.filter((l) => multiLotSet.has(l.id));
    const selectedKmls = importedFeatures.filter((f) => multiKmlSet.has(f.id));
    const totalCount = selectedLots.length + selectedKmls.length;
    if (totalCount === 0) return null;

    const lotsHa = selectedLots.reduce((sum, l) => sum + (Number(l.areaHa) || 0), 0);
    const kmlHa = selectedKmls.reduce((sum, f) => sum + (Number(f.areaHa) || 0), 0);
    const totalAreaHa = Number((lotsHa + kmlHa).toFixed(2));
    const totalEstTons = Math.round(totalAreaHa * 75);

    const allSelectedHidden =
      selectedLots.every((l) => hiddenLotSet.has(l.id)) &&
      selectedKmls.every((f) => hiddenKmlSet.has(f.id));

    const items = [
      ...selectedLots.map((l) => ({
        key: `lot:${l.id}`,
        kind: 'lot',
        id: l.id,
        title: l.planter,
        subtitle: `${l.id} • ${l.hacienda}`,
        areaHa: Number(l.areaHa) || 0,
        isHidden: hiddenLotSet.has(l.id),
        ref: l,
      })),
      ...selectedKmls.map((f) => ({
        key: `kml:${f.id}`,
        kind: 'kml',
        id: f.id,
        title: f.name,
        subtitle: f.folder,
        areaHa: Number(f.areaHa) || 0,
        isHidden: hiddenKmlSet.has(f.id),
        ref: f,
      })),
    ];

    return {
      totalCount,
      totalAreaHa,
      totalEstTons,
      allSelectedHidden,
      selectedLots,
      selectedKmls,
      items,
    };
  }, [lots, importedFeatures, multiLotSet, multiKmlSet, hiddenLotSet, hiddenKmlSet]);

  const clearMultiSelection = useCallback(() => {
    setMultiSelectedLotIds([]);
    setMultiSelectedKmlIds([]);
    setIsMultiBreakdownOpen(false);
  }, []);

  const handleToggleHideLot = useCallback(
    (lot) => {
      if (!lot) return;
      const isPartOfMulti =
        multiLotSet.has(lot.id) &&
        multiSelectedLotIds.length + multiSelectedKmlIds.length > 1;
      const targetLotIds = isPartOfMulti ? multiSelectedLotIds : [lot.id];
      const shouldHide = !hiddenLotSet.has(lot.id);

      setHiddenLotIds((prev) => {
        const next = new Set(prev);
        targetLotIds.forEach((id) => {
          if (shouldHide) next.add(id);
          else next.delete(id);
        });
        return Array.from(next);
      });

      if (isPartOfMulti && multiSelectedKmlIds.length > 0) {
        setHiddenKmlIds((prev) => {
          const next = new Set(prev);
          multiSelectedKmlIds.forEach((id) => {
            if (shouldHide) next.add(id);
            else next.delete(id);
          });
          return Array.from(next);
        });
      }

      if (shouldHide && targetLotIds.includes(activePopupLotIdRef.current)) {
        setActivePopupLotId(null);
      }
    },
    [multiLotSet, multiSelectedLotIds, multiSelectedKmlIds, hiddenLotSet]
  );

  const handleToggleHideLotFolder = useCallback((folderLots = [], shouldHide = true) => {
    const ids = folderLots.map((l) => l.id);
    setHiddenLotIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (shouldHide) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
    if (shouldHide && ids.includes(activePopupLotIdRef.current)) {
      setActivePopupLotId(null);
    }
  }, []);

  const handleToggleHideKml = useCallback(
    (feat) => {
      if (!feat) return;
      const isPartOfMulti =
        multiKmlSet.has(feat.id) &&
        multiSelectedKmlIds.length + multiSelectedLotIds.length > 1;
      const targetKmlIds = isPartOfMulti ? multiSelectedKmlIds : [feat.id];
      const shouldHide = !hiddenKmlSet.has(feat.id);

      setHiddenKmlIds((prev) => {
        const next = new Set(prev);
        targetKmlIds.forEach((id) => {
          if (shouldHide) next.add(id);
          else next.delete(id);
        });
        return Array.from(next);
      });

      if (isPartOfMulti && multiSelectedLotIds.length > 0) {
        setHiddenLotIds((prev) => {
          const next = new Set(prev);
          multiSelectedLotIds.forEach((id) => {
            if (shouldHide) next.add(id);
            else next.delete(id);
          });
          return Array.from(next);
        });
      }

      if (
        shouldHide &&
        activeKmlFeatureRef.current &&
        targetKmlIds.includes(activeKmlFeatureRef.current.id)
      ) {
        setActiveKmlFeature(null);
      }
    },
    [multiKmlSet, multiSelectedKmlIds, multiSelectedLotIds, hiddenKmlSet]
  );

  const handleToggleHideKmlFolder = useCallback((folderFeats = [], shouldHide = true) => {
    const ids = folderFeats.map((f) => f.id);
    setHiddenKmlIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (shouldHide) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
    if (
      shouldHide &&
      activeKmlFeatureRef.current &&
      ids.includes(activeKmlFeatureRef.current.id)
    ) {
      setActiveKmlFeature(null);
    }
  }, []);

  const handleToggleHideMultiSelected = useCallback(() => {
    if (!multiSelectionSummary) return;
    const shouldHide = !multiSelectionSummary.allSelectedHidden;

    if (multiSelectedLotIds.length > 0) {
      setHiddenLotIds((prev) => {
        const next = new Set(prev);
        multiSelectedLotIds.forEach((id) => {
          if (shouldHide) next.add(id);
          else next.delete(id);
        });
        return Array.from(next);
      });
    }

    if (multiSelectedKmlIds.length > 0) {
      setHiddenKmlIds((prev) => {
        const next = new Set(prev);
        multiSelectedKmlIds.forEach((id) => {
          if (shouldHide) next.add(id);
          else next.delete(id);
        });
        return Array.from(next);
      });
    }
  }, [multiSelectionSummary, multiSelectedLotIds, multiSelectedKmlIds]);

  const toggleLotInMultiSelection = useCallback((lot) => {
    if (!lot) return;
    setMultiSelectedLotIds((prev) => {
      const seed =
        prev.length === 0 &&
        activePopupLotIdRef.current &&
        activePopupLotIdRef.current !== lot.id
          ? [activePopupLotIdRef.current]
          : prev;
      return seed.includes(lot.id)
        ? seed.filter((id) => id !== lot.id)
        : [...seed, lot.id];
    });
    if (activeKmlFeatureRef.current) {
      const prevKmlId = activeKmlFeatureRef.current.id;
      setMultiSelectedKmlIds((prev) =>
        prev.includes(prevKmlId) ? prev : [...prev, prevKmlId]
      );
    }
    setActivePopupLotId(null);
    setActiveKmlFeature(null);
    lastClickedLotIdRef.current = lot.id;
  }, []);

  const toggleKmlInMultiSelection = useCallback((feat) => {
    if (!feat) return;
    setMultiSelectedKmlIds((prev) => {
      const seed =
        prev.length === 0 &&
        activeKmlFeatureRef.current &&
        activeKmlFeatureRef.current.id !== feat.id
          ? [activeKmlFeatureRef.current.id]
          : prev;
      return seed.includes(feat.id)
        ? seed.filter((id) => id !== feat.id)
        : [...seed, feat.id];
    });
    if (activePopupLotIdRef.current) {
      const prevLotId = activePopupLotIdRef.current;
      setMultiSelectedLotIds((prev) =>
        prev.includes(prevLotId) ? prev : [...prev, prevLotId]
      );
    }
    setActivePopupLotId(null);
    setActiveKmlFeature(null);
    lastClickedKmlIdRef.current = feat.id;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const json = JSON.stringify(importedFeatures);
        if (json.length > KML_PERSIST_MAX_CHARS) {
          localStorage.removeItem(KML_STORAGE_KEY);
          setKmlNotPersisted(true);
          return;
        }
        localStorage.setItem(KML_STORAGE_KEY, json);
        setKmlNotPersisted(false);
      } catch {
        setKmlNotPersisted(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [importedFeatures]);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
    } catch {}
  }, [panelWidth]);

  useEffect(() => {
    if (isMergeMode) {
      setActivePopupLotId(null);
      setActiveKmlFeature(null);
      clearMultiSelection();
    }
  }, [isMergeMode, clearMultiSelection]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        clearMultiSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearMultiSelection]);

  const startResizingPanel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    let raf = 0;
    let pendingWidth = null;

    const handlePointerMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const wrapperRect = splitWrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;
      const maxAllowed = Math.min(680, Math.floor(wrapperRect.width * 0.7));
      pendingWidth = Math.max(
        220,
        Math.min(maxAllowed, Math.round(clientX - wrapperRect.left))
      );
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (pendingWidth !== null) setPanelWidth(pendingWidth);
      });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ pan: false });
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isResizing]);

  const groupedPlanterFolders = useMemo(() => {
    const q = panelSearch.trim().toLowerCase();
    const groups = {};
    lots.forEach((lot) => {
      if (
        q &&
        !lot.planter.toLowerCase().includes(q) &&
        !lot.id.toLowerCase().includes(q) &&
        !lot.hacienda.toLowerCase().includes(q) &&
        !String(lot.barangay || '').toLowerCase().includes(q) &&
        !String(lot.city || '').toLowerCase().includes(q) &&
        !String(lot.coordText || '').toLowerCase().includes(q)
      ) {
        return;
      }
      const cleanBrgy = String(lot.barangay || 'All Brgy.')
        .replace(/^Brgy,\s*/i, 'Brgy. ')
        .trim();
      const folderKey = lot.city
        ? `${lot.city} (${cleanBrgy})`
        : lot.sector || 'Mill District Lots';
      if (!groups[folderKey]) groups[folderKey] = [];
      groups[folderKey].push(lot);
    });
    return groups;
  }, [lots, panelSearch]);

  const groupedKmlFolders = useMemo(() => {
    const q = panelSearch.trim().toLowerCase();
    const groups = {};
    importedFeatures.forEach((feat) => {
      if (
        q &&
        !feat.name.toLowerCase().includes(q) &&
        !feat.folder.toLowerCase().includes(q)
      ) {
        return;
      }
      const folderKey = feat.folder || 'Imported KML Layer';
      if (!groups[folderKey]) groups[folderKey] = [];
      groups[folderKey].push(feat);
    });
    return groups;
  }, [importedFeatures, panelSearch]);

  const toggleFolder = useCallback((folderKey, currentlyExpanded) => {
    setOpenFolders((prev) => ({ ...prev, [folderKey]: !currentlyExpanded }));
  }, []);

  const handleToggleAllPlanterFolders = useCallback(
    (expand) => {
      setOpenFolders((prev) => {
        const next = { ...prev };
        Object.keys(groupedPlanterFolders).forEach((name) => {
          next[`lot:${name}`] = expand;
        });
        return next;
      });
    },
    [groupedPlanterFolders]
  );

  // O(1) popup pixel tracking using pre-cached bounds in lotLayersRef + integer-pixel snapping
  const updatePopupPixelPosition = useCallback(
    (targetLot, options = {}) => {
      const { commit = true } = options;
      const map = mapInstanceRef.current;
      const viewport = mapViewportRef.current;
      if (!map || !viewport || !targetLot) return;

      const cached = lotLayersRef.current.get(targetLot.id);
      const bounds = cached?.bounds || getRingsBounds(getLotRings(targetLot, 0));
      if (!bounds || !bounds.isValid()) return;

      const center = bounds.getCenter();
      const rawCenterPt = map.latLngToContainerPoint(center);
      const screenCenterPt = containerPtToViewportPt(rawCenterPt);

      const containerWidth = viewport.clientWidth || 900;
      const containerHeight = viewport.clientHeight || 660;
      const cardWidth = popupCardRef.current?.offsetWidth || 352;
      const cardHeight = popupCardRef.current?.offsetHeight || 275;

      const clampedLeft = Math.max(
        14,
        Math.min(
          containerWidth - cardWidth - 14,
          Math.round(screenCenterPt.x - cardWidth / 2)
        )
      );

      let desiredTop = Math.round(screenCenterPt.y - cardHeight - 42);
      if (desiredTop < 14) {
        if (screenCenterPt.y + 42 + cardHeight <= containerHeight - 14) {
          desiredTop = Math.round(screenCenterPt.y + 42);
        } else {
          desiredTop = 14;
        }
      }

      const clampedTop = Math.max(
        14,
        Math.min(containerHeight - cardHeight - 14, desiredTop)
      );

      const card = popupCardRef.current;
      if (card) {
        card.style.left = clampedLeft + 'px';
        card.style.top = clampedTop + 'px';
      }
      if (commit) {
        setPopupPos((prev) =>
          prev.x === clampedLeft && prev.y === clampedTop
            ? prev
            : { x: clampedLeft, y: clampedTop }
        );
      }
    },
    [containerPtToViewportPt]
  );

  // Smooth shortest-path rotation animator (drives map & unrotated screen labels in 100% frame lockstep)
  const animateBearingTo = useCallback(
    (targetDeg) => {
      if (rotAnimFrameRef.current) cancelAnimationFrame(rotAnimFrameRef.current);
      const startDeg = bearingRef.current || 0;
      const normTarget = ((targetDeg % 360) + 360) % 360;
      // Shortest angular distance in [-180, 180] so crossing 0°/360° NEVER spins the long way around
      const delta = ((((normTarget - startDeg) % 360) + 540) % 360) - 180;

      if (Math.abs(delta) < 0.2) {
        applyLiveRotationDom(normTarget);
        setMapBearing(Math.round(normTarget));
        return;
      }

      const duration = 170;
      const startTime = performance.now();
      setIsRotatingMap(true);

      const step = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        const cur = startDeg + delta * ease;
        applyLiveRotationDom(cur);
        setMapBearing(Math.round(bearingRef.current));

        if (activePopupLotIdRef.current) {
          const lotObj = lots.find((l) => l.id === activePopupLotIdRef.current);
          if (lotObj) updatePopupPixelPosition(lotObj, { commit: t >= 1 });
        }

        if (t < 1) {
          rotAnimFrameRef.current = requestAnimationFrame(step);
        } else {
          rotAnimFrameRef.current = 0;
          setIsRotatingMap(false);
        }
      };

      rotAnimFrameRef.current = requestAnimationFrame(step);
    },
    [applyLiveRotationDom, lots, updatePopupPixelPosition]
  );

  const focusPolygonWithPopupOffset = useCallback(
    (targetLot) => {
      const map = mapInstanceRef.current;
      if (!map || !targetLot) return;

      if (hiddenLotSetRef.current.has(targetLot.id)) {
        setHiddenLotIds((prev) => prev.filter((id) => id !== targetLot.id));
      }

      const cached = lotLayersRef.current.get(targetLot.id);
      const polyBounds = cached?.bounds || getRingsBounds(getLotRings(targetLot, 0));
      if (!polyBounds || !polyBounds.isValid()) return;

      const center = polyBounds.getCenter();
      const targetZoom = Math.max(map.getZoom(), 17);
      const targetPoint = map.project(center, targetZoom);
      const rad = (-(bearingRef.current || 0) * Math.PI) / 180;
      const offsetX = -Math.sin(rad) * -85;
      const offsetY = Math.cos(rad) * -85;
      const offsetPoint = L.point(targetPoint.x + offsetX, targetPoint.y + offsetY);
      const offsetLatLng = map.unproject(offsetPoint, targetZoom);

      clearMultiSelection();
      setActiveKmlFeature(null);
      setActivePopupLotId(targetLot.id);
      lastClickedLotIdRef.current = targetLot.id;
      map.flyTo(offsetLatLng, targetZoom, { animate: true, duration: 0.42 });

      setTimeout(() => {
        updatePopupPixelPosition(targetLot);
      }, 100);
    },
    [updatePopupPixelPosition, clearMultiSelection]
  );

  const handlePlanterTreeLotClick = useCallback(
    (lot, event, visibleLotsList = []) => {
      if (isMergeModeRef.current) {
        if (onSelectLotRef.current) onSelectLotRef.current(lot);
        return;
      }

      const isShift = Boolean(event?.shiftKey);
      const isCtrl = Boolean(event?.ctrlKey || event?.metaKey);

      if (isShift && lastClickedLotIdRef.current && visibleLotsList.length > 0) {
        const startIdx = visibleLotsList.findIndex(
          (l) => l.id === lastClickedLotIdRef.current
        );
        const endIdx = visibleLotsList.findIndex((l) => l.id === lot.id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] =
            startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const rangeIds = visibleLotsList.slice(from, to + 1).map((l) => l.id);
          setMultiSelectedLotIds((prev) =>
            Array.from(new Set([...(isCtrl ? prev : []), ...rangeIds]))
          );
          setActivePopupLotId(null);
          setActiveKmlFeature(null);
          return;
        }
      }

      if (isCtrl || isShift) {
        toggleLotInMultiSelection(lot);
        return;
      }

      focusPolygonWithPopupOffset(lot);
    },
    [focusPolygonWithPopupOffset, toggleLotInMultiSelection]
  );

  const focusKmlFeature = useCallback(
    (feat) => {
      const map = mapInstanceRef.current;
      if (!map || !feat) return;

      if (hiddenKmlSetRef.current.has(feat.id)) {
        setHiddenKmlIds((prev) => prev.filter((id) => id !== feat.id));
      }

      clearMultiSelection();
      setActivePopupLotId(null);
      setActiveKmlFeature(feat);
      lastClickedKmlIdRef.current = feat.id;

      if (Array.isArray(feat.coordinates) && feat.coordinates.length >= 3) {
        map.flyToBounds(L.latLngBounds(feat.coordinates), {
          padding: [160, 160],
          maxZoom: 18,
          duration: 0.45,
        });
      }
    },
    [clearMultiSelection]
  );

  const handleKmlTreeFocus = useCallback(
    (feat, event, shownFolderFeats = []) => {
      if (isMergeModeRef.current) return;

      const isShift = Boolean(event?.shiftKey);
      const isCtrl = Boolean(event?.ctrlKey || event?.metaKey);

      if (isShift && lastClickedKmlIdRef.current && shownFolderFeats.length > 0) {
        const startIdx = shownFolderFeats.findIndex(
          (f) => f.id === lastClickedKmlIdRef.current
        );
        const endIdx = shownFolderFeats.findIndex((f) => f.id === feat.id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] =
            startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const rangeIds = shownFolderFeats.slice(from, to + 1).map((f) => f.id);
          setMultiSelectedKmlIds((prev) =>
            Array.from(new Set([...(isCtrl ? prev : []), ...rangeIds]))
          );
          setActivePopupLotId(null);
          setActiveKmlFeature(null);

          const map = mapInstanceRef.current;
          const rangeFeats = shownFolderFeats.slice(from, to + 1);
          const b = getFeaturesBounds(rangeFeats);
          if (map && b) {
            map.flyToBounds(b, { padding: [160, 160], maxZoom: 17, duration: 0.45 });
          }
          return;
        }
      }

      if (isCtrl || isShift) {
        toggleKmlInMultiSelection(feat);
        return;
      }

      focusKmlFeature(feat);
    },
    [focusKmlFeature, toggleKmlInMultiSelection]
  );

  const handleFitMultiSelection = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !multiSelectionSummary) return;

    const bounds = L.latLngBounds([]);
    multiSelectionSummary.selectedLots.forEach((lot, idx) => {
      const rings = getLotRings(lot, idx);
      if (rings.length > 0) bounds.extend(getRingsBounds(rings));
    });
    const kmlBounds = getFeaturesBounds(multiSelectionSummary.selectedKmls);
    if (kmlBounds) bounds.extend(kmlBounds);

    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [160, 160], maxZoom: 18, duration: 0.45 });
    }
  }, [multiSelectionSummary]);

  const handleClearKml = useCallback(() => {
    setImportedFeatures([]);
    setActiveKmlFeature(null);
    setMultiSelectedKmlIds([]);
    setHiddenKmlIds([]);
  }, []);

  // ---- Hybrid Anchor + Unrotated Screen-Space Pill Labels ------------------------
  const refreshLabels = useCallback(() => {
    const map = mapInstanceRef.current;
    const anchorLayer = labelLayerRef.current;
    const screenLayer = screenLabelsContainerRef.current;
    const viewport = mapViewportRef.current;
    if (!map || !anchorLayer || !screenLayer || !viewport) return;

    const zoom = map.getZoom();
    const activeMarkers = activeLabelMarkersRef.current;

    if (zoom < LABEL_MIN_ZOOM_LOTS) {
      if (activeMarkers.size > 0) {
        anchorLayer.clearLayers();
        screenLayer.textContent = '';
        activeMarkers.clear();
      }
      return;
    }

    const vw = viewport.clientWidth || 1200;
    const vh = viewport.clientHeight || 800;
    const padPx = 90;

    const { lots: lotItems, kml: kmlItems } = labelItemsRef.current;
    const hiddenLots = hiddenLotSetRef.current;
    const hiddenKmls = hiddenKmlSetRef.current;

    const candidates = [];
    for (let i = 0; i < lotItems.length; i++) {
      const it = lotItems[i];
      if (hiddenLots.has(it.ref.id)) continue;
      const rawPt = map.latLngToContainerPoint([it.lat, it.lng]);
      const pt = containerPtToViewportPt(rawPt);
      if (
        pt.x >= -padPx &&
        pt.x <= vw + padPx &&
        pt.y >= -padPx &&
        pt.y <= vh + padPx
      ) {
        candidates.push({ it, pt });
      }
    }
    if (zoom >= LABEL_MIN_ZOOM_KML) {
      for (let i = 0; i < kmlItems.length; i++) {
        const it = kmlItems[i];
        if (hiddenKmls.has(it.ref.id)) continue;
        const rawPt = map.latLngToContainerPoint([it.lat, it.lng]);
        const pt = containerPtToViewportPt(rawPt);
        if (
          pt.x >= -padPx &&
          pt.x <= vw + padPx &&
          pt.y >= -padPx &&
          pt.y <= vh + padPx
        ) {
          candidates.push({ it, pt });
        }
      }
    }

    candidates.sort((a, b2) => b2.it.rank - a.it.rank);

    const occupiedBoxes = [];
    const accepted = [];

    for (let i = 0; i < candidates.length && accepted.length < MAX_VISIBLE_LABELS; i++) {
      const { it, pt } = candidates[i];
      const box = {
        x1: pt.x - LABEL_BOX_W / 2,
        y1: pt.y - LABEL_BOX_H / 2,
        x2: pt.x + LABEL_BOX_W / 2,
        y2: pt.y + LABEL_BOX_H / 2,
      };

      let collides = false;
      for (let j = 0; j < occupiedBoxes.length; j++) {
        const ob = occupiedBoxes[j];
        if (
          box.x1 < ob.x2 &&
          box.x2 > ob.x1 &&
          box.y1 < ob.y2 &&
          box.y2 > ob.y1
        ) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        occupiedBoxes.push(box);
        accepted.push({ it, pt });
      }
    }

    const nextKeys = new Set();
    for (let i = 0; i < accepted.length; i++) {
      const { it, pt } = accepted[i];
      nextKeys.add(it.key);

      if (!activeMarkers.has(it.key)) {
        // 1. Invisible anchor inside Leaflet (tracks pan, zoom animations & rotation)
        const anchorMarker = L.marker([it.lat, it.lng], {
          icon: L.divIcon({
            className: 'cane-label-anchor',
            html: '',
            iconSize: [0, 0],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(anchorLayer);

        // 2. Visible dark-pill label inside unrotated screen overlay (never spins, never blurs)
        const screenEl = document.createElement('div');
        screenEl.className = 'cane-screen-label';
        screenEl.innerHTML = it.html;
        screenEl.style.left = `${pt.x.toFixed(1)}px`;
        screenEl.style.top = `${pt.y.toFixed(1)}px`;
        screenLayer.appendChild(screenEl);

        activeMarkers.set(it.key, {
          anchorMarker,
          screenEl,
          lat: it.lat,
          lng: it.lng,
        });
      }
    }

    activeMarkers.forEach((entry, key) => {
      if (!nextKeys.has(key)) {
        anchorLayer.removeLayer(entry.anchorMarker);
        entry.screenEl.remove();
        activeMarkers.delete(key);
      }
    });

    syncScreenLabelsPosition();
  }, [containerPtToViewportPt, syncScreenLabelsPosition]);

  const scheduleLabelRefresh = useCallback(() => {
    clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(refreshLabels, 35);
  }, [refreshLabels]);

  // ---- Map creation + Dynamic Diagonal Square Sizing -----------------------------
  useEffect(() => {
    if (!mapContainerRef.current || !mapViewportRef.current || mapInstanceRef.current)
      return;

    const map = L.map(mapContainerRef.current, {
      center: [10.8185, 123.0145],
      zoom: 15,
      minZoom: 10,
      maxZoom: 22,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
      boxZoom: false,
      preferCanvas: true,
      renderer: L.canvas({ padding: 0.55, tolerance: 4 }),
    });

    // 2D rotation-aware mouseEventToContainerPoint so clicking polygons works at ANY angle
    const origMouseToContainer = map.mouseEventToContainerPoint.bind(map);
    map.mouseEventToContainerPoint = function (e) {
      const deg = bearingRef.current || 0;
      if (deg === 0) {
        return origMouseToContainer(e);
      }
      const container = this._container;
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const rad = (-deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const ux = dx * cos - dy * sin + container.clientWidth / 2;
      const uy = dx * sin + dy * cos + container.clientHeight / 2;
      return new L.Point(ux, uy);
    };

    if (map.dragging && map.dragging._draggable) {
      patchDraggableForRotation(map.dragging._draggable, bearingRef);
    }

    polygonsGroupRef.current = L.featureGroup().addTo(map);
    kmlGroupRef.current = L.featureGroup().addTo(map);
    labelLayerRef.current = L.layerGroup().addTo(map);
    searchPinGroupRef.current = L.featureGroup().addTo(map);
    editLayerGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    // Track screen labels on every pan/zoom frame (including smooth CSS wheel-zoom transitions)
    const startZoomTrackLoop = () => {
      if (zoomTrackRafRef.current) cancelAnimationFrame(zoomTrackRafRef.current);
      const tick = () => {
        syncScreenLabelsPosition();
        zoomTrackRafRef.current = requestAnimationFrame(tick);
      };
      zoomTrackRafRef.current = requestAnimationFrame(tick);
    };

    const stopZoomTrackLoop = () => {
      if (zoomTrackRafRef.current) {
        cancelAnimationFrame(zoomTrackRafRef.current);
        zoomTrackRafRef.current = 0;
      }
      syncScreenLabelsPosition();
      scheduleLabelRefresh();
    };

    map.on('move zoom viewreset', syncScreenLabelsPosition);
    map.on('zoomstart', startZoomTrackLoop);
    map.on('zoomend', stopZoomTrackLoop);
    map.on('moveend', scheduleLabelRefresh);

    // Dynamically size mapContainerRef as a square equal to the viewport's diagonal
    // sqrt(vw^2 + vh^2) + 48px so rotating 0..360° NEVER exposes empty left/right corners!
    const syncDiagonalCanvasSize = () => {
      const vp = mapViewportRef.current;
      const mc = mapContainerRef.current;
      if (!vp || !mc) return;
      const vw = vp.clientWidth;
      const vh = vp.clientHeight;
      if (vw === 0 || vh === 0) return;

      const diag = Math.ceil(Math.hypot(vw, vh)) + 48;
      const left = Math.round((vw - diag) / 2);
      const top = Math.round((vh - diag) / 2);

      mc.style.width = `${diag}px`;
      mc.style.height = `${diag}px`;
      mc.style.left = `${left}px`;
      mc.style.top = `${top}px`;

      setCanvasBox((prev) =>
        prev.size === diag && prev.left === left && prev.top === top
          ? prev
          : { size: diag, left, top }
      );

      map.invalidateSize({ pan: false });
      syncScreenLabelsPosition();
      scheduleLabelRefresh();
    };

    syncDiagonalCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      syncDiagonalCanvasSize();
    });
    resizeObserver.observe(mapViewportRef.current);

    return () => {
      if (rotAnimFrameRef.current) cancelAnimationFrame(rotAnimFrameRef.current);
      if (zoomTrackRafRef.current) cancelAnimationFrame(zoomTrackRafRef.current);
      clearTimeout(labelTimerRef.current);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      lotLayersRef.current = new Map();
      kmlLayersRef.current = new Map();
      activeLabelMarkersRef.current = new Map();
    };
  }, [scheduleLabelRefresh, syncScreenLabelsPosition]);

  // ---- Right-Click + Drag (or Alt + Left-Drag) 2D Map Rotation -------------------
  const handleViewportMouseDown = useCallback(
    (e) => {
      const isRightClick = e.button === 2;
      const isAltLeftClick = e.button === 0 && e.altKey;
      if (!isRightClick && !isAltLeftClick) return;

      if (rotAnimFrameRef.current) {
        cancelAnimationFrame(rotAnimFrameRef.current);
        rotAnimFrameRef.current = 0;
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const startBearing = bearingRef.current || 0;
      let draggingRotation = false;
      let raf = 0;

      const onMouseMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;

        if (!draggingRotation && Math.hypot(dx, dy) > 4) {
          draggingRotation = true;
          suppressContextMenuRef.current = true;
          setIsRotatingMap(true);
        }

        if (!draggingRotation) return;

        const nextBearing = (((startBearing + dx * 0.45) % 360) + 360) % 360;
        applyLiveRotationDom(nextBearing);

        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            setMapBearing(Math.round(bearingRef.current));
            if (activePopupLotIdRef.current) {
              const lotObj = lots.find((l) => l.id === activePopupLotIdRef.current);
              if (lotObj) updatePopupPixelPosition(lotObj, { commit: false });
            }
          });
        }
      };

      const onMouseUp = () => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (draggingRotation) {
          setIsRotatingMap(false);
          setMapBearing(Math.round(bearingRef.current));
          scheduleLabelRefresh();
          if (activePopupLotIdRef.current) {
            const lotObj = lots.find((l) => l.id === activePopupLotIdRef.current);
            if (lotObj) updatePopupPixelPosition(lotObj, { commit: true });
          }
          setTimeout(() => {
            suppressContextMenuRef.current = false;
          }, 80);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [applyLiveRotationDom, lots, updatePopupPixelPosition, scheduleLabelRefresh]
  );

  // ---- Manual Compass Needle Drag & Click-to-Reset -------------------------------
  const handleCompassMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      if (rotAnimFrameRef.current) {
        cancelAnimationFrame(rotAnimFrameRef.current);
        rotAnimFrameRef.current = 0;
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const startBearing = bearingRef.current || 0;
      let draggedCompass = false;

      const btnRect = compassBtnRef.current?.getBoundingClientRect();
      const centerX = btnRect ? btnRect.left + btnRect.width / 2 : startX;
      const centerY = btnRect ? btnRect.top + btnRect.height / 2 : startY;
      const startAngle =
        (Math.atan2(startY - centerY, startX - centerX) * 180) / Math.PI;

      const onMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        if (!draggedCompass && Math.hypot(dx, dy) > 3) {
          draggedCompass = true;
          setIsRotatingMap(true);
        }
        if (!draggedCompass) return;

        const distFromCenter = Math.hypot(
          moveEvt.clientX - centerX,
          moveEvt.clientY - centerY
        );
        let nextBearing;
        if (distFromCenter > 14) {
          const curAngle =
            (Math.atan2(moveEvt.clientY - centerY, moveEvt.clientX - centerX) *
              180) /
            Math.PI;
          nextBearing =
            (((startBearing + (curAngle - startAngle)) % 360) + 360) % 360;
        } else {
          nextBearing = (((startBearing + dx * 0.8) % 360) + 360) % 360;
        }

        applyLiveRotationDom(nextBearing);
        setMapBearing(Math.round(bearingRef.current));
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);

        if (!draggedCompass) {
          animateBearingTo(0);
        } else {
          setIsRotatingMap(false);
        }
        scheduleLabelRefresh();
        if (activePopupLotIdRef.current) {
          const lotObj = lots.find((l) => l.id === activePopupLotIdRef.current);
          if (lotObj) updatePopupPixelPosition(lotObj, { commit: true });
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [
      applyLiveRotationDom,
      animateBearingTo,
      lots,
      updatePopupPixelPosition,
      scheduleLabelRefresh,
    ]
  );

  const rotateByStep = useCallback(
    (deltaDeg) => {
      const next = (((bearingRef.current || 0) + deltaDeg) % 360 + 360) % 360;
      animateBearingTo(next);
      setTimeout(() => {
        scheduleLabelRefresh();
      }, 180);
    },
    [animateBearingTo, scheduleLabelRefresh]
  );

  useEffect(() => {
    if (!isActive) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize({ pan: false });
      syncScreenLabelsPosition();
      scheduleLabelRefresh();
    }, 50);
    return () => clearTimeout(timer);
  }, [isActive, scheduleLabelRefresh, syncScreenLabelsPosition]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize({ pan: false });
      syncScreenLabelsPosition();
      if (activePopupLot) updatePopupPixelPosition(activePopupLot);
    }, 220);
    return () => clearTimeout(timer);
  }, [
    isSidePanelOpen,
    panelWidth,
    activePopupLot,
    updatePopupPixelPosition,
    syncScreenLabelsPosition,
  ]);

  useEffect(() => {
    if (activePopupLot && mapMode === 'view') {
      updatePopupPixelPosition(activePopupLot);
    }
  }, [activePopupLot, mapMode, updatePopupPixelPosition]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activePopupLot || mapMode !== 'view') return;

    let raf = 0;
    const syncLive = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updatePopupPixelPosition(activePopupLot, { commit: false });
      });
    };
    const syncFinal = () => updatePopupPixelPosition(activePopupLot);

    map.on('move', syncLive);
    map.on('zoom', syncLive);
    map.on('moveend', syncFinal);
    map.on('zoomend', syncFinal);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      map.off('move', syncLive);
      map.off('zoom', syncLive);
      map.off('moveend', syncFinal);
      map.off('zoomend', syncFinal);
    };
  }, [activePopupLot, mapMode, updatePopupPixelPosition]);

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
      subdomains: config.subdomains || 'abc',
      maxNativeZoom: config.maxNativeZoom || 19,
      maxZoom: config.maxZoom || 22,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 4,
    }).addTo(map);

    if (config.overlayUrl) {
      labelOverlayRef.current = L.tileLayer(config.overlayUrl, {
        maxNativeZoom: config.maxNativeZoom || 19,
        maxZoom: config.maxZoom || 22,
        pane: 'overlayPane',
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 3,
      }).addTo(map);
    }
  }, [basemapKey]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (mapMode === 'view') {
        setActivePopupLotId(null);
        setActiveKmlFeature(null);
        clearMultiSelection();
      } else if (mapMode === 'draw' || mapMode === 'edit') {
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
  }, [mapMode, clearMultiSelection]);

  // ---- Registered planter lots ---------------------------------------------------
  const restyleLots = useCallback(() => {
    const sel = selectionRef.current;
    lotLayersRef.current.forEach((entry) => {
      const { style, selected } = getLotStyle(entry.lot, sel);
      const key = styleKey(style);
      if (key !== entry.key) {
        entry.layer.setStyle(style);
        entry.key = key;
        if (selected && polygonsGroupRef.current?.hasLayer(entry.layer)) {
          entry.layer.bringToFront();
        }
      }
    });
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (labelLayerRef.current) {
      labelLayerRef.current.clearLayers();
    }
    if (screenLabelsContainerRef.current) {
      screenLabelsContainerRef.current.textContent = '';
    }
    activeLabelMarkersRef.current.clear();

    const layerMap = new Map();
    const labelItems = [];

    lots.forEach((lot, idx) => {
      if (mapMode === 'edit' && editingLotId === lot.id) return;

      const rings = getLotRings(lot, idx);
      const bounds = getRingsBounds(rings);
      const { style, selected } = getLotStyle(lot, selectionRef.current);
      const polygon = L.polygon(ringsToLatLngs(rings), style);

      if (mapMode === 'view') {
        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (isMergeModeRef.current) {
            if (onSelectLotRef.current) onSelectLotRef.current(lot);
            return;
          }
          const orig = e.originalEvent;
          if (orig && (orig.ctrlKey || orig.metaKey || orig.shiftKey)) {
            toggleLotInMultiSelection(lot);
            return;
          }
          focusPolygonWithPopupOffset(lot);
        });
      }

      if (!hiddenLotSetRef.current.has(lot.id)) {
        polygon.addTo(group);
        if (selected) polygon.bringToFront();
      }

      layerMap.set(lot.id, {
        layer: polygon,
        lot,
        rings,
        bounds,
        key: styleKey(style),
      });

      const [lat, lng] = ringCentroid(rings[0]);
      labelItems.push({
        key: `lot:${lot.id}:${lot.planter}:${lot.areaHa}:${rings.length}`,
        kind: 'lot',
        ref: lot,
        slices: rings.length,
        html: lotLabelHtml(lot, rings.length),
        lat,
        lng,
        rank: 1e9 + (Number(lot.areaHa) || 0),
      });
    });

    lotLayersRef.current = layerMap;
    labelItemsRef.current.lots = labelItems;
    scheduleLabelRefresh();
  }, [
    lots,
    mapMode,
    editingLotId,
    focusPolygonWithPopupOffset,
    toggleLotInMultiSelection,
    scheduleLabelRefresh,
  ]);

  useEffect(() => {
    restyleLots();
  }, [activePopupLotId, mergeSet, multiLotSet, isMergeMode, mapMode, restyleLots]);

  useEffect(() => {
    const group = polygonsGroupRef.current;
    if (!group) return;
    lotLayersRef.current.forEach((entry, id) => {
      const shouldHide = hiddenLotSet.has(id);
      const isOnMap = group.hasLayer(entry.layer);
      if (shouldHide && isOnMap) {
        group.removeLayer(entry.layer);
      } else if (!shouldHide && !isOnMap) {
        entry.layer.addTo(group);
      }
    });
    scheduleLabelRefresh();
  }, [hiddenLotSet, scheduleLabelRefresh]);

  // ---- Imported KML / GeoJSON features -------------------------------------------
  const restyleKmlLayers = useCallback(() => {
    const activeId = activeKmlIdRef.current;
    const mSet = multiKmlSetRef.current;
    kmlLayersRef.current.forEach((entry, id) => {
      const isMulti = mSet.has(id);
      const isActive = activeId === id;
      const nextStyle = getKmlStyle(isActive, isMulti);
      const nextKey = styleKey(nextStyle);
      if (entry.key !== nextKey) {
        entry.layer.setStyle(nextStyle);
        entry.key = nextKey;
        if ((isActive || isMulti) && kmlGroupRef.current?.hasLayer(entry.layer)) {
          entry.layer.bringToFront();
        }
      }
    });
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const kmlGroup = kmlGroupRef.current;
    if (!map || !kmlGroup) return;

    kmlGroup.clearLayers();
    const layerMap = new Map();
    const labelItems = [];
    kmlLayersRef.current = layerMap;
    labelItemsRef.current.kml = labelItems;

    const feats = importedFeatures.filter(
      (f) => Array.isArray(f.coordinates) && f.coordinates.length >= 3
    );
    if (feats.length === 0) {
      setRenderProgress(null);
      scheduleLabelRefresh();
      return;
    }

    let cancelled = false;
    let timer = 0;
    let i = 0;

    const drawBatch = () => {
      if (cancelled) return;
      const end = Math.min(i + KML_DRAW_CHUNK, feats.length);
      for (; i < end; i++) {
        const feat = feats[i];
        const isMulti = multiKmlSetRef.current.has(feat.id);
        const isActive = activeKmlIdRef.current === feat.id;
        const initStyle = getKmlStyle(isActive, isMulti);
        const poly = L.polygon(feat.coordinates, initStyle);

        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (isMergeModeRef.current) return;
          const orig = e.originalEvent;
          if (orig && (orig.ctrlKey || orig.metaKey || orig.shiftKey)) {
            toggleKmlInMultiSelection(feat);
            return;
          }
          clearMultiSelection();
          setActivePopupLotId(null);
          setActiveKmlFeature(feat);
          lastClickedKmlIdRef.current = feat.id;
        });

        if (!hiddenKmlSetRef.current.has(feat.id)) {
          poly.addTo(kmlGroup);
        }
        layerMap.set(feat.id, { layer: poly, key: styleKey(initStyle) });
        labelItems.push({
          key: `kml:${feat.id}`,
          kind: 'kml',
          ref: feat,
          html: kmlLabelHtml(feat),
          lat: feat.latitude,
          lng: feat.longitude,
          rank: Number(feat.areaHa) || 0,
        });
      }

      if (i < feats.length) {
        setRenderProgress({ done: i, total: feats.length });
        timer = setTimeout(drawBatch, 0);
      } else {
        setRenderProgress(null);
        scheduleLabelRefresh();
      }
    };

    drawBatch();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [importedFeatures, toggleKmlInMultiSelection, clearMultiSelection, scheduleLabelRefresh]);

  useEffect(() => {
    restyleKmlLayers();
  }, [activeKmlFeature, multiKmlSet, restyleKmlLayers]);

  useEffect(() => {
    const kmlGroup = kmlGroupRef.current;
    if (!kmlGroup) return;
    kmlLayersRef.current.forEach((entry, id) => {
      const shouldHide = hiddenKmlSet.has(id);
      const isOnMap = kmlGroup.hasLayer(entry.layer);
      if (shouldHide && isOnMap) {
        kmlGroup.removeLayer(entry.layer);
      } else if (!shouldHide && !isOnMap) {
        entry.layer.addTo(kmlGroup);
      }
    });
    scheduleLabelRefresh();
  }, [hiddenKmlSet, scheduleLabelRefresh]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const pinGroup = searchPinGroupRef.current;
    if (!map || !pinGroup) return;

    pinGroup.clearLayers();
    if (!searchedPin) return;

    const pinIcon = L.divIcon({
      className: 'cane-search-pin',
      html:
        '<div style="position:relative;width:28px;height:28px;">' +
        '<div style="position:absolute;inset:0;border-radius:9999px;background:rgba(244,63,94,0.45);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></div>' +
        '<div style="position:absolute;top:5px;left:5px;width:18px;height:18px;border-radius:9999px;background:#e11d48;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.75);"></div>' +
        '</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([searchedPin.lat, searchedPin.lng], {
      icon: pinIcon,
    }).addTo(pinGroup);

    marker
      .bindPopup(
        `<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.4;">` +
          `<strong style="color:#0f172a;">Searched Coordinate</strong><br/>` +
          `<span style="font-family:monospace;font-weight:700;color:#059669;">${searchedPin.lat}° N, ${searchedPin.lng}° E</span>` +
          `</div>`,
        { offset: [0, -8] }
      )
      .openPopup();
  }, [searchedPin]);

  // ---- Draw / reshape editor (with rotation-aware vertex dragging) ---------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    const editGroup = editLayerGroupRef.current;
    if (!map || !editGroup) return;

    editGroup.clearLayers();
    if (mapMode === 'view' || draftCoords.length === 0) return;

    const live = draftCoords.map((c) => [c[0], c[1]]);
    let shape = null;

    if (live.length >= 3) {
      shape = L.polygon(live, {
        color: '#34d399',
        weight: 3,
        dashArray: '6, 4',
        fillColor: '#10b981',
        fillOpacity: 0.35,
      }).addTo(editGroup);
    } else if (live.length === 2) {
      shape = L.polyline(live, {
        color: '#34d399',
        weight: 3,
        dashArray: '6, 4',
      }).addTo(editGroup);
    }

    const showMidpoints = live.length >= 3 && live.length <= MAX_MIDPOINT_HANDLES;

    live.forEach((pt, idx) => {
      const vertexIcon = L.divIcon({
        className: 'cane-vertex-handle',
        html:
          '<div title="Drag corner • Right-click to delete" style="' +
          'width:14px;height:14px;border-radius:9999px;background:#ffffff;' +
          'border:3px solid #059669;box-shadow:0 1px 4px rgba(0,0,0,0.6);cursor:grab;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker(pt, { icon: vertexIcon, draggable: true });

      marker.on('add', () => {
        if (marker.dragging && marker.dragging._draggable) {
          patchDraggableForRotation(marker.dragging._draggable, bearingRef);
        }
      });

      marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        live[idx] = [Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))];
        if (shape) shape.setLatLngs(live);
      });

      marker.on('dragend', () => {
        setDraftCoords(live.map((c) => [c[0], c[1]]));
      });

      marker.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        setDraftCoords((prev) => {
          if (prev.length <= 3 && mapMode === 'edit') return prev;
          return prev.filter((_, i) => i !== idx);
        });
      });

      marker.addTo(editGroup);

      if (showMidpoints) {
        const nextPt = draftCoords[(idx + 1) % draftCoords.length];
        const midPt = [
          Number(((pt[0] + nextPt[0]) / 2).toFixed(6)),
          Number(((pt[1] + nextPt[1]) / 2).toFixed(6)),
        ];

        const midIcon = L.divIcon({
          className: 'cane-midpoint-handle',
          html:
            '<div title="Click or drag to insert a new corner" style="' +
            'width:12px;height:12px;border-radius:9999px;background:rgba(16,185,129,0.9);' +
            'border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.5);cursor:pointer;"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const midMarker = L.marker(midPt, { icon: midIcon, draggable: true });

        midMarker.on('add', () => {
          if (midMarker.dragging && midMarker.dragging._draggable) {
            patchDraggableForRotation(midMarker.dragging._draggable, bearingRef);
          }
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

  const handleCoordinateSearch = (e) => {
    e.preventDefault();
    setCoordError('');
    const q = coordQuery.trim();
    if (!q) return;

    const map = mapInstanceRef.current;

    const parsedCoord = parseCoordinateInput(q);
    if (parsedCoord) {
      setSearchedPin(parsedCoord);
      setActiveKmlFeature(null);

      const containingLot = lots.find((l, i) =>
        getLotRings(l, i).some((ring) =>
          pointInRing([parsedCoord.lat, parsedCoord.lng], ring)
        )
      );
      const nearbyLot =
        containingLot ||
        lots.find(
          (l) =>
            Math.abs(Number(l.latitude) - parsedCoord.lat) < 0.0015 &&
            Math.abs(Number(l.longitude) - parsedCoord.lng) < 0.0015
        );

      if (nearbyLot) {
        focusPolygonWithPopupOffset(nearbyLot);
      } else if (map) {
        setActivePopupLotId(null);
        map.flyTo([parsedCoord.lat, parsedCoord.lng], 18, {
          animate: true,
          duration: 0.6,
        });
      }
      return;
    }

    const matchedLot = lots.find(
      (l) =>
        l.id.toLowerCase().includes(q.toLowerCase()) ||
        l.planter.toLowerCase().includes(q.toLowerCase()) ||
        l.hacienda.toLowerCase().includes(q.toLowerCase()) ||
        String(l.coordText || '').toLowerCase().includes(q.toLowerCase())
    );
    if (matchedLot) {
      setSearchedPin({ lat: matchedLot.latitude, lng: matchedLot.longitude });
      focusPolygonWithPopupOffset(matchedLot);
      return;
    }

    const matchedKml = importedFeatures.find((f) =>
      f.name.toLowerCase().includes(q.toLowerCase())
    );
    if (matchedKml) {
      setSearchedPin({ lat: matchedKml.latitude, lng: matchedKml.longitude });
      focusKmlFeature(matchedKml);
      return;
    }

    setCoordError(
      'Could not find that coordinate or lot. Enter Lat, Lng like "10.82082, 123.01053" or a Planter/Lot ID.'
    );
  };

  const handleKmlOrGeoJsonUpload = (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setImportStatus({ phase: 'reading', name: file.name });

    const reader = new FileReader();
    reader.onerror = () => {
      setImportStatus(null);
      input.value = '';
      alert('Could not read that file.');
    };
    reader.onload = (event) => {
      setImportStatus({ phase: 'parsing', name: file.name });

      setTimeout(() => {
        try {
          const text = String(event.target.result || '');
          const isKml =
            file.name.toLowerCase().endsWith('.kml') ||
            text.trim().startsWith('<?xml') ||
            text.includes('<kml');

          const parsedFeatures = isKml
            ? parseKmlDocument(text, file.name)
            : parseGeoJsonDocument(text, file.name);

          if (parsedFeatures.length === 0) {
            alert('No valid Polygon or Point coordinates were found in that file.');
            return;
          }

          setImportedFeatures((prev) => [...parsedFeatures, ...prev]);
          setIsSidePanelOpen(true);
          setActiveKmlFeature(parsedFeatures[0]);

          const map = mapInstanceRef.current;
          const bounds = getFeaturesBounds(parsedFeatures);
          if (map && bounds) {
            map.flyToBounds(bounds, { padding: [150, 150], duration: 0.65 });
          }
        } catch (err) {
          alert(
            'Could not parse file (' +
              err.message +
              '). Please upload a valid Google Earth .kml or .geojson file.'
          );
        } finally {
          setImportStatus(null);
          input.value = '';
        }
      }, 30);
    };
    reader.readAsText(file);
  };

  const handleStartEditLot = (targetLot) => {
    if (!targetLot) return;
    if (isMultiRingLot(targetLot)) return;
    if (isMergeMode && onToggleMergeMode) onToggleMergeMode();

    const idx = lots.findIndex((l) => l.id === targetLot.id);
    const coords = getLotCoordinates(targetLot, idx >= 0 ? idx : 0);
    setEditingLotId(targetLot.id);
    setActivePopupLotId(null);
    clearMultiSelection();
    setDraftCoords(coords.map((c) => [...c]));
    setMapMode('edit');

    const map = mapInstanceRef.current;
    if (map && coords.length >= 3) {
      map.flyToBounds(L.latLngBounds(coords), {
        padding: [160, 160],
        maxZoom: 18,
        duration: 0.45,
      });
    }
  };

  const handleStartDrawNew = () => {
    if (isMergeMode && onToggleMergeMode) onToggleMergeMode();
    setActivePopupLotId(null);
    setActiveKmlFeature(null);
    clearMultiSelection();
    setEditingLotId(null);
    setDraftCoords([]);
    setMapMode('draw');
  };

  const handleCancelDigitize = () => {
    setMapMode('view');
    setEditingLotId(null);
    setDraftCoords([]);
  };

  const handleMergeButtonClick = () => {
    if (mapMode !== 'view') handleCancelDigitize();
    if (onToggleMergeMode) onToggleMergeMode();
  };

  const handleSaveEditedBoundary = () => {
    if (!editingLot || draftCoords.length < 3) return;
    const finalArea = autoUpdateArea ? draftAreaHa : editingLot.areaHa;
    const centroid = computeCentroidLatLng({ coordinates: draftCoords });
    onUpdateLotBoundary(
      editingLot.id,
      draftCoords,
      finalArea,
      centroid.latitude,
      centroid.longitude
    );
    const savedLot = {
      ...editingLot,
      coordinates: draftCoords,
      areaHa: finalArea,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
    };
    setMapMode('view');
    setEditingLotId(null);
    setDraftCoords([]);
    setTimeout(() => focusPolygonWithPopupOffset(savedLot), 80);
  };

  const handleCreateNewLotFromDrawn = () => {
    if (draftCoords.length < 3) return;
    const centroid = computeCentroidLatLng({ coordinates: draftCoords });
    onCreateLotFromPolygon(
      draftCoords,
      draftAreaHa,
      centroid.latitude,
      centroid.longitude
    );
    setMapMode('view');
    setEditingLotId(null);
    setDraftCoords([]);
  };

  const handleFitAllBounds = () => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    const kmlGroup = kmlGroupRef.current;
    if (!map) return;

    setActivePopupLotId(null);
    setActiveKmlFeature(null);
    clearMultiSelection();

    const bounds = L.latLngBounds([]);
    if (group && group.getLayers().length > 0) bounds.extend(group.getBounds());
    if (kmlGroup && kmlGroup.getLayers().length > 0) bounds.extend(kmlGroup.getBounds());

    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [150, 150], duration: 0.55 });
    }
  };

  const activePopupIsMerged = isMultiRingLot(activePopupLot);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <style>{
        '.cane-label-anchor { background: transparent !important; border: none !important; box-shadow: none !important; pointer-events: none !important; }' +
        '.cane-screen-label { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; text-align: center; line-height: 1.15; pointer-events: none; }' +
        '.cane-map-label-pill { padding: 2px 6px; border-radius: 6px; background: rgba(15, 23, 42, 0.76); border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.48); }' +
        '.cane-map-label-pill-kml { background: rgba(12, 74, 110, 0.82); border-color: rgba(56, 189, 248, 0.38); }' +
        '.cane-map-label-title { font-weight: 800; font-size: 10.5px; color: #ffffff; letter-spacing: 0.01em; }' +
        '.cane-map-label-sub { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; font-size: 9.5px; color: #cbd5e1; }' +
        '.leaflet-container { background-color: #0f172a !important; cursor: ' +
        (isRotatingMap ? 'grabbing' : mapMode === 'view' ? 'grab' : 'crosshair') +
        ' !important; }'
      }</style>

      {/* SINGLE COMPACT GIS TOP BAR */}
      <div className="px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
        <form
          onSubmit={handleCoordinateSearch}
          className="w-full sm:w-[390px] lg:w-[430px] shrink-0 flex items-center gap-1.5"
        >
          <div className="relative flex-1 min-w-[220px]">
            <Compass className="w-4 h-4 text-rose-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={coordQuery}
              onChange={(e) => {
                setCoordQuery(e.target.value);
                if (coordError) setCoordError('');
              }}
              placeholder="Search Lat, Long (e.g. 10.82082, 123.01053) or Planter..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {coordQuery && (
              <button
                type="button"
                onClick={() => {
                  setCoordQuery('');
                  setCoordError('');
                  setSearchedPin(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 shadow-2xs cursor-pointer"
          >
            Go
          </button>
        </form>

        {mapMode !== 'view' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-1 rounded bg-emerald-700 text-white font-bold text-[11px]">
              {mapMode === 'edit'
                ? 'Reshaping ' + (editingLot ? editingLot.id : 'Polygon')
                : 'Drawing Polygon'}
            </span>
            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold">
              {draftCoords.length} pts • {draftAreaHa} ha
            </span>
            <label className="inline-flex items-center gap-1 text-[11px] font-medium mx-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoUpdateArea}
                onChange={(e) => setAutoUpdateArea(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              <span>Sync {draftAreaHa} ha</span>
            </label>
            <button
              type="button"
              onClick={() => setDraftCoords((prev) => prev.slice(0, -1))}
              disabled={draftCoords.length === 0}
              className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 inline mr-1" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setDraftCoords([])}
              className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3 h-3 inline mr-1" />
              Clear
            </button>
            {mapMode === 'edit' && editingLot && (
              <button
                type="button"
                disabled={draftCoords.length < 3}
                onClick={handleSaveEditedBoundary}
                className="px-2.5 py-1 rounded bg-emerald-700 text-white font-bold disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-3 h-3 inline mr-1" />
                Save {editingLot.id}
              </button>
            )}
            {mapMode === 'draw' && (
              <button
                type="button"
                disabled={draftCoords.length < 3}
                onClick={handleCreateNewLotFromDrawn}
                className="px-2.5 py-1 rounded bg-slate-900 text-white font-bold disabled:opacity-40 cursor-pointer"
              >
                Register ({draftAreaHa} ha)
              </button>
            )}
            <button
              type="button"
              onClick={handleCancelDigitize}
              className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-600 font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {searchedPin && (
            <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-lg text-[11px]">
              <MapPin className="w-3 h-3 text-rose-600 shrink-0" />
              <span className="font-mono font-bold text-rose-900 dark:text-rose-200">
                {searchedPin.lat}°N, {searchedPin.lng}°E
              </span>
              <button
                type="button"
                onClick={() =>
                  onCreateLotFromPolygon(null, null, searchedPin.lat, searchedPin.lng)
                }
                className="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold cursor-pointer"
              >
                + Lot
              </button>
              <button
                type="button"
                onClick={() => setSearchedPin(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setBasemapKey('googleHybrid')}
              className={
                'px-2 py-1 rounded font-semibold transition-all cursor-pointer ' +
                (basemapKey === 'googleHybrid'
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400')
              }
            >
              Google Earth
            </button>
            <button
              type="button"
              onClick={() => setBasemapKey('esriWorld')}
              className={
                'px-2 py-1 rounded font-semibold transition-all cursor-pointer ' +
                (basemapKey === 'esriWorld'
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400')
              }
            >
              Esri
            </button>
            <button
              type="button"
              onClick={() => setBasemapKey('googleSat')}
              className={
                'px-2 py-1 rounded font-semibold transition-all cursor-pointer ' +
                (basemapKey === 'googleSat'
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400')
              }
            >
              Clean Sat
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".kml,.geojson,.json,.xml"
            onChange={handleKmlOrGeoJsonUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(importStatus)}
            title="Import KML / GeoJSON"
            aria-label="Import KML / GeoJSON"
            className="w-8 h-8 rounded-lg border border-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 flex items-center justify-center text-emerald-800 dark:text-emerald-300 transition-all disabled:opacity-50 disabled:cursor-wait cursor-pointer"
          >
            <Upload className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleMergeButtonClick}
            title={
              isMergeMode
                ? 'Cancel Merge Mode'
                : 'Merge Fields (Combine road-sliced polygons)'
            }
            aria-label={isMergeMode ? 'Cancel Merge Mode' : 'Merge Fields'}
            className={
              'w-8 h-8 rounded-lg border flex items-center justify-center transition-all shadow-2xs cursor-pointer ' +
              (isMergeMode
                ? 'bg-violet-600 text-white border-violet-500 ring-2 ring-violet-500/30'
                : 'bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-slate-700 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700')
            }
          >
            {isMergeMode ? (
              <X className="w-4 h-4" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <rect x="3" y="4" width="8" height="16" rx="1.5" />
                <rect x="13" y="4" width="8" height="16" rx="1.5" />
                <path d="M8 12h8" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={handleStartDrawNew}
            title="Draw New Polygon"
            aria-label="Draw New Polygon"
            className="w-8 h-8 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleFitAllBounds}
            title="Fit All Polygons"
            aria-label="Fit All Polygons"
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <Crosshair className="w-4 h-4 text-slate-500 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {coordError && (
        <div className="px-3 py-1.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 font-semibold flex items-center justify-between shrink-0">
          <span>{coordError}</span>
          <button type="button" onClick={() => setCoordError('')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* FULL-SCREEN SPLIT WORKSPACE */}
      <div
        ref={splitWrapperRef}
        className={
          'relative isolate z-0 flex-1 min-h-0 w-full flex overflow-hidden ' +
          (isResizing ? 'select-none cursor-col-resize' : '')
        }
      >
        {/* LEFT SIDE PANEL */}
        <div
          style={{
            width: isSidePanelOpen ? `${panelWidth}px` : '0px',
            transition: isResizing ? 'none' : 'width 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className={
            'relative z-[420] h-full bg-white dark:bg-slate-900 flex flex-col shrink-0 select-none ' +
            (isSidePanelOpen
              ? 'border-r border-slate-200 dark:border-slate-800'
              : 'border-r-0')
          }
        >
          {isSidePanelOpen && (
            <div className="flex flex-col h-full w-full overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/70 dark:bg-slate-800/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
                    Field Polygons & KML Tree
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {totalHiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHiddenLotIds([]);
                          setHiddenKmlIds([]);
                        }}
                        title="Show all hidden plotted areas"
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Show {totalHiddenCount}</span>
                      </button>
                    )}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      {(lots.length + importedFeatures.length).toLocaleString()} items
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={panelSearch}
                    onChange={(e) => setPanelSearch(e.target.value)}
                    placeholder="Filter planters, lots, or KML folders..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  {panelSearch && (
                    <button
                      type="button"
                      onClick={() => setPanelSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-2 divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                <KmlTreeSection
                  groups={groupedKmlFolders}
                  totalCount={importedFeatures.length}
                  activeId={activeKmlFeature ? activeKmlFeature.id : null}
                  multiKmlSet={multiKmlSet}
                  hiddenKmlSet={hiddenKmlSet}
                  openFolders={openFolders}
                  onToggleFolder={toggleFolder}
                  onFocus={handleKmlTreeFocus}
                  onQuickRegisterSingleKml={(feat) =>
                    executeQuickRegisterKml([feat], true, null)
                  }
                  onQuickRegisterKmlFolder={handleQuickRegisterKmlFolder}
                  onToggleHideKml={handleToggleHideKml}
                  onToggleHideKmlFolder={handleToggleHideKmlFolder}
                  onClear={handleClearKml}
                  notPersisted={kmlNotPersisted}
                />

                <PlanterTreeSection
                  groups={groupedPlanterFolders}
                  totalLotsCount={lots.length}
                  isMergeMode={isMergeMode}
                  mergeSet={mergeSet}
                  multiLotSet={multiLotSet}
                  hiddenLotSet={hiddenLotSet}
                  activePopupLotId={activePopupLotId}
                  openFolders={openFolders}
                  onToggleFolder={toggleFolder}
                  onToggleAllFolders={handleToggleAllPlanterFolders}
                  onLotClick={handlePlanterTreeLotClick}
                  onToggleHideLot={handleToggleHideLot}
                  onToggleHideLotFolder={handleToggleHideLotFolder}
                />
              </div>
            </div>
          )}

          {/* DRAGGABLE VERTICAL RESIZE SPLITTER BAR */}
          {isSidePanelOpen && (
            <div
              onMouseDown={startResizingPanel}
              onTouchStart={startResizingPanel}
              onDoubleClick={() => setPanelWidth(330)}
              title="Drag left or right to resize panel • Double-click to reset width"
              className={
                'absolute top-0 -right-1.5 bottom-0 w-3 z-[455] cursor-col-resize group flex items-center justify-center transition-colors ' +
                (isResizing ? 'bg-emerald-500/30' : 'hover:bg-emerald-500/20')
              }
            >
              <div
                className={
                  'w-[2px] h-full transition-colors ' +
                  (isResizing
                    ? 'bg-emerald-600'
                    : 'bg-transparent group-hover:bg-emerald-500')
                }
              />
            </div>
          )}

          {/* PROTRUDING COLLAPSE / EXPAND HANDLE TAB */}
          <button
            type="button"
            onClick={() => setIsSidePanelOpen((prev) => !prev)}
            title={isSidePanelOpen ? 'Collapse side panel' : 'Open side panel'}
            className="absolute top-1/2 -right-7 -translate-y-1/2 z-[460] w-7 h-16 bg-white dark:bg-slate-900 border border-l-0 border-slate-300 dark:border-slate-700 rounded-r-xl shadow-md flex items-center justify-center gap-0.5 text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <GripVertical
              onMouseDown={(e) => {
                if (isSidePanelOpen) startResizingPanel(e);
              }}
              className="w-3 h-4 text-slate-400 cursor-col-resize"
            />
            {isSidePanelOpen ? (
              <ChevronLeft className="w-4 h-4 -ml-1" />
            ) : (
              <ChevronRight className="w-4 h-4 -ml-1" />
            )}
          </button>
        </div>

        {/* Right Side: Interactive Rotatable Satellite Map Viewport */}
        <div
          ref={mapViewportRef}
          onMouseDown={handleViewportMouseDown}
          onContextMenu={(e) => {
            if (suppressContextMenuRef.current || mapMode === 'view') {
              e.preventDefault();
            }
          }}
          className="relative flex-1 h-full bg-[#0f172a] overflow-hidden select-none"
        >
          {/* Dynamically Diagonal-Sized Square Map Canvas (Full Coverage at Any Angle) */}
          <div
            ref={mapContainerRef}
            style={{
              position: 'absolute',
              width: `${canvasBox.size}px`,
              height: `${canvasBox.size}px`,
              left: `${canvasBox.left}px`,
              top: `${canvasBox.top}px`,
              transformOrigin: '50% 50%',
              transform: mapBearing === 0 ? 'none' : `rotate(${mapBearing}deg)`,
            }}
            className="z-0"
          />

          {/* UNROTATED SCREEN-SPACE DARK PILL LABEL OVERLAY (Never Spins, Never Blurs) */}
          <div
            ref={screenLabelsContainerRef}
            className="pointer-events-none absolute inset-0 z-[410] overflow-hidden"
          />

          {/* Live Heading HUD Pill (Appears when rotated) */}
          {mapBearing !== 0 && (
            <div className="absolute top-3 left-3 z-[450] px-2.5 py-1 rounded-full bg-slate-900 text-white border border-slate-700 text-[11px] font-mono font-bold flex items-center gap-2 shadow-lg">
              <span>Heading: {mapBearing}°</span>
              <button
                type="button"
                onClick={() => {
                  animateBearingTo(0);
                  setTimeout(scheduleLabelRefresh, 180);
                }}
                className="text-emerald-400 hover:underline font-sans text-[10px] cursor-pointer"
              >
                Reset North
              </button>
            </div>
          )}

          {/* GOOGLE EARTH-STYLE BOTTOM-RIGHT NAVIGATION CLUSTER (Rotate + Compass + Zoom) */}
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute bottom-5 right-4 z-[460] flex items-center gap-2 select-none"
          >
            {/* Manual Rotate Step Buttons (-15° / +15°) */}
            <div className="hidden sm:flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg p-0.5">
              <button
                type="button"
                onClick={() => rotateByStep(-15)}
                title="Rotate Counter-Clockwise (-15°) • Or Right-Click + Drag on map"
                className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => rotateByStep(15)}
                title="Rotate Clockwise (+15°) • Or Right-Click + Drag on map"
                className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Google Earth Red/White Compass Needle Circle Button */}
            <button
              ref={compassBtnRef}
              type="button"
              onMouseDown={handleCompassMouseDown}
              title="Rotate map: Drag needle to rotate manually • Click to reset North (0°) • Right-click + drag on map to rotate"
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6"
                style={{
                  transform: `rotate(${mapBearing}deg)`,
                }}
              >
                {/* Red North Needle */}
                <polygon points="12,2 15.4,12 8.6,12" fill="#ea4335" />
                <polygon points="12,2 15.4,12 12,12" fill="#c5221f" />
                {/* Silver/White South Needle */}
                <polygon points="12,22 15.4,12 8.6,12" fill="#e2e8f0" />
                <polygon points="12,22 15.4,12 12,12" fill="#94a3b8" />
                <circle cx="12" cy="12" r="1.3" fill="#475569" />
              </svg>
            </button>

            {/* Zoom In / Out Pill (- / +) */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={() => mapInstanceRef.current?.zoomOut()}
                title="Zoom Out"
                className="w-8 h-9 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-base transition-colors cursor-pointer"
              >
                −
              </button>
              <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                onClick={() => mapInstanceRef.current?.zoomIn()}
                title="Zoom In"
                className="w-8 h-9 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-base transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {(importStatus || renderProgress) && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[460] px-3 py-1.5 rounded-full bg-slate-900 text-white text-[11px] font-semibold shadow-lg pointer-events-none">
              {importStatus
                ? (importStatus.phase === 'reading' ? 'Reading ' : 'Parsing ') +
                  importStatus.name +
                  '...'
                : 'Drawing polygons ' +
                  renderProgress.done.toLocaleString() +
                  ' / ' +
                  renderProgress.total.toLocaleString() +
                  '...'}
            </div>
          )}

          {/* GOOGLE EARTH-STYLE CTRL/SHIFT MULTI-SELECTION SUMMARY CARD */}
          {multiSelectionSummary && mapMode === 'view' && !isMergeMode && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 right-4 z-[455] w-[355px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden select-none"
            >
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {multiSelectionSummary.totalCount} selected{' '}
                    {multiSelectionSummary.totalCount === 1 ? 'feature' : 'features'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearMultiSelection}
                  title="Clear selection (Esc)"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsMultiBreakdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 text-left group cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Approximate sum of areas
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                        {multiSelectionSummary.totalAreaHa.toFixed(2)} ha
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        (~{multiSelectionSummary.totalEstTons.toLocaleString()} MT)
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={
                      'w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-transform ' +
                      (isMultiBreakdownOpen ? 'rotate-180' : '')
                    }
                  />
                </button>

                {isMultiBreakdownOpen && (
                  <div className="max-h-40 overflow-y-auto border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1">
                    {multiSelectionSummary.items.map((item) => (
                      <div
                        key={item.key}
                        className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div
                          className={
                            'min-w-0 flex-1 ' + (item.isHidden ? 'opacity-45 line-through' : '')
                          }
                        >
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate uppercase">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0 tabular-nums">
                          {item.areaHa.toFixed(2)} ha
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.kind === 'lot') {
                              setHiddenLotIds((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((id) => id !== item.id)
                                  : [...prev, item.id]
                              );
                            } else {
                              setHiddenKmlIds((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((id) => id !== item.id)
                                  : [...prev, item.id]
                              );
                            }
                          }}
                          title={item.isHidden ? 'Show on map' : 'Hide on map'}
                          className="text-slate-400 hover:text-sky-500 p-0.5 cursor-pointer"
                        >
                          {item.isHidden ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.kind === 'lot') {
                              setMultiSelectedLotIds((prev) =>
                                prev.filter((id) => id !== item.id)
                              );
                            } else {
                              setMultiSelectedKmlIds((prev) =>
                                prev.filter((id) => id !== item.id)
                              );
                            }
                          }}
                          title="Remove from selection"
                          className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {multiSelectionSummary.selectedKmls.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={quickPlanterName}
                        onChange={(e) => setQuickPlanterName(e.target.value)}
                        placeholder="Planter Name..."
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKmlDefaultsForm((prev) => !prev)}
                        title="Edit default Hacienda, Brgy, City & Association"
                        className={
                          'p-1.5 rounded-lg border transition-colors cursor-pointer ' +
                          (showKmlDefaultsForm
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700')
                        }
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {showKmlDefaultsForm && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-1.5 text-[11px]">
                        <input
                          type="text"
                          value={kmlDefaults.hacienda}
                          onChange={(e) =>
                            setKmlDefaults((p) => ({ ...p, hacienda: e.target.value }))
                          }
                          placeholder="Hacienda"
                          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                        />
                        <input
                          type="text"
                          value={kmlDefaults.barangay}
                          onChange={(e) =>
                            setKmlDefaults((p) => ({ ...p, barangay: e.target.value }))
                          }
                          placeholder="Barangay"
                          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                        />
                        <input
                          type="text"
                          value={kmlDefaults.city}
                          onChange={(e) =>
                            setKmlDefaults((p) => ({ ...p, city: e.target.value }))
                          }
                          placeholder="City"
                          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                        />
                        <select
                          value={kmlDefaults.association}
                          onChange={(e) =>
                            setKmlDefaults((p) => ({ ...p, association: e.target.value }))
                          }
                          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                        >
                          {(Array.isArray(PLANTER_ASSOCIATIONS)
                            ? PLANTER_ASSOCIATIONS
                            : ['APSSI', 'APP-NEG', 'AHSSI', 'Private']
                          ).map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          executeQuickRegisterKml(
                            multiSelectionSummary.selectedKmls,
                            true,
                            quickPlanterName
                          )
                        }
                        className="col-span-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>
                          {multiSelectionSummary.selectedKmls.length > 1
                            ? `Merge & Register as 1 Lot (${multiSelectionSummary.totalAreaHa.toFixed(2)} ha)`
                            : `Quick Register Lot (${multiSelectionSummary.totalAreaHa.toFixed(2)} ha)`}
                        </span>
                      </button>

                      {multiSelectionSummary.selectedKmls.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            executeQuickRegisterKml(
                              multiSelectionSummary.selectedKmls,
                              false,
                              null
                            )
                          }
                          className="col-span-2 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            Register as {multiSelectionSummary.selectedKmls.length} Separate Lots
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFitMultiSelection}
                    className="px-3 py-1.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Fit Selection</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleHideMultiSelected}
                    className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {multiSelectionSummary.allSelectedHidden ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Show Selected</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide Selected</span>
                      </>
                    )}
                  </button>

                  {multiSelectionSummary.selectedLots.length === 1 &&
                    multiSelectionSummary.selectedKmls.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = multiSelectionSummary.selectedLots[0];
                          clearMultiSelection();
                          onSelectLot(target);
                        }}
                        className="px-3 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* SINGLE KML PLOT INSPECTOR CARD */}
          {activeKmlFeature && !multiSelectionSummary && mapMode === 'view' && !isMergeMode && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 right-4 z-[450] w-[355px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-sky-300 dark:border-sky-700 overflow-hidden select-none"
            >
              <div className="h-1.5 w-full bg-sky-500" />
              <div className="p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      KML Folder: {activeKmlFeature.folder}
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1.5 truncate">
                      {activeKmlFeature.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleHideKml(activeKmlFeature)}
                      title="Hide this KML plot on map"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveKmlFeature(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-500">This Slice Area</div>
                    <div className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                      {activeKmlFeature.areaHa} ha
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-500">Centroid Lat/Lng</div>
                    <div className="font-mono font-bold text-[11px] text-slate-900 dark:text-white mt-1">
                      {activeKmlFeature.latitude.toFixed(4)}°N,{' '}
                      {activeKmlFeature.longitude.toFixed(4)}°E
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span>
                      Location:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {kmlDefaults.hacienda}, {kmlDefaults.city}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowKmlDefaultsForm((prev) => !prev)}
                      className="text-sky-600 dark:text-sky-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{showKmlDefaultsForm ? 'Hide Defaults' : 'Edit Defaults'}</span>
                    </button>
                  </div>

                  {showKmlDefaultsForm && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-1.5 text-[11px]">
                      <input
                        type="text"
                        value={quickPlanterName}
                        onChange={(e) => setQuickPlanterName(e.target.value)}
                        placeholder="Planter Name"
                        className="col-span-2 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                      />
                      <input
                        type="text"
                        value={kmlDefaults.hacienda}
                        onChange={(e) =>
                          setKmlDefaults((p) => ({ ...p, hacienda: e.target.value }))
                        }
                        placeholder="Hacienda"
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                      />
                      <input
                        type="text"
                        value={kmlDefaults.barangay}
                        onChange={(e) =>
                          setKmlDefaults((p) => ({ ...p, barangay: e.target.value }))
                        }
                        placeholder="Barangay"
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                      />
                      <input
                        type="text"
                        value={kmlDefaults.city}
                        onChange={(e) =>
                          setKmlDefaults((p) => ({ ...p, city: e.target.value }))
                        }
                        placeholder="City"
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                      />
                      <select
                        value={kmlDefaults.association}
                        onChange={(e) =>
                          setKmlDefaults((p) => ({ ...p, association: e.target.value }))
                        }
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                      >
                        {(Array.isArray(PLANTER_ASSOCIATIONS)
                          ? PLANTER_ASSOCIATIONS
                          : ['APSSI', 'APP-NEG', 'AHSSI', 'Private']
                        ).map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {samePlanterKmlGroup.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        executeQuickRegisterKml(
                          samePlanterKmlGroup,
                          true,
                          quickPlanterName
                        )
                      }
                      className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>
                        Merge & Register All {samePlanterKmlGroup.length} Slices (
                        {samePlanterKmlTotalHa} ha)
                      </span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        executeQuickRegisterKml(
                          [activeKmlFeature],
                          true,
                          quickPlanterName
                        )
                      }
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {samePlanterKmlGroup.length > 1
                          ? `Register Only This Slice (${activeKmlFeature.areaHa} ha)`
                          : `Quick Register Lot (${activeKmlFeature.areaHa} ha)`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onCreateLotFromPolygon(
                          activeKmlFeature.coordinates,
                          activeKmlFeature.areaHa,
                          activeKmlFeature.latitude,
                          activeKmlFeature.longitude
                        );
                      }}
                      title="Open full registration form modal"
                      className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                    >
                      Form…
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FLOATING LOT POPUP CONTAINER ABOVE PLOTTED AREA */}
          {activePopupLot && !multiSelectionSummary && mapMode === 'view' && !isMergeMode && (
            <div
              ref={popupCardRef}
              key={activePopupLot.id}
              style={{
                left: Math.round(popupPos.x) + 'px',
                top: Math.round(popupPos.y) + 'px',
              }}
              onClick={(e) => e.stopPropagation()}
              className="absolute z-[450] w-[340px] sm:w-[360px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden select-none"
            >
              <div
                className={
                  'h-1.5 w-full ' + getStatusStyles(activePopupLot.status).bar
                }
              />

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {activePopupLot.id}
                      </span>
                      <span
                        className={
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ' +
                          getStatusStyles(activePopupLot.status).badge
                        }
                      >
                        <span
                          className={
                            'w-1.5 h-1.5 rounded-full ' +
                            getStatusStyles(activePopupLot.status).dot
                          }
                        />
                        {activePopupLot.statusBadgeLabel || activePopupLot.status}
                      </span>
                      {activePopupIsMerged && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border bg-violet-50 dark:bg-violet-950/70 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800">
                          {activePopupLot.multiCoordinates.length} slices
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1 truncate">
                      {activePopupLot.planter}
                    </h4>
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                      {activePopupLot.association}
                      {activePopupLot.contactNumber
                        ? ` • ${activePopupLot.contactNumber}`
                        : ''}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {activePopupLot.hacienda}, {activePopupLot.barangay},{' '}
                      {activePopupLot.city}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleHideLot(activePopupLot)}
                      title="Hide this plotted area on map"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePopupLotId(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] text-slate-500">Field Hectarage</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                      {Number(activePopupLot.areaHa).toFixed(2)} ha
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ~{activePopupLot.estimatedTons.toLocaleString()} MT
                    </div>
                  </div>

                                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar
                        className={
                          'w-3 h-3 ' +
                          (getStatusStyles(activePopupLot.status).icon || 'text-emerald-600')
                        }
                      />
                      <span>Target Harvest Date</span>
                    </div>
                    <div
                      title={activePopupLot.plannedHarvestDate || 'No harvest date scheduled'}
                      className={
                        'text-sm font-extrabold mt-0.5 ' +
                        (getStatusStyles(activePopupLot.status).text ||
                          'text-slate-900 dark:text-white')
                      }
                    >
                      {activePopupLot.formattedHarvestDate ||
                        activePopupLot.plannedHarvestDate ||
                        'Not Scheduled'}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400">
                      {activePopupLot.harvestTimelineLabel}
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
                    <Compass className="w-3.5 h-3.5 text-rose-500" />
                    Lat / Long:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {activePopupLot.latitude.toFixed(5)}° N,{' '}
                    {activePopupLot.longitude.toFixed(5)}° E
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={activePopupIsMerged}
                    title={
                      activePopupIsMerged
                        ? 'Reshape is not available for merged lots (several polygons)'
                        : undefined
                    }
                    onClick={() => handleStartEditLot(activePopupLot)}
                    className="py-2 px-3 rounded-lg border border-emerald-600 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Reshape Area</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = activePopupLot;
                      setActivePopupLotId(null);
                      onSelectLot(target);
                    }}
                    className="py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Edit / Schedule</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


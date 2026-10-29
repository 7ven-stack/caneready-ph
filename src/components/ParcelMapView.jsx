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
} from 'lucide-react';
import {
  getStatusStyles,
  calculatePolygonAreaHa,
  computeCentroidLatLng,
  pointInRing,
} from '../utils/caneCalculations';

const KML_STORAGE_KEY = 'caneready_kml_overlays_v1';
const PANEL_WIDTH_KEY = 'caneready_map_panel_width_v1';

// ---- Performance tuning knobs -------------------------------------------------
const KML_PERSIST_MAX_CHARS = 3000000; // above this the KML layer is not kept in localStorage
const KML_DRAW_CHUNK = 300; // polygons created per frame while drawing a big import
const LABEL_MIN_ZOOM_LOTS = 14; // planter lot labels appear from this zoom
const LABEL_MIN_ZOOM_KML = 16; // imported KML labels appear from this zoom
const MAX_VISIBLE_LABELS = 120; // cap visible DOM labels on screen
const LABEL_BOX_W = 116; // screen-space collision width (px)
const LABEL_BOX_H = 34; // screen-space collision height (px)
const MAX_MIDPOINT_HANDLES = 150; // skip "insert corner" handles on very detailed shapes
const KML_FOLDER_AUTO_COLLAPSE = 40; // big KML folders start collapsed in the tree
const KML_PAGE_SIZE = 150; // KML tree rows rendered per folder before "Show more"

const BASEMAPS = {
  googleHybrid: {
    name: 'Google Earth',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
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
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
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

function truncate(value, max = 28) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
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
  const isPopupSel = Boolean(sel.mapMode === 'view' && sel.popupId === lot.id);
  const selected = isMergeSel || isPopupSel;
  return {
    selected,
    style: {
      color: isMergeSel ? '#7c3aed' : selected ? '#ffffff' : base.polygonStroke,
      weight: isMergeSel ? 3.5 : selected ? 3 : 1.8,
      fillColor: isMergeSel ? '#8b5cf6' : base.polygonFill,
      fillOpacity: sel.mapMode !== 'view' ? 0.25 : selected ? 0.68 : 0.44,
      smoothFactor: 1.2,
    },
  };
}

function styleKey(style) {
  return style.color + '|' + style.weight + '|' + style.fillColor + '|' + style.fillOpacity;
}

function getKmlStyle(isActive) {
  return {
    color: isActive ? '#ffffff' : '#38bdf8',
    weight: isActive ? 3.2 : 1.8,
    fillColor: '#0284c7',
    fillOpacity: isActive ? 0.62 : 0.35,
    smoothFactor: 1.5,
  };
}

function lotLabelHtml(lot, slices) {
  const note = slices > 1 ? ` • ${slices} slices` : '';
  return (
    '<div class="cane-map-label-inner">' +
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
    ')</div></div></div>'
  );
}

function kmlLabelHtml(feat) {
  return (
    '<div class="cane-map-label-inner">' +
    '<div class="cane-map-label-pill cane-map-label-pill-kml">' +
    '<div class="cane-map-label-title" style="color:#e0f2fe;">' +
    escapeHtml(truncate(feat.name, 24)) +
    '</div>' +
    '<div class="cane-map-label-sub">' +
    escapeHtml(feat.areaHa) +
    ' ha</div></div></div>'
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
// Imported KML tree (Memoized)
// ---------------------------------------------------------------------------------
const KmlTreeSection = React.memo(function KmlTreeSection({
  groups,
  totalCount,
  activeId,
  openFolders,
  onToggleFolder,
  onFocus,
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

        return (
          <div key={fKey} className="mt-0.5">
            <button
              type="button"
              onClick={() => onToggleFolder(fKey, expanded)}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 text-left cursor-pointer"
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
              <span className="truncate flex-1">{folderName}</span>
              <span className="text-[10px] font-mono text-slate-400">
                {feats.length.toLocaleString()}
              </span>
            </button>

            {expanded && (
              <div className="pl-5 pr-2 space-y-0.5 mt-0.5">
                {shown.map((feat) => {
                  const isSel = activeId === feat.id;
                  return (
                    <button
                      key={feat.id}
                      type="button"
                      onClick={() => onFocus(feat)}
                      className={
                        'w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ' +
                        (isSel
                          ? 'bg-sky-600 text-white font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200')
                      }
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PolygonNodeIcon color={isSel ? '#ffffff' : '#0284c7'} />
                        <span className="truncate uppercase font-semibold">
                          {feat.name}
                        </span>
                      </div>
                      <span
                        className={
                          'text-[10px] font-mono shrink-0 ' +
                          (isSel ? 'text-sky-100' : 'text-slate-400')
                        }
                      >
                        {feat.areaHa} ha
                      </span>
                    </button>
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
// Registered Planter Lots Tree (Memoized so map pans / edits never re-render it)
// ---------------------------------------------------------------------------------
const PlanterTreeSection = React.memo(function PlanterTreeSection({
  groups,
  totalLotsCount,
  isMergeMode,
  mergeSet,
  activePopupLotId,
  openFolders,
  onToggleFolder,
  onToggleAllFolders,
  onLotClick,
}) {
  const folderEntries = Object.entries(groups);
  const allExpanded = folderEntries.every(
    ([name]) => openFolders[`lot:${name}`] !== false
  );

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

        return (
          <div key={fKey} className="mt-0.5">
            <button
              type="button"
              onClick={() => onToggleFolder(fKey, expanded)}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-bold text-slate-800 dark:text-slate-100 text-left cursor-pointer"
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
              <span className="truncate flex-1">{folderName}</span>
              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                {groupLots.length}
              </span>
            </button>

            {expanded && (
              <div className="pl-5 pr-2 space-y-0.5 mt-0.5 pb-1">
                {groupLots.map((lot) => {
                  const isSel = isMergeMode
                    ? mergeSet.has(lot.id)
                    : activePopupLotId === lot.id;
                  const st = getStatusStyles(lot.status);

                  return (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => onLotClick(lot)}
                      title={`${lot.planter} — ${lot.id} • ${lot.hacienda} (${Number(lot.areaHa).toFixed(2)} ha)`}
                      className={
                        'w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ' +
                        (isSel
                          ? (isMergeMode ? 'bg-violet-700' : 'bg-emerald-800') +
                            ' text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200')
                      }
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PolygonNodeIcon
                          color={isSel ? '#ffffff' : st.polygonFill}
                        />
                        <span className="truncate uppercase font-bold tracking-tight text-xs">
                          {lot.planter}
                        </span>
                      </div>

                      <span
                        className={
                          'text-[11px] font-mono font-semibold shrink-0 tabular-nums ' +
                          (isSel
                            ? 'text-white'
                            : 'text-slate-400 dark:text-slate-400')
                        }
                      >
                        {Number(lot.areaHa).toFixed(2)} ha
                      </span>
                    </button>
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
  const mapContainerRef = useRef(null);
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
  const activeLabelMarkersRef = useRef(new Map());
  const labelItemsRef = useRef({ lots: [], kml: [] });
  const labelTimerRef = useRef(0);
  const prevActiveKmlIdRef = useRef(null);

  const isMergeModeRef = useRef(isMergeMode);
  const onSelectLotRef = useRef(onSelectLot);
  useEffect(() => {
    isMergeModeRef.current = isMergeMode;
    onSelectLotRef.current = onSelectLot;
  }, [isMergeMode, onSelectLot]);

  const mergeSet = useMemo(
    () => new Set(Array.isArray(mergeSelectedIds) ? mergeSelectedIds : []),
    [mergeSelectedIds]
  );

  const selectionRef = useRef(null);
  selectionRef.current = {
    popupId: activePopupLotId,
    mergeSet,
    isMergeMode,
    mapMode,
  };
  const activeKmlIdRef = useRef(null);
  activeKmlIdRef.current = activeKmlFeature ? activeKmlFeature.id : null;

  const activePopupLot = useMemo(
    () => lots.find((l) => l.id === activePopupLotId) || null,
    [lots, activePopupLotId]
  );
  const editingLot = useMemo(
    () => lots.find((l) => l.id === editingLotId) || null,
    [lots, editingLotId]
  );
  const draftAreaHa = useMemo(() => calculatePolygonAreaHa(draftCoords), [draftCoords]);

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
    }
  }, [isMergeMode]);

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

  // O(1) popup pixel tracking using pre-cached bounds in lotLayersRef
  const updatePopupPixelPosition = useCallback((targetLot, options = {}) => {
    const { commit = true } = options;
    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;
    if (!map || !container || !targetLot) return;

    const cached = lotLayersRef.current.get(targetLot.id);
    const bounds = cached?.bounds || getRingsBounds(getLotRings(targetLot, 0));
    if (!bounds || !bounds.isValid()) return;

    const centerLng = bounds.getCenter().lng;
    const topPt = map.latLngToContainerPoint(L.latLng(bounds.getNorth(), centerLng));
    const bottomPt = map.latLngToContainerPoint(L.latLng(bounds.getSouth(), centerLng));

    const containerWidth = container.clientWidth || 900;
    const containerHeight = container.clientHeight || 660;
    const cardWidth = popupCardRef.current?.offsetWidth || 352;
    const cardHeight = popupCardRef.current?.offsetHeight || 275;

    const clampedLeft = Math.max(
      14,
      Math.min(containerWidth - cardWidth - 14, Math.round(topPt.x - cardWidth / 2))
    );

    let desiredTop = Math.round(topPt.y - cardHeight - 14);
    if (desiredTop < 14) {
      if (bottomPt.y + cardHeight + 18 <= containerHeight - 14) {
        desiredTop = Math.round(bottomPt.y + 14);
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
  }, []);

  const focusPolygonWithPopupOffset = useCallback(
    (targetLot) => {
      const map = mapInstanceRef.current;
      if (!map || !targetLot) return;

      const cached = lotLayersRef.current.get(targetLot.id);
      const polyBounds = cached?.bounds || getRingsBounds(getLotRings(targetLot, 0));
      if (!polyBounds || !polyBounds.isValid()) return;

      const center = polyBounds.getCenter();
      const targetZoom = Math.max(map.getZoom(), 17);
      const targetPoint = map.project(center, targetZoom);
      const offsetPoint = L.point(targetPoint.x, targetPoint.y - 95);
      const offsetLatLng = map.unproject(offsetPoint, targetZoom);

      setActiveKmlFeature(null);
      setActivePopupLotId(targetLot.id);
      map.flyTo(offsetLatLng, targetZoom, { animate: true, duration: 0.42 });

      setTimeout(() => {
        updatePopupPixelPosition(targetLot);
      }, 100);
    },
    [updatePopupPixelPosition]
  );

  const handlePlanterTreeLotClick = useCallback(
    (lot) => {
      if (isMergeModeRef.current) {
        if (onSelectLotRef.current) onSelectLotRef.current(lot);
      } else {
        focusPolygonWithPopupOffset(lot);
      }
    },
    [focusPolygonWithPopupOffset]
  );

  const focusKmlFeature = useCallback((feat) => {
    const map = mapInstanceRef.current;
    if (!map || !feat) return;
    setActivePopupLotId(null);
    setActiveKmlFeature(feat);

    if (Array.isArray(feat.coordinates) && feat.coordinates.length >= 3) {
      map.flyToBounds(L.latLngBounds(feat.coordinates), {
        padding: [70, 70],
        maxZoom: 18,
        duration: 0.45,
      });
    }
  }, []);

  const handleKmlTreeFocus = useCallback(
    (feat) => {
      if (isMergeModeRef.current) return;
      focusKmlFeature(feat);
    },
    [focusKmlFeature]
  );

  const handleClearKml = useCallback(() => {
    setImportedFeatures([]);
    setActiveKmlFeature(null);
  }, []);

  // ---- Diffed + Collision-Filtered Map Labels ------------------------------------
  const refreshLabels = useCallback(() => {
    const map = mapInstanceRef.current;
    const layer = labelLayerRef.current;
    if (!map || !layer) return;

    const zoom = map.getZoom();
    const activeMarkers = activeLabelMarkersRef.current;

    if (zoom < LABEL_MIN_ZOOM_LOTS) {
      if (activeMarkers.size > 0) {
        layer.clearLayers();
        activeMarkers.clear();
      }
      return;
    }

    const b = map.getBounds().pad(0.12);
    const south = b.getSouth();
    const north = b.getNorth();
    const west = b.getWest();
    const east = b.getEast();
    const { lots: lotItems, kml: kmlItems } = labelItemsRef.current;

    const candidates = [];
    for (let i = 0; i < lotItems.length; i++) {
      const it = lotItems[i];
      if (it.lat >= south && it.lat <= north && it.lng >= west && it.lng <= east) {
        candidates.push(it);
      }
    }
    if (zoom >= LABEL_MIN_ZOOM_KML) {
      for (let i = 0; i < kmlItems.length; i++) {
        const it = kmlItems[i];
        if (it.lat >= south && it.lat <= north && it.lng >= west && it.lng <= east) {
          candidates.push(it);
        }
      }
    }

    // Sort larger parcels first so primary fields win label space when zoomed out
    candidates.sort((a, b2) => b2.rank - a.rank);

    const occupiedBoxes = [];
    const accepted = [];

    for (let i = 0; i < candidates.length && accepted.length < MAX_VISIBLE_LABELS; i++) {
      const it = candidates[i];
      const pt = map.latLngToContainerPoint([it.lat, it.lng]);
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
        accepted.push(it);
      }
    }

    const nextKeys = new Set();
    for (let i = 0; i < accepted.length; i++) {
      const it = accepted[i];
      nextKeys.add(it.key);

      if (!activeMarkers.has(it.key)) {
        const marker = L.marker([it.lat, it.lng], {
          icon: L.divIcon({
            className: 'cane-map-label',
            html: it.html,
            iconSize: [0, 0],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(layer);
        activeMarkers.set(it.key, marker);
      }
    }

    // Remove only labels that scrolled out of view or were hidden by collision
    activeMarkers.forEach((marker, key) => {
      if (!nextKeys.has(key)) {
        layer.removeLayer(marker);
        activeMarkers.delete(key);
      }
    });
  }, []);

  const scheduleLabelRefresh = useCallback(() => {
    clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(refreshLabels, 45);
  }, [refreshLabels]);

  // ---- Map creation --------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.8185, 123.0145],
      zoom: 15,
      minZoom: 10,
      maxZoom: 22,
      zoomControl: false,
      doubleClickZoom: false,
      preferCanvas: true,
      renderer: L.canvas({ padding: 0.5, tolerance: 4 }),
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    polygonsGroupRef.current = L.featureGroup().addTo(map);
    kmlGroupRef.current = L.featureGroup().addTo(map);
    labelLayerRef.current = L.layerGroup().addTo(map);
    searchPinGroupRef.current = L.featureGroup().addTo(map);
    editLayerGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    map.on('moveend zoomend', scheduleLabelRefresh);

    const resizeObserver = new ResizeObserver(() => {
      const el = mapContainerRef.current;
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
      map.invalidateSize({ pan: false });
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      clearTimeout(labelTimerRef.current);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      lotLayersRef.current = new Map();
      kmlLayersRef.current = new Map();
      activeLabelMarkersRef.current = new Map();
    };
  }, [scheduleLabelRefresh]);

  useEffect(() => {
    if (!isActive) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize({ pan: false });
      scheduleLabelRefresh();
    }, 50);
    return () => clearTimeout(timer);
  }, [isActive, scheduleLabelRefresh]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize({ pan: false });
      if (activePopupLot) updatePopupPixelPosition(activePopupLot);
    }, 220);
    return () => clearTimeout(timer);
  }, [isSidePanelOpen, panelWidth, activePopupLot, updatePopupPixelPosition]);

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
      maxNativeZoom: config.maxNativeZoom || 19,
      maxZoom: config.maxZoom || 22,
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 6,
    }).addTo(map);

    if (config.overlayUrl) {
      labelOverlayRef.current = L.tileLayer(config.overlayUrl, {
        maxNativeZoom: config.maxNativeZoom || 19,
        maxZoom: config.maxZoom || 22,
        pane: 'overlayPane',
        updateWhenZooming: false,
        keepBuffer: 4,
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
  }, [mapMode]);

  // ---- Registered planter lots ---------------------------------------------------
  const restyleLots = useCallback(() => {
    const sel = selectionRef.current;
    lotLayersRef.current.forEach((entry) => {
      const { style, selected } = getLotStyle(entry.lot, sel);
      const key = styleKey(style);
      if (key !== entry.key) {
        entry.layer.setStyle(style);
        entry.key = key;
        if (selected) entry.layer.bringToFront();
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
      activeLabelMarkersRef.current.clear();
    }

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
          focusPolygonWithPopupOffset(lot);
        });
      }

      polygon.addTo(group);
      if (selected) polygon.bringToFront();
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
  }, [lots, mapMode, editingLotId, focusPolygonWithPopupOffset, scheduleLabelRefresh]);

  useEffect(() => {
    restyleLots();
  }, [activePopupLotId, mergeSet, isMergeMode, mapMode, restyleLots]);

  // ---- Imported KML / GeoJSON features -------------------------------------------
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
        const poly = L.polygon(
          feat.coordinates,
          getKmlStyle(activeKmlIdRef.current === feat.id)
        );
        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (isMergeModeRef.current) return;
          setActivePopupLotId(null);
          setActiveKmlFeature(feat);
        });
        poly.addTo(kmlGroup);
        layerMap.set(feat.id, poly);
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
  }, [importedFeatures, scheduleLabelRefresh]);

  useEffect(() => {
    const prevId = prevActiveKmlIdRef.current;
    const nextId = activeKmlFeature ? activeKmlFeature.id : null;
    prevActiveKmlIdRef.current = nextId;

    if (prevId && prevId !== nextId) {
      const prevLayer = kmlLayersRef.current.get(prevId);
      if (prevLayer) prevLayer.setStyle(getKmlStyle(false));
    }
    if (nextId) {
      const nextLayer = kmlLayersRef.current.get(nextId);
      if (nextLayer) {
        nextLayer.setStyle(getKmlStyle(true));
        nextLayer.bringToFront();
      }
    }
  }, [activeKmlFeature]);

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

  // ---- Draw / reshape editor -----------------------------------------------------
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
            map.flyToBounds(bounds, { padding: [50, 50], duration: 0.65 });
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
    setDraftCoords(coords.map((c) => [...c]));
    setMapMode('edit');

    const map = mapInstanceRef.current;
    if (map && coords.length >= 3) {
      map.flyToBounds(L.latLngBounds(coords), {
        padding: [80, 80],
        maxZoom: 18,
        duration: 0.45,
      });
    }
  };

  const handleStartDrawNew = () => {
    if (isMergeMode && onToggleMergeMode) onToggleMergeMode();
    setActivePopupLotId(null);
    setActiveKmlFeature(null);
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

    const bounds = L.latLngBounds([]);
    if (group && group.getLayers().length > 0) bounds.extend(group.getBounds());
    if (kmlGroup && kmlGroup.getLayers().length > 0) bounds.extend(kmlGroup.getBounds());

    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [45, 45], duration: 0.55 });
    }
  };

  const activePopupIsMerged = isMultiRingLot(activePopupLot);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <style>{
        '.cane-map-label { background: transparent !important; border: none !important; box-shadow: none !important; pointer-events: none !important; }' +
        '.cane-map-label-inner { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; text-align: center; line-height: 1.15; pointer-events: none; }' +
        '.cane-map-label-pill { padding: 2px 6px; border-radius: 6px; background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(255, 255, 255, 0.18); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45); }' +
        '.cane-map-label-pill-kml { background: rgba(12, 74, 110, 0.78); border-color: rgba(56, 189, 248, 0.35); }' +
        '.cane-map-label-title { font-weight: 800; font-size: 10.5px; color: #ffffff; letter-spacing: 0.01em; }' +
        '.cane-map-label-sub { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; font-size: 9.5px; color: #cbd5e1; }' +
        '.leaflet-container { cursor: ' +
        (mapMode === 'view' ? 'grab' : 'crosshair') +
        ' !important; }'
      }</style>

      {/* SINGLE COMPACT GIS TOP BAR */}
      <div className="px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
        {/* Left: Wide Coordinate / Planter Search Input */}
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

        {/* Center: Compact Legend or Active Digitizer Controls */}
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
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Right: Basemaps + KML Import + Merge Fields + Draw Polygon + Fit All */}
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

      {/* FULL-SCREEN SPLIT WORKSPACE: Resizable Left Tree + Edge-to-Edge Satellite Map */}
      <div
        ref={splitWrapperRef}
        className={
          'relative isolate z-0 flex-1 min-h-0 w-full flex overflow-hidden ' +
          (isResizing ? 'select-none cursor-col-resize' : '')
        }
      >
        {/* ADJUSTABLE & COLLAPSIBLE LEFT SIDE PANEL */}
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
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">
                    {(lots.length + importedFeatures.length).toLocaleString()} items
                  </span>
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
                  openFolders={openFolders}
                  onToggleFolder={toggleFolder}
                  onFocus={handleKmlTreeFocus}
                  onClear={handleClearKml}
                  notPersisted={kmlNotPersisted}
                />

                <PlanterTreeSection
                  groups={groupedPlanterFolders}
                  totalLotsCount={lots.length}
                  isMergeMode={isMergeMode}
                  mergeSet={mergeSet}
                  activePopupLotId={activePopupLotId}
                  openFolders={openFolders}
                  onToggleFolder={toggleFolder}
                  onToggleAllFolders={handleToggleAllPlanterFolders}
                  onLotClick={handlePlanterTreeLotClick}
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

        {/* Right Side: Interactive Leaflet Satellite Map */}
        <div className="relative flex-1 h-full">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {(importStatus || renderProgress) && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[460] px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-[11px] font-semibold shadow-lg pointer-events-none">
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

          {activeKmlFeature && mapMode === 'view' && !isMergeMode && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 right-4 z-[450] w-[330px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-sky-300 dark:border-sky-700 overflow-hidden animate-drawer-item"
            >
              <div className="h-1.5 w-full bg-sky-500" />
              <div className="p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                      KML Folder: {activeKmlFeature.folder}
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1.5 truncate">
                      {activeKmlFeature.name}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveKmlFeature(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-500">Calculated Area</div>
                    <div className="text-base font-black text-slate-900 dark:text-white">
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
                  className="w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register as Planter Lot ({activeKmlFeature.areaHa} ha)</span>
                </button>
              </div>
            </div>
          )}

          {activePopupLot && mapMode === 'view' && !isMergeMode && (
            <div
              ref={popupCardRef}
              key={activePopupLot.id}
              style={{
                left: popupPos.x + 'px',
                top: popupPos.y + 'px',
              }}
              onClick={(e) => e.stopPropagation()}
              className="absolute z-[450] w-[340px] sm:w-[360px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-map-popup select-none"
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

                  <button
                    type="button"
                    onClick={() => setActivePopupLotId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      Planned Harvest
                    </div>
                    <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {activePopupLot.plannedHarvestDate || 'Not set'}
                    </div>
                    <div className="text-[10px] text-slate-400">
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


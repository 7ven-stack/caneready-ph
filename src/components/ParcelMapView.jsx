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
} from 'lucide-react';
import {
  getStatusStyles,
  calculatePolygonAreaHa,
  computeCentroidLatLng,
} from '../utils/caneCalculations';

const KML_STORAGE_KEY = 'caneready_kml_overlays_v1';
const PANEL_WIDTH_KEY = 'caneready_map_panel_width_v1';

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
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
  googleSat: {
    name: 'Clean Sat',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: 'Imagery &copy; Google Satellite',
    maxZoom: 21,
  },
};

function PolygonNodeIcon({ color = '#10b981', className = 'w-4 h-4 shrink-0' }) {
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
}

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
                  id: `KML-${Date.now()}-${counter++}`,
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
                id: `KML-PT-${Date.now()}-${counter++}`,
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
          id: `GEO-${Date.now()}-${counter++}`,
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

export default function ParcelMapView({
  lots = [],
  onSelectLot,
  onUpdateLotBoundary,
  onCreateLotFromPolygon,
}) {
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
      return saved >= 220 && saved <= 680 ? saved : 320;
    } catch {
      return 320;
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
  const searchPinGroupRef = useRef(null);
  const editLayerGroupRef = useRef(null);
  const fileInputRef = useRef(null);

  const activePopupLot = lots.find((l) => l.id === activePopupLotId) || null;
  const editingLot = lots.find((l) => l.id === editingLotId) || null;
  const draftAreaHa = calculatePolygonAreaHa(draftCoords);

  useEffect(() => {
    try {
      localStorage.setItem(KML_STORAGE_KEY, JSON.stringify(importedFeatures));
    } catch {}
  }, [importedFeatures]);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
    } catch {}
  }, [panelWidth]);

  const startResizingPanel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const wrapperRect = splitWrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;
      const maxAllowed = Math.min(680, Math.floor(wrapperRect.width * 0.7));
      const newWidth = Math.max(
        220,
        Math.min(maxAllowed, Math.round(clientX - wrapperRect.left))
      );
      setPanelWidth(newWidth);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ pan: false });
      }
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
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

  const isFolderExpanded = (folderKey) => openFolders[folderKey] !== false;

  const toggleFolder = (folderKey) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderKey]: prev[folderKey] === false ? true : false,
    }));
  };

  const updatePopupPixelPosition = useCallback(
    (targetLot) => {
      const map = mapInstanceRef.current;
      const container = mapContainerRef.current;
      if (!map || !container || !targetLot) return;

      const idx = lots.findIndex((l) => l.id === targetLot.id);
      const coords = getLotCoordinates(targetLot, idx >= 0 ? idx : 0);
      if (!coords || coords.length < 3) return;

      const bounds = L.polygon(coords).getBounds();
      const northCenter = L.latLng(bounds.getNorth(), bounds.getCenter().lng);
      const southCenter = L.latLng(bounds.getSouth(), bounds.getCenter().lng);

      const topPt = map.latLngToContainerPoint(northCenter);
      const bottomPt = map.latLngToContainerPoint(southCenter);

      const containerWidth = container.clientWidth || 900;
      const containerHeight = container.clientHeight || 660;
      const cardWidth = popupCardRef.current?.offsetWidth || 350;
      const cardHeight = popupCardRef.current?.offsetHeight || 275;

      const halfWidth = cardWidth / 2;
      const clampedX = Math.max(
        halfWidth + 14,
        Math.min(containerWidth - halfWidth - 14, topPt.x)
      );

      let desiredTop = topPt.y - cardHeight - 14;
      if (desiredTop < 14) {
        if (bottomPt.y + cardHeight + 18 <= containerHeight - 14) {
          desiredTop = bottomPt.y + 14;
        } else {
          desiredTop = 14;
        }
      }

      const clampedY = Math.max(
        14,
        Math.min(containerHeight - cardHeight - 14, desiredTop)
      );

      setPopupPos({ x: clampedX, y: clampedY });
    },
    [lots]
  );

  const focusPolygonWithPopupOffset = useCallback(
    (targetLot) => {
      const map = mapInstanceRef.current;
      if (!map || !targetLot) return;
      const idx = lots.findIndex((l) => l.id === targetLot.id);
      const coords = getLotCoordinates(targetLot, idx >= 0 ? idx : 0);
      if (!coords || coords.length < 3) return;

      const polyBounds = L.polygon(coords).getBounds();
      const center = polyBounds.getCenter();
      const targetZoom = Math.max(map.getZoom(), 17);
      const targetPoint = map.project(center, targetZoom);
      const offsetPoint = L.point(targetPoint.x, targetPoint.y - 95);
      const offsetLatLng = map.unproject(offsetPoint, targetZoom);

      setActiveKmlFeature(null);
      setActivePopupLotId(targetLot.id);
      map.flyTo(offsetLatLng, targetZoom, { animate: true, duration: 0.45 });

      setTimeout(() => {
        updatePopupPixelPosition(targetLot);
      }, 120);
    },
    [lots, updatePopupPixelPosition]
  );

  const focusKmlFeature = useCallback((feat) => {
    const map = mapInstanceRef.current;
    if (!map || !feat) return;
    setActivePopupLotId(null);
    setActiveKmlFeature(feat);

    if (Array.isArray(feat.coordinates) && feat.coordinates.length >= 3) {
      map.flyToBounds(L.polygon(feat.coordinates).getBounds(), {
        padding: [70, 70],
        maxZoom: 18,
        duration: 0.5,
      });
    }
  }, []);

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
    kmlGroupRef.current = L.featureGroup().addTo(map);
    searchPinGroupRef.current = L.featureGroup().addTo(map);
    editLayerGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    const syncLabelVisibility = () => {
      if (!mapContainerRef.current) return;
      if (map.getZoom() < 15) {
        mapContainerRef.current.classList.add('map-labels-hidden');
      } else {
        mapContainerRef.current.classList.remove('map-labels-hidden');
      }
    };

    syncLabelVisibility();
    map.on('zoomend', syncLabelVisibility);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
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
    if (!map) return;

    const syncPos = () => {
      if (activePopupLot && mapMode === 'view') {
        updatePopupPixelPosition(activePopupLot);
      }
    };

    map.on('move', syncPos);
    map.on('zoom', syncPos);
    return () => {
      map.off('move', syncPos);
      map.off('zoom', syncPos);
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
      maxZoom: config.maxZoom,
    }).addTo(map);

    if (config.overlayUrl) {
      labelOverlayRef.current = L.tileLayer(config.overlayUrl, {
        maxZoom: config.maxZoom,
        pane: 'overlayPane',
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

  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    lots.forEach((lot, idx) => {
      if (mapMode === 'edit' && editingLotId === lot.id) return;

      const style = getStatusStyles(lot.status);
      const coords = getLotCoordinates(lot, idx);
      const isSelected = activePopupLotId === lot.id && mapMode === 'view';

      const polygon = L.polygon(coords, {
        color: isSelected ? '#ffffff' : style.polygonStroke,
        weight: isSelected ? 3.5 : 2,
        fillColor: style.polygonFill,
        fillOpacity: mapMode !== 'view' ? 0.25 : isSelected ? 0.72 : 0.48,
      });

      polygon.bindTooltip(
        '<div style="text-align:center;line-height:1.2;">' +
          '<div style="font-family:monospace;font-weight:800;font-size:11px;color:#ffffff;text-shadow:0 1px 3px rgba(0,0,0,0.95);">' +
          lot.planter +
          '</div>' +
          '<div style="font-weight:700;font-size:10px;color:#f8fafc;text-shadow:0 1px 3px rgba(0,0,0,0.95);">' +
          lot.id +
          ' (' +
          lot.areaHa +
          ' ha)</div>' +
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
          focusPolygonWithPopupOffset(lot);
        });
      }

      polygon.addTo(group);
    });
  }, [lots, activePopupLotId, editingLotId, mapMode, focusPolygonWithPopupOffset]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const kmlGroup = kmlGroupRef.current;
    if (!map || !kmlGroup) return;

    kmlGroup.clearLayers();

    importedFeatures.forEach((feat) => {
      if (!Array.isArray(feat.coordinates) || feat.coordinates.length < 3) return;
      const isSelected = activeKmlFeature && activeKmlFeature.id === feat.id;

      const poly = L.polygon(feat.coordinates, {
        color: isSelected ? '#ffffff' : '#38bdf8',
        weight: isSelected ? 3.5 : 2.2,
        fillColor: '#0284c7',
        fillOpacity: isSelected ? 0.65 : 0.38,
      });

      poly.bindTooltip(
        '<div style="text-align:center;line-height:1.2;">' +
          '<div style="font-weight:800;font-size:11px;color:#e0f2fe;text-shadow:0 1px 3px rgba(0,0,0,0.95);">' +
          feat.name +
          '</div>' +
          '<div style="font-family:monospace;font-weight:700;font-size:10px;color:#ffffff;text-shadow:0 1px 3px rgba(0,0,0,0.95);">' +
          feat.areaHa +
          ' ha</div>' +
          '</div>',
        {
          permanent: true,
          direction: 'center',
          className: 'cane-lot-label',
        }
      );

      poly.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setActivePopupLotId(null);
        setActiveKmlFeature(feat);
      });

      poly.addTo(kmlGroup);
    });
  }, [importedFeatures, activeKmlFeature]);

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

  useEffect(() => {
    const map = mapInstanceRef.current;
    const editGroup = editLayerGroupRef.current;
    if (!map || !editGroup) return;

    editGroup.clearLayers();
    if (mapMode === 'view' || draftCoords.length === 0) return;

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

    draftCoords.forEach((pt, idx) => {
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
        const updatedPoint = [
          Number(pos.lat.toFixed(6)),
          Number(pos.lng.toFixed(6)),
        ];
        setDraftCoords((prev) =>
          prev.map((coord, i) => (i === idx ? updatedPoint : coord))
        );
      });

      marker.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        setDraftCoords((prev) => {
          if (prev.length <= 3 && mapMode === 'edit') return prev;
          return prev.filter((_, i) => i !== idx);
        });
      });

      marker.addTo(editGroup);

      if (draftCoords.length >= 3) {
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

      const nearbyLot = lots.find(
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
          duration: 0.65,
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
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
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
        if (map) {
          const allPts = parsedFeatures.flatMap((f) => f.coordinates || []);
          if (allPts.length >= 3) {
            map.flyToBounds(L.polygon(allPts).getBounds(), {
              padding: [50, 50],
              duration: 0.7,
            });
          }
        }
      } catch (err) {
        alert(
          'Could not parse file (' +
            err.message +
            '). Please upload a valid Google Earth .kml or .geojson file.'
        );
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleStartEditLot = (targetLot) => {
    if (!targetLot) return;
    const idx = lots.findIndex((l) => l.id === targetLot.id);
    const coords = getLotCoordinates(targetLot, idx >= 0 ? idx : 0);
    setEditingLotId(targetLot.id);
    setActivePopupLotId(null);
    setDraftCoords(coords.map((c) => [...c]));
    setMapMode('edit');

    const map = mapInstanceRef.current;
    if (map && coords.length >= 3) {
      map.flyToBounds(L.polygon(coords).getBounds(), {
        padding: [80, 80],
        maxZoom: 18,
        duration: 0.5,
      });
    }
  };

  const handleStartDrawNew = () => {
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

    const combined = L.featureGroup();
    if (group) group.getLayers().forEach((l) => combined.addLayer(l));
    if (kmlGroup) kmlGroup.getLayers().forEach((l) => combined.addLayer(l));

    if (combined.getLayers().length > 0) {
      map.flyToBounds(combined.getBounds(), { padding: [45, 45], duration: 0.6 });
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <style>{
        '.cane-lot-label { background: transparent !important; border: none !important; box-shadow: none !important; pointer-events: none !important; opacity: 1; transition: opacity 0.2s ease-in-out; }' +
        '.cane-lot-label::before { display: none !important; }' +
        '.map-labels-hidden .cane-lot-label { opacity: 0 !important; visibility: hidden !important; }' +
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 shadow-2xs"
          >
            Go
          </button>
        </form>

        {/* Center: Compact Legend or Active Digitizer Controls */}
        {mapMode === 'view' ? (
          <div className="hidden xl:flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block border border-emerald-700" />
              Due (≤7d)
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block border border-amber-700" />
              Upcoming
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block border border-sky-700" />
              Planned Later
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block border border-slate-600" />
              No Date
            </span>
          </div>
        ) : (
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
              className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3 inline mr-1" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setDraftCoords([])}
              className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 font-semibold"
            >
              <Trash2 className="w-3 h-3 inline mr-1" />
              Clear
            </button>
            {mapMode === 'edit' && editingLot && (
              <button
                type="button"
                disabled={draftCoords.length < 3}
                onClick={handleSaveEditedBoundary}
                className="px-2.5 py-1 rounded bg-emerald-700 text-white font-bold disabled:opacity-40"
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
                className="px-2.5 py-1 rounded bg-slate-900 text-white font-bold disabled:opacity-40"
              >
                Register ({draftAreaHa} ha)
              </button>
            )}
            <button
              type="button"
              onClick={handleCancelDigitize}
              className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-600 font-semibold"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Right: Basemaps + KML Import + Draw Polygon + Fit All */}
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
                className="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold"
              >
                + Lot
              </button>
              <button
                type="button"
                onClick={() => setSearchedPin(null)}
                className="text-slate-400 hover:text-slate-700"
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
                'px-2 py-1 rounded font-semibold transition-all ' +
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
                'px-2 py-1 rounded font-semibold transition-all ' +
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
                'px-2 py-1 rounded font-semibold transition-all ' +
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
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-xs font-bold text-emerald-800 dark:text-emerald-300"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import KML</span>
          </button>

          <button
            type="button"
            onClick={handleStartDrawNew}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Draw Polygon</span>
          </button>

          <button
            type="button"
            onClick={handleFitAllBounds}
            title="Fit all polygons"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <Crosshair className="w-3.5 h-3.5 text-slate-500" />
            <span>Fit All</span>
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
        {/* ADJUSTABLE (RESIZABLE) & COLLAPSIBLE LEFT SIDE PANEL */}
        <div
          style={{
            width: isSidePanelOpen ? `${panelWidth}px` : '0px',
            transition: isResizing ? 'none' : 'width 220ms cubic-bezier(0.16, 1, 0.3, 1)',
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
                    {lots.length + importedFeatures.length} items
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-2 divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {Object.keys(groupedKmlFolders).length > 0 && (
                  <div className="pb-2">
                    <div className="px-3 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                      <span>Imported KML Layers</span>
                      <button
                        type="button"
                        onClick={() => {
                          setImportedFeatures([]);
                          setActiveKmlFeature(null);
                        }}
                        className="text-rose-600 hover:underline font-semibold"
                      >
                        Clear KML
                      </button>
                    </div>

                    {Object.entries(groupedKmlFolders).map(([folderName, feats]) => {
                      const fKey = `kml:${folderName}`;
                      const expanded = isFolderExpanded(fKey);

                      return (
                        <div key={fKey} className="mt-0.5">
                          <button
                            type="button"
                            onClick={() => toggleFolder(fKey)}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 text-left"
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
                              {feats.length}
                            </span>
                          </button>

                          {expanded && (
                            <div className="pl-6 pr-2 space-y-0.5 mt-0.5">
                              {feats.map((feat) => {
                                const isSel =
                                  activeKmlFeature && activeKmlFeature.id === feat.id;
                                return (
                                  <button
                                    key={feat.id}
                                    type="button"
                                    onClick={() => focusKmlFeature(feat)}
                                    className={
                                      'w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left transition-colors ' +
                                      (isSel
                                        ? 'bg-sky-600 text-white font-bold'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200')
                                    }
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <PolygonNodeIcon
                                        color={isSel ? '#ffffff' : '#0284c7'}
                                      />
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
                                      {feat.areaHa}ha
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
                )}

                <div className="pt-1">
                  <div className="px-3 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Registered Planter Lots ({lots.length})</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      Drag edge to resize
                    </span>
                  </div>

                  {Object.entries(groupedPlanterFolders).map(([folderName, groupLots]) => {
                    const fKey = `lot:${folderName}`;
                    const expanded = isFolderExpanded(fKey);

                    return (
                      <div key={fKey} className="mt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleFolder(fKey)}
                          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 text-left"
                        >
                          {expanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          {expanded ? (
                            <FolderOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Folder className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="truncate flex-1">{folderName}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {groupLots.length}
                          </span>
                        </button>

                        {expanded && (
                          <div className="pl-6 pr-2 space-y-0.5 mt-0.5">
                            {groupLots.map((lot) => {
                              const isSel = activePopupLotId === lot.id;
                              const st = getStatusStyles(lot.status);
                              return (
                                <button
                                  key={lot.id}
                                  type="button"
                                  onClick={() => focusPolygonWithPopupOffset(lot)}
                                  className={
                                    'w-full px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 text-left transition-colors ' +
                                    (isSel
                                      ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200')
                                  }
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <PolygonNodeIcon
                                      color={isSel ? '#ffffff' : st.polygonFill}
                                    />
                                    <div className="min-w-0">
                                      <div className="truncate uppercase font-bold tracking-tight">
                                        {lot.planter}
                                      </div>
                                      <div
                                        className={
                                          'text-[10px] truncate ' +
                                          (isSel
                                            ? 'text-emerald-100'
                                            : 'text-slate-400')
                                        }
                                      >
                                        {lot.id} • {lot.hacienda} ({lot.areaHa} ha)
                                      </div>
                                    </div>
                                  </div>

                                  <span
                                    className={
                                      'text-[10px] font-mono font-semibold shrink-0 ' +
                                      (isSel
                                        ? 'text-white'
                                        : lot.plannedHarvestDate
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-slate-400')
                                    }
                                  >
                                    {lot.plannedHarvestDate || 'No date'}
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
              </div>
            </div>
          )}

          {/* DRAGGABLE VERTICAL RESIZE SPLITTER BAR */}
          {isSidePanelOpen && (
            <div
              onMouseDown={startResizingPanel}
              onTouchStart={startResizingPanel}
              onDoubleClick={() => setPanelWidth(320)}
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
            className="absolute top-1/2 -right-7 -translate-y-1/2 z-[460] w-7 h-16 bg-white dark:bg-slate-900 border border-l-0 border-slate-300 dark:border-slate-700 rounded-r-xl shadow-md flex items-center justify-center gap-0.5 text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-slate-50 transition-colors"
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

          {activeKmlFeature && mapMode === 'view' && (
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
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
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
                  className="w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold inline-flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register as Planter Lot ({activeKmlFeature.areaHa} ha)</span>
                </button>
              </div>
            </div>
          )}

          {activePopupLot && mapMode === 'view' && (
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
                    <div className="flex items-center gap-2">
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
                        {activePopupLot.status}
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1 truncate">
                      {activePopupLot.planter}
                    </h4>
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                      {activePopupLot.association} • {activePopupLot.contactNumber}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {activePopupLot.hacienda}, {activePopupLot.barangay},{' '}
                      {activePopupLot.city}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActivePopupLotId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] text-slate-500">Field Hectarage</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                      {activePopupLot.areaHa} ha
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
                    onClick={() => handleStartEditLot(activePopupLot)}
                    className="py-2 px-3 rounded-lg border border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
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
                    className="py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
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



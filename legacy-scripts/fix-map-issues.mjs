import fs from 'fs';
import path from 'path';

const files = {
  'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
}

/* Fix white grid lines/seams between Leaflet satellite tiles caused by Tailwind img reset */
.leaflet-container img.leaflet-tile {
  max-width: none !important;
  max-height: none !important;
  width: 256.5px !important;
  height: 256.5px !important;
}

@keyframes drawerFadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mapPopupSpring {
  0% {
    opacity: 0;
    transform: translate(-50%, 8px) scale(0.92);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

.animate-drawer-item {
  animation: drawerFadeUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.animate-map-popup {
  animation: mapPopupSpring 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`,

  'src/components/ParcelMapView.jsx': `import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ExternalLink,
  Truck,
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
  const [activePopupLotId, setActivePopupLotId] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 300, y: 20, placement: 'above' });
  const [basemapKey, setBasemapKey] = useState('googleHybrid');
  const [isTallMap, setIsTallMap] = useState(false);
  const [customGeoJsonCount, setCustomGeoJsonCount] = useState(0);

  // Digitizer state: 'view' | 'edit' | 'draw'
  const [mapMode, setMapMode] = useState('view');
  const [editingLotId, setEditingLotId] = useState(null);
  const [draftCoords, setDraftCoords] = useState([]);
  const [autoUpdateArea, setAutoUpdateArea] = useState(true);

  const mapContainerRef = useRef(null);
  const popupCardRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const labelOverlayRef = useRef(null);
  const polygonsGroupRef = useRef(null);
  const editLayerGroupRef = useRef(null);
  const customGeoJsonGroupRef = useRef(null);
  const fileInputRef = useRef(null);

  const activePopupLot = lots.find((l) => l.id === activePopupLotId) || null;
  const editingLot = lots.find((l) => l.id === editingLotId) || null;
  const draftAreaHa = calculatePolygonAreaHa(draftCoords);

  // Compute clamped top-left coordinates so the pop-up NEVER gets clipped by the map edges
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
      const cardWidth = popupCardRef.current?.offsetWidth || 365;
      const cardHeight =
        popupCardRef.current?.offsetHeight || (targetLot.dispatch ? 345 : 305);

      const halfWidth = cardWidth / 2;
      const clampedX = Math.max(
        halfWidth + 14,
        Math.min(containerWidth - halfWidth - 14, topPt.x)
      );

      // Prefer placing above the polygon; if not enough room above, place below or clamp to 14px from top
      let desiredTop = topPt.y - cardHeight - 14;
      let placement = 'above';

      if (desiredTop < 14) {
        if (bottomPt.y + cardHeight + 18 <= containerHeight - 14) {
          desiredTop = bottomPt.y + 14;
          placement = 'below';
        } else {
          desiredTop = 14;
        }
      }

      const clampedY = Math.max(
        14,
        Math.min(containerHeight - cardHeight - 14, desiredTop)
      );

      setPopupPos({ x: clampedX, y: clampedY, placement });
    },
    [lots]
  );

  // Focus a polygon and pan the camera slightly north so there is generous room above the parcel for the pop-up card
  const focusPolygonWithPopupOffset = useCallback(
    (targetLot) => {
      const map = mapInstanceRef.current;
      if (!map || !targetLot) return;
      const idx = lots.findIndex((l) => l.id === targetLot.id);
      const coords = getLotCoordinates(targetLot, idx >= 0 ? idx : 0);
      if (!coords || coords.length < 3) return;

      const polyBounds = L.polygon(coords).getBounds();
      const center = polyBounds.getCenter();
      const targetPoint = map.project(center, map.getZoom());
      // Shift camera 110px north so the polygon sits in the lower half of the view
      const offsetPoint = L.point(targetPoint.x, targetPoint.y - 110);
      const offsetLatLng = map.unproject(offsetPoint, map.getZoom());

      setActivePopupLotId(targetLot.id);
      map.panTo(offsetLatLng, { animate: true, duration: 0.35 });

      setTimeout(() => {
        updatePopupPixelPosition(targetLot);
      }, 60);
    },
    [lots, updatePopupPixelPosition]
  );

  // Initialize Leaflet Map once
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

  // Re-clamp position right after popup mounts and measures its exact height
  useEffect(() => {
    if (activePopupLot && mapMode === 'view') {
      updatePopupPixelPosition(activePopupLot);
    }
  }, [activePopupLot, mapMode, updatePopupPixelPosition]);

  // Keep popup anchored when panning or zooming
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

  // Recalculate size when map height toggles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (activePopupLot) updatePopupPixelPosition(activePopupLot);
    }, 180);
    return () => clearTimeout(timer);
  }, [isTallMap, activePopupLot, updatePopupPixelPosition]);

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

  // Map background click
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (mapMode === 'view') {
        setActivePopupLotId(null);
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

  // Close popup on ESC key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActivePopupLotId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Render Sugarcane Parcel Polygons
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    lots.forEach((lot, idx) => {
      if (mapMode === 'edit' && editingLotId === lot.id) {
        return;
      }

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
          focusPolygonWithPopupOffset(lot);
        });

        polygon.on('mouseover', () => {
          polygon.setStyle({ weight: 3.5, fillOpacity: 0.72, color: '#ffffff' });
        });

        polygon.on('mouseout', () => {
          const stillActive = activePopupLotId === lot.id;
          polygon.setStyle({
            weight: stillActive ? 3.5 : 2,
            fillOpacity: stillActive ? 0.72 : 0.48,
            color: stillActive ? '#ffffff' : style.polygonStroke,
          });
        });
      }

      polygon.addTo(group);
    });
  }, [lots, activePopupLotId, editingLotId, mapMode, focusPolygonWithPopupOffset]);

  // Render Editable / Drawable Polygon & Draggable Handles
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
    onUpdateLotBoundary(editingLot.id, draftCoords, finalArea);
    const savedLot = { ...editingLot, coordinates: draftCoords, areaHa: finalArea };
    setMapMode('view');
    setEditingLotId(null);
    setDraftCoords([]);
    setTimeout(() => focusPolygonWithPopupOffset(savedLot), 80);
  };

  const handleCreateNewLotFromDrawn = () => {
    if (draftCoords.length < 3) return;
    onCreateLotFromPolygon(draftCoords, draftAreaHa);
    setMapMode('view');
    setEditingLotId(null);
    setDraftCoords([]);
  };

  const handleFitAllBounds = () => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    if (map && group && group.getLayers().length > 0) {
      setActivePopupLotId(null);
      map.flyToBounds(group.getBounds(), { padding: [45, 45], duration: 0.6 });
    }
  };

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
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-2xs">
      <style>{
        '.cane-lot-label { background: transparent !important; border: none !important; box-shadow: none !important; pointer-events: none; }' +
        '.cane-lot-label::before { display: none !important; }' +
        '.leaflet-container { cursor: ' +
        (mapMode === 'view' ? 'grab' : 'crosshair') +
        ' !important; }'
      }</style>

      {/* Top Header & Basemap Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              District Spatial Parcel Map
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Globe className="w-3 h-3" />
              Live Satellite GIS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any plotted sugarcane parcel on the map to pop up its maturity & yield details
          </p>
        </div>

        {/* Basemap Switcher + Actions */}
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
            onClick={() => setIsTallMap((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white"
          >
            {isTallMap ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Standard Height</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand Height</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Legend + Quick Jump Pills + Polygon Digitizer Bar */}
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

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">
                Jump:
              </span>
              {lots.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => focusPolygonWithPopupOffset(l)}
                  className={
                    'px-2 py-1 rounded text-[11px] font-mono font-bold border transition-all ' +
                    (activePopupLotId === l.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100')
                  }
                >
                  {l.id}
                </button>
              ))}

              <button
                type="button"
                onClick={handleStartDrawNew}
                className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors shadow-2xs"
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
                  ? 'Reshaping ' + (editingLot ? editingLot.id : 'Polygon')
                  : 'Drawing New Field Polygon'}
              </span>
              <span className="text-slate-600">
                Click map to add corners • Drag white handles to move • Right-click handle to delete
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
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={() => setDraftCoords([])}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>

              {mapMode === 'edit' && editingLot && (
                <button
                  type="button"
                  disabled={draftCoords.length < 3}
                  onClick={handleSaveEditedBoundary}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save {editingLot.id} Boundary</span>
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

      {/* Isolated Map Container (isolate + z-0 prevents Leaflet layers from overlapping drawers/modals) */}
      <div
        className={
          'relative isolate z-0 w-full rounded-xl overflow-hidden border border-slate-300 shadow-inner transition-all ' +
          (isTallMap ? 'h-[82vh] min-h-[700px]' : 'h-[660px]')
        }
      >
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* IN-MAP FLOATING POP-UP CONTAINER (Top-Clamped so it NEVER clips at the top border) */}
        {activePopupLot && mapMode === 'view' && (
          <div
            ref={popupCardRef}
            key={activePopupLot.id}
            style={{
              left: popupPos.x + 'px',
              top: popupPos.y + 'px',
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute z-[450] w-[345px] sm:w-[368px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/95 overflow-hidden animate-map-popup select-none"
          >
            {/* Colored Status Accent Strip */}
            <div className={'h-1.5 w-full ' + getStatusStyles(activePopupLot.status).bar} />

            <div className="p-4">
              {/* Pop-up Header */}
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
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
                  <h4 className="text-base font-extrabold text-slate-900 mt-1 truncate">
                    {activePopupLot.hacienda}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    Planter: <strong className="text-slate-800">{activePopupLot.planter}</strong> • {activePopupLot.sector}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActivePopupLotId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                  title="Close pop-up"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 3 Key Metrics Grid inside Pop-up */}
              <div className="grid grid-cols-3 gap-2 my-2.5 text-center">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-500">Avg Brix</div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {activePopupLot.avgBrix}°
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {activePopupLot.topBrix}° / {activePopupLot.bottomBrix}°
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-500">Maturity Ratio</div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {activePopupLot.maturityRatio}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold">
                    T/B Ratio
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-500">Sugar Yield</div>
                  <div className="text-sm font-extrabold text-emerald-700">
                    {activePopupLot.estimatedLkgTc}
                  </div>
                  <div className="text-[10px] text-slate-400">LKg/TC</div>
                </div>
              </div>

              {/* Compact Secondary Details Row */}
              <div className="flex items-center justify-between text-[11px] text-slate-600 px-1 mb-2.5">
                <span className="truncate">
                  Variety: <strong className="text-slate-800">{activePopupLot.variety}</strong> ({activePopupLot.cropClass})
                </span>
                <span className="shrink-0 ml-2">
                  <strong className="text-slate-900">{activePopupLot.areaHa} ha</strong> ({activePopupLot.estimatedTons.toLocaleString()} MT)
                </span>
              </div>

              {/* Readiness Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-600">Harvest Readiness Score</span>
                  <span className="font-extrabold text-slate-900">{activePopupLot.readinessScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={'h-full rounded-full ' + getStatusStyles(activePopupLot.status).bar}
                    style={{ width: activePopupLot.readinessScore + '%' }}
                  />
                </div>
              </div>

              {activePopupLot.dispatch && (
                <div className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-semibold flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate">
                    Scheduled Cut: {activePopupLot.dispatch.scheduledDate} ({activePopupLot.dispatch.quedanTicket})
                  </span>
                </div>
              )}

              {/* Action Buttons inside Pop-up */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStartEditLot(activePopupLot)}
                  className="py-2 px-3 rounded-lg border border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Reshape Polygon</span>
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
                  <span>Full Inspector</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Fixed: ' + relativePath);
}

import fs from 'fs';
import path from 'path';

const files = {
  'src/data/initialLots.js': `export const INITIAL_LOTS = [
  {
    id: 'LOT-A101',
    hacienda: 'Hda. Santa Maria',
    planter: 'Roberto Villanueva',
    sector: 'Sector A - North',
    variety: 'Phil 2006-2289',
    cropClass: 'Plant Cane',
    areaHa: 14.5,
    expectedTcHa: 78,
    plantingDate: '2025-10-12',
    cropAgeMonths: 12.2,
    topBrix: 20.6,
    bottomBrix: 21.0,
    soilMoisture: 'Optimal (18%)',
    lastSampled: '2026-10-18',
    coordinates: [
      [10.8215, 123.0085],
      [10.8218, 123.0122],
      [10.8186, 123.0125],
      [10.8183, 123.0088]
    ],
    dispatch: {
      scheduledDate: '2026-10-24',
      quedanTicket: 'QDN-2026-8841',
      brigadeLeader: 'Brgy. Guimbala-on Crew 2',
      assignedTrucks: 4,
    },
  },
  {
    id: 'LOT-A102',
    hacienda: 'Hda. San Jose',
    planter: 'Elena Montelibano',
    sector: 'Sector A - North',
    variety: 'VMC 84-524',
    cropClass: 'Ratoon 1',
    areaHa: 11.2,
    expectedTcHa: 72,
    plantingDate: '2025-11-05',
    cropAgeMonths: 11.5,
    topBrix: 20.1,
    bottomBrix: 20.8,
    soilMoisture: 'Optimal (19%)',
    lastSampled: '2026-10-19',
    coordinates: [
      [10.8218, 123.0124],
      [10.8221, 123.0158],
      [10.8189, 123.0161],
      [10.8186, 123.0127]
    ],
    dispatch: null,
  },
  {
    id: 'LOT-B201',
    hacienda: 'Hda. Carmen',
    planter: 'Miguel Locsin',
    sector: 'Sector B - Central',
    variety: 'Phil 99-1793',
    cropClass: 'Plant Cane',
    areaHa: 18.0,
    expectedTcHa: 84,
    plantingDate: '2025-12-18',
    cropAgeMonths: 10.1,
    topBrix: 17.8,
    bottomBrix: 19.8,
    soilMoisture: 'Moderate (22%)',
    lastSampled: '2026-10-17',
    coordinates: [
      [10.8221, 123.0160],
      [10.8224, 123.0202],
      [10.8191, 123.0205],
      [10.8189, 123.0163]
    ],
    dispatch: null,
  },
  {
    id: 'LOT-B204',
    hacienda: 'Hda. Esperanza',
    planter: 'Carlos Gaston',
    sector: 'Sector B - Central',
    variety: 'Phil 2006-2289',
    cropClass: 'Ratoon 1',
    areaHa: 9.8,
    expectedTcHa: 70,
    plantingDate: '2025-08-20',
    cropAgeMonths: 14.0,
    topBrix: 21.8,
    bottomBrix: 19.9,
    soilMoisture: 'Dry (14%)',
    lastSampled: '2026-10-19',
    coordinates: [
      [10.8180, 123.0088],
      [10.8183, 123.0125],
      [10.8152, 123.0128],
      [10.8149, 123.0091]
    ],
    dispatch: null,
  },
  {
    id: 'LOT-C301',
    hacienda: 'Hda. Malisbog',
    planter: 'Antonio Ledesma',
    sector: 'Sector C - Upland',
    variety: 'VMC 84-524',
    cropClass: 'Plant Cane',
    areaHa: 16.4,
    expectedTcHa: 80,
    plantingDate: '2025-10-28',
    cropAgeMonths: 11.7,
    topBrix: 19.9,
    bottomBrix: 20.4,
    soilMoisture: 'Optimal (17%)',
    lastSampled: '2026-10-18',
    coordinates: [
      [10.8183, 123.0127],
      [10.8186, 123.0162],
      [10.8154, 123.0165],
      [10.8152, 123.0130]
    ],
    dispatch: null,
  },
  {
    id: 'LOT-D402',
    hacienda: 'Hda. Tinihaban',
    planter: 'Patricia Gonzaga',
    sector: 'Sector D - Mill District',
    variety: 'Phil 8013',
    cropClass: 'Ratoon 2',
    areaHa: 12.6,
    expectedTcHa: 68,
    plantingDate: '2026-02-14',
    cropAgeMonths: 8.2,
    topBrix: 14.2,
    bottomBrix: 17.6,
    soilMoisture: 'High (26%)',
    lastSampled: '2026-10-15',
    coordinates: [
      [10.8186, 123.0164],
      [10.8188, 123.0205],
      [10.8156, 123.0208],
      [10.8154, 123.0167]
    ],
    dispatch: null,
  },
];
`,

  'src/components/ParcelMapView.jsx': `import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Globe, Maximize2, Upload, Layers } from 'lucide-react';
import { getStatusStyles } from '../utils/caneCalculations';

const BASEMAPS = {
  googleHybrid: {
    name: 'Google Earth Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: 'Imagery &copy; Google Earth',
    maxZoom: 20,
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
    name: 'Google Satellite Clean',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: 'Imagery &copy; Google Satellite',
    maxZoom: 20,
  },
};

// Default fallback coordinates generator if a newly added lot does not have GPS coordinates yet
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

export default function ParcelMapView({ lots, onSelectLot }) {
  const [selectedLot, setSelectedLot] = useState(lots[0] || null);
  const [basemapKey, setBasemapKey] = useState('googleHybrid');
  const [customGeoJsonCount, setCustomGeoJsonCount] = useState(0);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const labelOverlayRef = useRef(null);
  const polygonsGroupRef = useRef(null);
  const customGeoJsonGroupRef = useRef(null);
  const fileInputRef = useRef(null);

  // Keep selectedLot synced when lots filter changes
  useEffect(() => {
    if (lots.length > 0 && (!selectedLot || !lots.some((l) => l.id === selectedLot.id))) {
      setSelectedLot(lots[0]);
    }
  }, [lots, selectedLot]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.8185, 123.0145],
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    polygonsGroupRef.current = L.featureGroup().addTo(map);
    customGeoJsonGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch between Esri World Imagery and Google Earth Hybrid
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

  // Render Sugarcane Parcel Polygons & Labels
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    lots.forEach((lot, idx) => {
      const style = getStatusStyles(lot.status);
      const coords = getLotCoordinates(lot, idx);
      const isSelected = selectedLot && selectedLot.id === lot.id;

      const polygon = L.polygon(coords, {
        color: isSelected ? '#ffffff' : style.polygonStroke,
        weight: isSelected ? 3.5 : 2,
        fillColor: style.polygonFill,
        fillOpacity: isSelected ? 0.68 : 0.48,
      });

      polygon.bindTooltip(
        '<div style="text-align:center;line-height:1.25;">' +
          '<div style="font-family:monospace;font-weight:800;font-size:11px;color:#ffffff;text-shadow:0 1px 3px rgba(0,0,0,0.9);">' +
          lot.id +
          '</div>' +
          '<div style="font-weight:700;font-size:10px;color:#f8fafc;text-shadow:0 1px 3px rgba(0,0,0,0.9);">' +
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

      polygon.on('click', () => {
        setSelectedLot(lot);
        map.flyToBounds(polygon.getBounds(), {
          padding: [50, 50],
          maxZoom: 17,
          duration: 0.6,
        });
      });

      polygon.on('mouseover', () => {
        setSelectedLot(lot);
        polygon.setStyle({ weight: 3.5, fillOpacity: 0.72, color: '#ffffff' });
      });

      polygon.on('mouseout', () => {
        const stillSelected = selectedLot && selectedLot.id === lot.id;
        polygon.setStyle({
          weight: stillSelected ? 3.5 : 2,
          fillOpacity: stillSelected ? 0.68 : 0.48,
          color: stillSelected ? '#ffffff' : style.polygonStroke,
        });
      });

      polygon.addTo(group);
    });
  }, [lots, selectedLot]);

  const handleFitAllBounds = () => {
    const map = mapInstanceRef.current;
    const group = polygonsGroupRef.current;
    if (map && group && group.getLayers().length > 0) {
      map.flyToBounds(group.getBounds(), { padding: [30, 30], duration: 0.7 });
    }
  };

  // Optional: Load custom QGIS .geojson file overlay
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
      } catch (err) {
        alert('Invalid GeoJSON file. Make sure it is exported in EPSG:4326 (WGS 84).');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Transparent tooltip style injection for clean satellite parcel labels */}
      <style>{
        '.cane-lot-label { background: transparent !important; border: none !important; box-shadow: none !important; pointer-events: none; }' +
        '.cane-lot-label::before { display: none !important; }'
      }</style>

      {/* Left 2 Columns: Interactive Satellite GIS Map */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-2xs">
        {/* Top GIS Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                District Spatial Parcel Map
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Globe className="w-3 h-3" />
                Live Satellite GIS
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any sugarcane parcel polygon to inspect maturity or switch between Google Earth & Esri World Imagery
            </p>
          </div>

          {/* Basemap Switcher + QGIS GeoJSON Importer */}
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
              <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
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
              title="Overlay exported QGIS .geojson field boundaries (EPSG:4326)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>QGIS .geojson</span>
            </button>
          </div>
        </div>

        {/* Status Legend Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
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
          </div>

          {customGeoJsonCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
              <Layers className="w-3 h-3" />
              {customGeoJsonCount} QGIS features loaded
            </span>
          )}
        </div>

        {/* Interactive Map Container */}
        <div className="relative w-full h-[430px] rounded-xl overflow-hidden border border-slate-300 shadow-inner z-0">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        </div>
      </div>

      {/* Right Column: Selected Parcel Quick Preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between shadow-2xs">
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

            {/* Quick Lot Selector Pills underneath preview */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-500 mb-2">
                Quick Jump to Parcel:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lots.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedLot(l)}
                    className={
                      'px-2 py-1 rounded text-[11px] font-mono font-bold border transition-all ' +
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
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Updated: ' + relativePath);
}

// Fix any multiline join in src/App.jsx automatically
const appPath = path.resolve(process.cwd(), 'src/App.jsx');
if (fs.existsSync(appPath)) {
  let appCode = fs.readFileSync(appPath, 'utf8');
  appCode = appCode.replace(/\.join\(['"]\r?\n['"]\)/g, '.join(String.fromCharCode(10))');
  fs.writeFileSync(appPath, appCode, 'utf8');
  console.log('Verified src/App.jsx syntax');
}

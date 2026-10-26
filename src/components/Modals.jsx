import React, { useState, useEffect, useMemo } from 'react';
import { X, Compass, Calendar, Sparkles } from 'lucide-react';

export const PLANTER_ASSOCIATIONS = [
  { value: 'APSSI', label: 'APSSI' },
  { value: 'AHSSI', label: 'AHSSI' },
  { value: 'APP-NEG', label: 'APP-NEG' },
  { value: 'SIMAG', label: 'SIMAG' },
  { value: 'NDNPAI', label: 'NDNPAI' },
  { value: 'Private', label: 'Private (Independent Planter)' },
];

// Built-in Negros Occidental Mill District Hacienda & Barangay GIS Reference
const DISTRICT_HACIENDA_REFERENCE = [
  { hacienda: 'Hda. Colisap', barangay: 'Brgy. Hawaiian', city: 'Silay City', lat: 10.82082, lng: 123.01053 },
  { hacienda: 'Hda. Guinsang-an', barangay: 'Brgy. Hawaiian', city: 'Silay City', lat: 10.81835, lng: 122.99850 },
  { hacienda: 'Hda. Santa Maria', barangay: 'Brgy. Guimbala-on', city: 'Silay City', lat: 10.79650, lng: 123.03520 },
  { hacienda: 'Hda.Lonoy', barangay: 'Brgy. E. Lopez', city: 'Silay City', lat: 10.81240, lng: 123.04810 },
  { hacienda: 'Hda. Bagtic', barangay: 'Brgy. Bagtic', city: 'Silay City', lat: 10.77820, lng: 123.01140 },
  { hacienda: 'Hda. Newton', barangay: 'Brgy. 13', city: 'Victorias City', lat: 10.88128, lng: 123.05078 },
  { hacienda: 'Hda. Florencia', barangay: 'Brgy. Dos Hermanas', city: 'Talisay City', lat: 10.73510, lng: 122.99820 },
  { hacienda: 'Hda. Emma', barangay: 'Brgy. Alicante', city: 'E.B. Magalona', lat: 10.85840, lng: 123.02110 },
  { hacienda: 'Hda. San Jose', barangay: 'Brgy. Matab-ang', city: 'Talisay City', lat: 10.75120, lng: 122.97640 },
  { hacienda: 'Hda. Tinihaban', barangay: 'Brgy. Mambulac', city: 'Silay City', lat: 10.80110, lng: 122.96850 },
];

function inferLocationFromCoords(lat, lng, existingLots = []) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return null;

  // Combine user's existing lots with district reference points
  const candidates = [
    ...existingLots
      .filter((l) => Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude)))
      .map((l) => ({
        hacienda: l.hacienda,
        barangay: l.barangay,
        city: l.city,
        lat: Number(l.latitude),
        lng: Number(l.longitude),
      })),
    ...DISTRICT_HACIENDA_REFERENCE,
  ];

  let closest = null;
  let minDistanceSq = Infinity;

  for (const item of candidates) {
    const dLat = numLat - item.lat;
    const dLng = numLng - item.lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = item;
    }
  }

  // If within ~3.8km (approx 0.035 deg), use the nearest known hacienda/brgy/city
  if (closest && minDistanceSq <= 0.0015) {
    return {
      hacienda: closest.hacienda,
      barangay: closest.barangay,
      city: closest.city,
    };
  }

  // Otherwise infer City / Municipality by latitude bands in Northern Negros
  if (numLat >= 10.87) {
    return { hacienda: 'Hda. Newton', barangay: 'Brgy. 13', city: 'Victorias City' };
  }
  if (numLat >= 10.845) {
    return { hacienda: 'Hda. Emma', barangay: 'Brgy. Alicante', city: 'E.B. Magalona' };
  }
  if (numLat < 10.76) {
    return { hacienda: 'Hda. Florencia', barangay: 'Brgy. Dos Hermanas', city: 'Talisay City' };
  }

  return {
    hacienda: closest?.hacienda || 'Hda. Colisap',
    barangay: closest?.barangay || 'Brgy. Hawaiian',
    city: closest?.city || 'Silay City',
  };
}

function generateNextLotId(city = 'Silay City', existingLots = []) {
  const prefix = String(city || 'S').trim().toUpperCase().startsWith('V')
    ? 'LOT-V'
    : String(city || 'S').trim().toUpperCase().startsWith('T')
    ? 'LOT-T'
    : String(city || 'S').trim().toUpperCase().startsWith('E')
    ? 'LOT-E'
    : 'LOT-S';

  const existingIds = new Set(existingLots.map((l) => String(l.id).toUpperCase()));
  let num = 401 + existingLots.length;
  while (existingIds.has(`${prefix}${num}`)) {
    num++;
  }
  return `${prefix}${num}`;
}

export function SetHarvestDateModal({ isOpen, lot, onClose, onSaveDispatch }) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lot) {
      setScheduledDate(lot.plannedHarvestDate || '2026-11-20');
      setNotes(lot.harvestNotes || '');
    }
  }, [lot]);

  if (!isOpen || !lot) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveDispatch(lot.id, {
        scheduledDate: scheduledDate || null,
        notes,
        contactNumber: lot.contactNumber || '',
        association: lot.association || 'APSSI',
        barangay: lot.barangay || 'Brgy. Hawaiian',
        city: lot.city || 'Silay City',
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1250] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-drawer-item">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Schedule Planter Harvest Date
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lot.id} • {lot.planter} ({lot.hacienda}, {lot.city})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Planned Date of Harvest *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Harvest Schedule Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Hauling trucks assigned, priority mill delivery..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {lot.plannedHarvestDate && (
              <button
                type="button"
                onClick={async () => {
                  await onSaveDispatch(lot.id, {
                    scheduledDate: null,
                    notes: '',
                    contactNumber: lot.contactNumber || '',
                    association: lot.association || 'APSSI',
                    barangay: lot.barangay || 'Brgy. Hawaiian',
                    city: lot.city || 'Silay City',
                  });
                  onClose();
                }}
                className="mr-auto px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-bold"
              >
                Clear Date
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Harvest Date'}
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
  existingLots = [],
  initialCoordinates = null,
  initialAreaHa = null,
  initialLatitude = null,
  initialLongitude = null,
}) {
  const [planter, setPlanter] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [association, setAssociation] = useState('APSSI');
  const [hacienda, setHacienda] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('Silay City');
  const [areaHa, setAreaHa] = useState('');
  const [plannedHarvestDate, setPlannedHarvestDate] = useState('');
  const [lotId, setLotId] = useState('');
  const [latitude, setLatitude] = useState('10.8185');
  const [longitude, setLongitude] = useState('123.0145');
  const [harvestNotes, setHarvestNotes] = useState('');
  const [autoFillTag, setAutoFillTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deduplicated directory of known Haciendas -> Barangay & City for instant auto-fill
  const haciendaDirectory = useMemo(() => {
    const map = new Map();
    for (const ref of DISTRICT_HACIENDA_REFERENCE) {
      map.set(ref.hacienda.toLowerCase(), ref);
    }
    for (const lot of existingLots) {
      if (lot.hacienda) {
        map.set(String(lot.hacienda).toLowerCase(), {
          hacienda: lot.hacienda,
          barangay: lot.barangay || 'Brgy. Hawaiian',
          city: lot.city || 'Silay City',
          lat: Number(lot.latitude) || 10.8185,
          lng: Number(lot.longitude) || 123.0145,
        });
      }
    }
    return Array.from(map.values());
  }, [existingLots]);

  // Auto-populate fields whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    const startLat =
      initialLatitude !== null && initialLatitude !== undefined
        ? Number(initialLatitude).toFixed(5)
        : '10.8185';
    const startLng =
      initialLongitude !== null && initialLongitude !== undefined
        ? Number(initialLongitude).toFixed(5)
        : '123.0145';

    setLatitude(startLat);
    setLongitude(startLng);
    setAreaHa(
      initialAreaHa !== null && initialAreaHa !== undefined
        ? String(initialAreaHa)
        : ''
    );

    const inferred = inferLocationFromCoords(startLat, startLng, existingLots);
    const nextHacienda = inferred?.hacienda || 'Hda. Colisap';
    const nextBarangay = inferred?.barangay || 'Brgy. Hawaiian';
    const nextCity = inferred?.city || 'Silay City';

    setHacienda(nextHacienda);
    setBarangay(nextBarangay);
    setCity(nextCity);
    setLotId(generateNextLotId(nextCity, existingLots));
    setAutoFillTag('Auto-filled from GIS coordinates');
  }, [
    isOpen,
    initialLatitude,
    initialLongitude,
    initialAreaHa,
    existingLots,
  ]);

  // Auto-update Hacienda, Barangay, and City when user edits Latitude or Longitude
  const handleCoordChange = (newLatStr, newLngStr) => {
    setLatitude(newLatStr);
    setLongitude(newLngStr);

    const numLat = parseFloat(newLatStr);
    const numLng = parseFloat(newLngStr);
    if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return;

    const inferred = inferLocationFromCoords(numLat, numLng, existingLots);
    if (inferred) {
      setHacienda(inferred.hacienda);
      setBarangay(inferred.barangay);
      setCity(inferred.city);
      setLotId(generateNextLotId(inferred.city, existingLots));
      setAutoFillTag('Synced with coordinates');
    }

    // Optional live OpenStreetMap Nominatim reverse-geocode refinement for Barangay & City
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${numLat}&lon=${numLng}&zoom=16`,
      { headers: { 'Accept-Language': 'en' } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.address) return;
        const addr = data.address;
        const osmCity =
          addr.city || addr.town || addr.municipality || null;
        const osmBrgy =
          addr.suburb || addr.village || addr.neighbourhood || addr.hamlet || null;

        if (osmCity) {
          const formattedCity =
            osmCity.toLowerCase().includes('silay')
              ? 'Silay City'
              : osmCity.toLowerCase().includes('victorias')
              ? 'Victorias City'
              : osmCity.toLowerCase().includes('talisay')
              ? 'Talisay City'
              : osmCity;
          setCity(formattedCity);
        }
        if (osmBrgy && !String(osmBrgy).toLowerCase().startsWith('brgy')) {
          setBarangay(`Brgy. ${osmBrgy}`);
        } else if (osmBrgy) {
          setBarangay(osmBrgy);
        }
      })
      .catch(() => {});
  };

  // Auto-fill Barangay & City when user types or selects a known Hacienda
  const handleHaciendaChange = (val) => {
    setHacienda(val);
    const matched = haciendaDirectory.find(
      (item) => item.hacienda.toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      setBarangay(matched.barangay);
      setCity(matched.city);
      setLotId(generateNextLotId(matched.city, existingLots));
      setAutoFillTag(`Auto-filled from ${matched.hacienda}`);
    }
  };

  // Update Lot ID prefix automatically when City changes (e.g., Silay -> LOT-S, Victorias -> LOT-V)
  const handleCityChange = (val) => {
    setCity(val);
    if (lotId.startsWith('LOT-')) {
      setLotId(generateNextLotId(val, existingLots));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!planter.trim() || !hacienda.trim() || !city.trim()) return;

    setIsSubmitting(true);
    try {
      const numLat = Number(latitude) || 10.8185;
      const numLng = Number(longitude) || 123.0145;
      const numArea = Number(areaHa) || 5.0;

      const coords =
        Array.isArray(initialCoordinates) && initialCoordinates.length >= 3
          ? initialCoordinates
          : [
              [Number((numLat + 0.0011).toFixed(6)), Number((numLng - 0.0011).toFixed(6))],
              [Number((numLat + 0.0011).toFixed(6)), Number((numLng + 0.0011).toFixed(6))],
              [Number((numLat - 0.0011).toFixed(6)), Number((numLng + 0.0011).toFixed(6))],
              [Number((numLat - 0.0011).toFixed(6)), Number((numLng - 0.0011).toFixed(6))],
            ];

      const newLot = {
        id: lotId.trim() || generateNextLotId(city, existingLots),
        planter: planter.trim(),
        contactNumber: contactNumber.trim() || 'Not provided',
        association,
        hacienda: hacienda.trim(),
        barangay: barangay.trim() || 'Brgy. Hawaiian',
        city: city.trim(),
        sector: city.trim(),
        variety: 'VMC 84-524',
        cropType: 'Plant Cane',
        areaHa: numArea,
        expectedTcHa: 75,
        latitude: numLat,
        longitude: numLng,
        coordinates: coords,
        plannedHarvestDate: plannedHarvestDate || null,
        harvestNotes: harvestNotes.trim(),
      };

      const res = await onAddLot(newLot);
      if (res?.code !== '23505') {
        setPlanter('');
        setContactNumber('');
        setPlannedHarvestDate('');
        setHarvestNotes('');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1250] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-drawer-item my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Register Planter Sugarcane Lot
              </h3>
              {autoFillTag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Sparkles className="w-3 h-3" />
                  {autoFillTag}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hacienda, Barangay & City auto-fill from coordinates or existing haciendas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Row 1: Planter Name, Contact Number, Planter's Association (Includes Private) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Planter Full Name *
              </label>
              <input
                type="text"
                required
                value={planter}
                onChange={(e) => setPlanter(e.target.value)}
                placeholder="e.g. Roberto Villanueva"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. 0917-552-8410"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Planter&apos;s Association *
              </label>
              <select
                value={association}
                onChange={(e) => setAssociation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {PLANTER_ASSOCIATIONS.map((assoc) => (
                  <option key={assoc.value} value={assoc.value}>
                    {assoc.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Auto-Filled Hacienda, Barangay, and City / Municipality */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Hacienda *
              </label>
              <input
                type="text"
                required
                list="caneready-hacienda-list"
                value={hacienda}
                onChange={(e) => handleHaciendaChange(e.target.value)}
                placeholder="e.g. Hda. Colisap"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <datalist id="caneready-hacienda-list">
                {haciendaDirectory.map((item) => (
                  <option
                    key={item.hacienda}
                    value={item.hacienda}
                  >{`${item.barangay}, ${item.city}`}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Barangay (Brgy.) *
              </label>
              <input
                type="text"
                required
                list="caneready-brgy-list"
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                placeholder="e.g. Brgy. Hawaiian"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <datalist id="caneready-brgy-list">
                <option value="Brgy. Hawaiian" />
                <option value="Brgy. Guimbala-on" />
                <option value="Brgy. E. Lopez" />
                <option value="Brgy. Bagtic" />
                <option value="Brgy. Mambulac" />
                <option value="Brgy. 13" />
                <option value="Brgy. Dos Hermanas" />
                <option value="Brgy. Alicante" />
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                City / Municipality *
              </label>
              <input
                type="text"
                required
                list="caneready-city-list"
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                placeholder="e.g. Silay City"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <datalist id="caneready-city-list">
                <option value="Silay City" />
                <option value="Victorias City" />
                <option value="Talisay City" />
                <option value="E.B. Magalona" />
                <option value="Cadiz City" />
                <option value="Bacolod City" />
              </datalist>
            </div>
          </div>

          {/* Row 3: Field Hectarage, Planned Date of Harvest, Lot ID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Field Hectarage (ha) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
                placeholder="e.g. 14.5"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Planned Date of Harvest
              </label>
              <input
                type="date"
                value={plannedHarvestDate}
                onChange={(e) => setPlannedHarvestDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Lot ID *
              </label>
              <input
                type="text"
                required
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Row 4: Area Coordinates (Editing Lat/Lng auto-updates Hacienda, Brgy, and City) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                <Compass className="w-4 h-4 text-rose-500" />
                <span>Area Coordinates (Latitude & Longitude)</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Auto-detects Hacienda & City
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Latitude (°N) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => handleCoordChange(e.target.value, longitude)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Longitude (°E) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => handleCoordChange(latitude, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Optional Notes */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
              Planter Notes (Optional)
            </label>
            <input
              type="text"
              value={harvestNotes}
              onChange={(e) => setHarvestNotes(e.target.value)}
              placeholder="e.g. Planter target schedule remarks..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Planter Lot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
